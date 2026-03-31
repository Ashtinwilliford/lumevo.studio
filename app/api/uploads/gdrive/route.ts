import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { query } from "@/lib/db";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { exec } from "child_process";
import { promisify } from "util";
import Anthropic from "@anthropic-ai/sdk";
import { readFile } from "fs/promises";

const execAsync = promisify(exec);

const ai = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

export const maxDuration = 120;

function isGDriveFolder(url: string): boolean {
  return /\/drive\/folders\/|\/drive\/u\/\d+\/folders\//.test(url);
}

function extractGDriveId(url: string): string | null {
  // Handles:
  // https://drive.google.com/file/d/FILE_ID/view
  // https://drive.google.com/file/d/FILE_ID/view?usp=sharing
  // https://drive.google.com/open?id=FILE_ID
  // https://drive.google.com/uc?id=FILE_ID
  // https://docs.google.com/file/d/FILE_ID

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
  // Try direct download first (works for shared files under ~100MB)
  const directUrl = `https://drive.google.com/uc?export=download&id=${fileId}&confirm=t`;

  const headers = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    "Accept": "*/*",
  };

  const res = await fetch(directUrl, { headers, redirect: "follow" });

  if (!res.ok) {
    throw new Error(`Google Drive returned ${res.status} — make sure the file is shared as "Anyone with the link"`);
  }

  const contentType = res.headers.get("content-type") || "application/octet-stream";

  // If Google returns an HTML page (virus warning for large files), extract the confirm token
  if (contentType.includes("text/html")) {
    const html = await res.text();

    // Extract confirm token and download ID from the warning page
    const confirmMatch = html.match(/confirm=([a-zA-Z0-9_-]+)/);
    const uuidMatch = html.match(/uuid=([a-zA-Z0-9_-]+)/);

    if (confirmMatch || uuidMatch) {
      const confirmToken = confirmMatch?.[1];
      const uuid = uuidMatch?.[1];
      let confirmUrl: string;

      if (uuid) {
        confirmUrl = `https://drive.usercontent.google.com/download?id=${fileId}&export=download&confirm=t&uuid=${uuid}`;
      } else {
        confirmUrl = `https://drive.google.com/uc?export=download&id=${fileId}&confirm=${confirmToken}`;
      }

      const confirmed = await fetch(confirmUrl, { headers, redirect: "follow" });
      if (!confirmed.ok) throw new Error(`Download failed after confirmation: ${confirmed.status}`);

      const buffer = Buffer.from(await confirmed.arrayBuffer());
      const confirmedType = confirmed.headers.get("content-type") || "video/mp4";

      // Extract filename from Content-Disposition header
      const disposition = confirmed.headers.get("content-disposition") || "";
      const nameMatch = disposition.match(/filename\*?=(?:UTF-8'')?["']?([^"';\n]+)["']?/i);
      const filename = nameMatch?.[1] ? decodeURIComponent(nameMatch[1].trim()) : `gdrive-${fileId}.mp4`;

      return { buffer, filename, mimetype: confirmedType.split(";")[0].trim() };
    }

    throw new Error("File requires sign-in or is not shared publicly. Set sharing to 'Anyone with the link'.");
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  const disposition = res.headers.get("content-disposition") || "";
  const nameMatch = disposition.match(/filename\*?=(?:UTF-8'')?["']?([^"';\n]+)["']?/i);
  const filename = nameMatch?.[1] ? decodeURIComponent(nameMatch[1].trim()) : `gdrive-${fileId}`;

  return { buffer, filename, mimetype: contentType.split(";")[0].trim() };
}

async function analyzeWithVision(uploadId: string, filePath: string, thumbPath: string | null, fileType: string, fileName: string) {
  try {
    const analysisPath = thumbPath
      ? join(process.cwd(), "public", thumbPath)
      : filePath;

    if (fileType !== "image" && fileType !== "video") return;

    const imageBuffer = await readFile(analysisPath);
    const base64 = imageBuffer.toString("base64");
    const ext = analysisPath.split(".").pop()?.toLowerCase();
    const mimeMap: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif", webp: "image/webp" };
    const mime = mimeMap[ext || "jpg"] || "image/jpeg";

    const completion = await ai.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 300,
      messages: [{
        role: "user",
        content: [
          { type: "text", text: `Analyze this ${fileType === "video" ? "video frame" : "image"} for social content creation. Return JSON only: {"energy":"high|medium|low","mood":"[adjective]","setting":"[where]","subjects":"[what/who]","bestUse":"[hook|broll|transition|closeup]","colorPalette":"[dominant colors]","lighting":"[natural|studio|outdoor|indoor]","transcript":"[any visible text or spoken content]"}` },
          { type: "image", source: { type: "base64", media_type: mime as "image/jpeg" | "image/png" | "image/gif" | "image/webp", data: base64 } },
        ],
      }],
    });

    const raw = completion.choices[0]?.message?.content || "{}";
    let analysis: Record<string, string> = {};
    try { analysis = JSON.parse(raw.replace(/```json\n?|\n?```/g, "")); } catch { analysis = {}; }

    await query(
      `UPDATE uploads SET ai_analysis = $1, analysis_status = 'complete', transcript_text = $2 WHERE id = $3`,
      [JSON.stringify(analysis), analysis.transcript || null, uploadId]
    );
  } catch (e) {
    console.error("Vision analysis failed:", e);
    await query(`UPDATE uploads SET analysis_status = 'complete' WHERE id = $1`, [uploadId]);
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  let driveUrl: string;
  try {
    const body = await req.json() as { url?: string };
    driveUrl = body.url?.trim() || "";
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!driveUrl) {
    return NextResponse.json({ error: "No Google Drive URL provided" }, { status: 400 });
  }

  // Detect folder links — can't download a whole folder, must be an individual file
  if (isGDriveFolder(driveUrl)) {
    return NextResponse.json({
      error: "That's a folder link, not a file link. Open the folder in Google Drive, right-click on the specific video or photo you want → Share → copy that file's link instead.",
    }, { status: 400 });
  }

  const fileId = extractGDriveId(driveUrl);
  if (!fileId) {
    return NextResponse.json({ error: "Couldn't find a file ID in that URL. Make sure you're copying the share link from a specific file, not a folder." }, { status: 400 });
  }

  try {
    const userDir = join(process.cwd(), "public", "media", session.id);
    await mkdir(userDir, { recursive: true });

    // Download the file from Google Drive
    const { buffer, filename, mimetype } = await downloadGDriveFile(fileId);

    const isVideo = mimetype.startsWith("video/");
    const isImage = mimetype.startsWith("image/");
    const fileType = isVideo ? "video" : isImage ? "image" : "video"; // default video for unknown

    const ext = filename.split(".").pop()?.toLowerCase() || (isVideo ? "mp4" : "jpg");

    const insertRow = await query(
      `INSERT INTO uploads (user_id, file_type, file_name, mime_type, file_size, analysis_status)
       VALUES ($1, $2, $3, $4, $5, 'processing') RETURNING id`,
      [session.id, fileType, filename, mimetype, buffer.length]
    );
    const uploadId = (insertRow.rows[0] as { id: string }).id;

    const savedFilename = `${uploadId}.${ext}`;
    const filePath = join(userDir, savedFilename);
    await writeFile(filePath, buffer);

    const relPath = `/media/${session.id}/${savedFilename}`;
    await query("UPDATE uploads SET file_path = $1 WHERE id = $2", [relPath, uploadId]);

    let thumbPath: string | null = null;
    let videoDuration: number | null = null;

    if (isVideo) {
      const thumbName = `${uploadId}_thumb.jpg`;
      const thumbFilePath = join(userDir, thumbName);
      try {
        const { stdout } = await execAsync(`ffprobe -v error -show_entries format=duration -of csv=p=0 "${filePath}"`);
        videoDuration = parseFloat(stdout.trim()) || null;
        await execAsync(`ffmpeg -y -ss 1 -i "${filePath}" -frames:v 1 -q:v 3 -vf "scale=400:-1" "${thumbFilePath}" 2>/dev/null`);
        thumbPath = `/media/${session.id}/${thumbName}`;
      } catch { /* thumbnail not critical */ }
    } else if (isImage) {
      const thumbName = `${uploadId}_thumb.jpg`;
      const thumbFilePath = join(userDir, thumbName);
      try {
        await execAsync(`ffmpeg -y -i "${filePath}" -vf "scale=400:-1" "${thumbFilePath}" 2>/dev/null`);
        thumbPath = `/media/${session.id}/${thumbName}`;
      } catch { thumbPath = relPath; }
    }

    if (thumbPath) {
      await query("UPDATE uploads SET thumb_path = $1, video_duration_sec = $2 WHERE id = $3", [thumbPath, videoDuration, uploadId]);
    }

    // Fire-and-forget AI vision analysis
    analyzeWithVision(uploadId, filePath, thumbPath, fileType, filename).catch(console.error);

    // Update brand profile learning stats
    await query(
      `UPDATE brand_profiles SET upload_count = upload_count + 1,
       learning_progress_percent = LEAST(100, learning_progress_percent + 3),
       confidence_score = LEAST(100, confidence_score + 2),
       updated_at = NOW() WHERE user_id = $1`,
      [session.id]
    ).catch(() => null);

    return NextResponse.json({
      upload: {
        id: uploadId,
        file_name: filename,
        file_type: fileType,
        file_path: relPath,
        thumb_path: thumbPath,
        analysis_status: "processing",
        video_duration_sec: videoDuration,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Download failed";
    console.error("Google Drive import error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}




