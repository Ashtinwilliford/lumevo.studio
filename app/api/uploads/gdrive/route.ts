import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { query } from "@/lib/db";
import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export const maxDuration = 120;

function isGDriveFolder(url: string): boolean {
  return /\/drive\/folders\/|\/drive\/u\/\d+\/folders\//.test(url);
}

function extractGDriveId(url: string): string | null {
  const patterns = [
    /\/file\/d\/([a-zA-Z0-9_-]+)/,
    /[?&]id=([a-zA-Z0-9_-]+)/,
    /\/d\/([a-zA-Z0-9_-]+)/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m?.[1]) return m[1];
  }
  return null;
}

async function downloadGDriveFile(fileId: string): Promise<{ buffer: Buffer; filename: string; mimetype: string }> {
  const directUrl = `https://drive.google.com/uc?export=download&id=${fileId}&confirm=t`;
  const headers = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    "Accept": "*/*",
  };

  const res = await fetch(directUrl, { headers, redirect: "follow" });
  if (!res.ok) throw new Error(`Google Drive returned ${res.status} — make sure the file is shared as "Anyone with the link"`);

  const contentType = res.headers.get("content-type") || "application/octet-stream";

  if (contentType.includes("text/html")) {
    const html = await res.text();
    const uuidMatch = html.match(/uuid=([a-zA-Z0-9_-]+)/);
    const confirmMatch = html.match(/confirm=([a-zA-Z0-9_-]+)/);

    if (uuidMatch || confirmMatch) {
      const confirmUrl = uuidMatch
        ? `https://drive.usercontent.google.com/download?id=${fileId}&export=download&confirm=t&uuid=${uuidMatch[1]}`
        : `https://drive.google.com/uc?export=download&id=${fileId}&confirm=${confirmMatch![1]}`;

      const confirmed = await fetch(confirmUrl, { headers, redirect: "follow" });
      if (!confirmed.ok) throw new Error(`Download failed: ${confirmed.status}`);

      const buffer = Buffer.from(await confirmed.arrayBuffer());
      const confirmedType = confirmed.headers.get("content-type") || "video/mp4";
      const disposition = confirmed.headers.get("content-disposition") || "";
      const nameMatch = disposition.match(/filename\*?=(?:UTF-8'')?["']?([^"';\n]+)["']?/i);
      const filename = nameMatch?.[1] ? decodeURIComponent(nameMatch[1].trim()) : `gdrive-${fileId}.mp4`;
      return { buffer, filename, mimetype: confirmedType.split(";")[0].trim() };
    }
    throw new Error("File requires sign-in or is not shared publicly.");
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  const disposition = res.headers.get("content-disposition") || "";
  const nameMatch = disposition.match(/filename\*?=(?:UTF-8'')?["']?([^"';\n]+)["']?/i);
  const filename = nameMatch?.[1] ? decodeURIComponent(nameMatch[1].trim()) : `gdrive-${fileId}`;
  return { buffer, filename, mimetype: contentType.split(";")[0].trim() };
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  let urls: string[];
  try {
    const body = await req.json() as { url?: string; urls?: string[] };
    if (body.urls && Array.isArray(body.urls)) {
      urls = body.urls.map(u => u.trim()).filter(Boolean);
    } else if (body.url) {
      urls = [body.url.trim()];
    } else {
      return NextResponse.json({ error: "No URL provided" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const results: Record<string, unknown>[] = [];
  const errors: string[] = [];

  for (const driveUrl of urls) {
    if (isGDriveFolder(driveUrl)) {
      errors.push(`Folder links not supported. Share individual files instead.`);
      continue;
    }

    const fileId = extractGDriveId(driveUrl);
    if (!fileId) {
      errors.push(`Couldn't find file ID in: ${driveUrl.slice(0, 60)}...`);
      continue;
    }

    try {
      const { buffer, filename, mimetype } = await downloadGDriveFile(fileId);

      const isVideo = mimetype.startsWith("video/");
      const isImage = mimetype.startsWith("image/");
      const fileType = isVideo ? "video" : isImage ? "image" : "video";

      // Upload to Cloudinary
      const cloudResult = await new Promise<Record<string, unknown>>((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder: `lumevo/${session.id}`,
            resource_type: isVideo ? "video" : "image",
          },
          (error, result) => {
            if (error) reject(error);
            else resolve(result as Record<string, unknown>);
          }
        );
        stream.end(buffer);
      });

      const filePath = cloudResult.secure_url as string;

      // Save to database
      const insertRow = await query(
        `INSERT INTO uploads (user_id, file_type, file_name, mime_type, file_size, file_path, analysis_status)
         VALUES ($1, $2, $3, $4, $5, $6, 'ready') RETURNING id, file_type, file_name, mime_type, file_size, file_path, analysis_status, created_at`,
        [session.id, fileType, filename, mimetype, buffer.length, filePath]
      );

      const uploadRow = insertRow.rows[0];
      results.push(uploadRow);

      // Fire-and-forget AI analysis
      if (uploadRow?.id) {
        fetch(`${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/uploads/analyze`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Cookie: req.headers.get("cookie") || "" },
          body: JSON.stringify({ uploadId: uploadRow.id }),
        }).catch(() => {});
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Download failed";
      errors.push(`${driveUrl.slice(0, 50)}: ${msg}`);
    }
  }

  return NextResponse.json({
    uploads: results,
    errors: errors.length > 0 ? errors : undefined,
    count: results.length,
  });
}
