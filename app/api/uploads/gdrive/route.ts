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

function extractFolderId(url: string): string | null {
  const m = url.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  return m?.[1] || null;
}

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

// List files in a shared Google Drive folder using the public API
async function listFolderFiles(folderId: string): Promise<{ id: string; name: string; mimeType: string }[]> {
  const apiKey = process.env.GOOGLE_API_KEY;

  if (apiKey) {
    // Use Google Drive API v3 if API key is available
    const url = `https://www.googleapis.com/drive/v3/files?q='${folderId}'+in+parents&fields=files(id,name,mimeType)&key=${apiKey}&pageSize=50`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      return (data.files || []).filter((f: { mimeType: string }) =>
        f.mimeType.startsWith("video/") || f.mimeType.startsWith("image/")
      );
    }
  }

  // Fallback: scrape the folder's public HTML page
  const folderUrl = `https://drive.google.com/drive/folders/${folderId}`;
  const res = await fetch(folderUrl, {
    headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" },
  });
  if (!res.ok) throw new Error("Can't access folder. Make sure it's shared as 'Anyone with the link'");

  const html = await res.text();

  // Extract file IDs and names from the folder HTML
  // Google Drive embeds file data in the page as JS data
  const files: { id: string; name: string; mimeType: string }[] = [];

  // Pattern 1: Look for file IDs in data attributes or JS
  const idMatches = html.matchAll(/\["([a-zA-Z0-9_-]{20,})","([^"]+?)","(video\/[^"]*|image\/[^"]*)"/g);
  for (const m of idMatches) {
    files.push({ id: m[1], name: m[2], mimeType: m[3] });
  }

  // Pattern 2: Simpler extraction - find all file IDs linked in the page
  if (files.length === 0) {
    const linkMatches = html.matchAll(/\/file\/d\/([a-zA-Z0-9_-]+)/g);
    const seenIds = new Set<string>();
    for (const m of linkMatches) {
      if (!seenIds.has(m[1])) {
        seenIds.add(m[1]);
        files.push({ id: m[1], name: `file-${m[1].slice(0, 8)}`, mimeType: "video/mp4" });
      }
    }
  }

  return files;
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

async function importOneFile(
  fileId: string,
  userId: string,
  cookie: string,
  projectId: string | null = null
): Promise<{ upload: Record<string, unknown> | null; error: string | null }> {
  try {
    const { buffer, filename, mimetype } = await downloadGDriveFile(fileId);

    const isVideo = mimetype.startsWith("video/");
    const isImage = mimetype.startsWith("image/");
    const fileType = isVideo ? "video" : isImage ? "image" : "video";

    const cloudResult = await new Promise<Record<string, unknown>>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: `lumevo/${userId}`, resource_type: isVideo ? "video" : "image" },
        (error, result) => { if (error) reject(error); else resolve(result as Record<string, unknown>); }
      );
      stream.end(buffer);
    });

    const filePath = cloudResult.secure_url as string;

    const insertRow = await query(
      `INSERT INTO uploads (user_id, project_id, file_type, file_name, mime_type, file_size, file_path, analysis_status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'ready') RETURNING id, file_type, file_name, mime_type, file_size, file_path, analysis_status, created_at`,
      [userId, projectId, fileType, filename, mimetype, buffer.length, filePath]
    );

    const uploadRow = insertRow.rows[0];

    // Fire-and-forget AI analysis
    if (uploadRow?.id) {
      fetch(`${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/uploads/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({ uploadId: uploadRow.id }),
      }).catch(() => {});
    }

    return { upload: uploadRow, error: null };
  } catch (err) {
    return { upload: null, error: err instanceof Error ? err.message : "Download failed" };
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  let body;
  try { body = await req.json() as { url?: string; urls?: string[]; projectId?: string }; } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const projectId = body.projectId || null;
  const inputUrl = body.url?.trim() || "";
  const inputUrls = body.urls?.map(u => u.trim()).filter(Boolean) || [];
  const allUrls = inputUrl ? [inputUrl, ...inputUrls] : inputUrls;

  if (allUrls.length === 0) return NextResponse.json({ error: "No URL provided" }, { status: 400 });

  const results: Record<string, unknown>[] = [];
  const errors: string[] = [];
  const cookie = req.headers.get("cookie") || "";

  for (const driveUrl of allUrls) {
    // FOLDER SUPPORT: list all files and import each one
    if (isGDriveFolder(driveUrl)) {
      const folderId = extractFolderId(driveUrl);
      if (!folderId) { errors.push("Couldn't parse folder ID"); continue; }

      console.log("Importing Google Drive folder:", folderId);

      try {
        const files = await listFolderFiles(folderId);
        if (files.length === 0) {
          errors.push("No media files found in folder. Make sure the folder is shared as 'Anyone with the link'.");
          continue;
        }

        console.log(`Found ${files.length} files in folder`);

        for (const file of files) {
          const { upload, error } = await importOneFile(file.id, session.id, cookie, projectId);
          if (upload) results.push(upload);
          if (error) errors.push(`${file.name}: ${error}`);
        }
      } catch (err) {
        errors.push(err instanceof Error ? err.message : "Folder import failed");
      }
      continue;
    }

    // SINGLE FILE
    const fileId = extractGDriveId(driveUrl);
    if (!fileId) { errors.push(`Couldn't find file ID in: ${driveUrl.slice(0, 60)}`); continue; }

    const { upload, error } = await importOneFile(fileId, session.id, cookie, projectId);
    if (upload) results.push(upload);
    if (error) errors.push(error);
  }

  return NextResponse.json({
    uploads: results,
    errors: errors.length > 0 ? errors : undefined,
    count: results.length,
  });
}
