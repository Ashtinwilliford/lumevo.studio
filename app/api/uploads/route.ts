import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { query } from "@/lib/db";
import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");
    let result;
    if (projectId) {
      result = await query(
        `SELECT id, file_type, file_name, mime_type, file_size, analysis_status, transcript_text, file_path, thumb_path, ai_analysis, video_duration_sec, created_at FROM uploads WHERE user_id = $1 AND project_id = $2 ORDER BY created_at DESC`,
        [session.id, projectId]
      );
    } else {
      result = await query(
        `SELECT id, file_type, file_name, mime_type, file_size, analysis_status, transcript_text, file_path, thumb_path, ai_analysis, video_duration_sec, created_at FROM uploads WHERE user_id = $1 ORDER BY created_at DESC`,
        [session.id]
      );
    }
    return NextResponse.json({ uploads: result.rows });
  } catch (err) {
    console.error("Uploads GET error:", err);
    return NextResponse.json({ uploads: [], error: "Failed to fetch uploads" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  try {
    const { uploadIds, projectId } = await req.json() as { uploadIds: string[]; projectId: string };
    if (!uploadIds?.length || !projectId) return NextResponse.json({ error: "uploadIds and projectId required" }, { status: 400 });
    const placeholders = uploadIds.map((_, i) => `$${i + 3}`).join(", ");
    await query(
      `UPDATE uploads SET project_id = $1 WHERE user_id = $2 AND id IN (${placeholders})`,
      [projectId, session.id, ...uploadIds]
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Upload PATCH error:", err);
    return NextResponse.json({ error: "Failed to link uploads" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  try {
    const { projectId, fileName, fileType, mimeType, fileSize, filePath, videoDuration } = await req.json();

    // Get video duration from Cloudinary if not provided and it's a video
    let duration: number | null = videoDuration ?? null;
    if (!duration && fileType === "video" && filePath?.includes("res.cloudinary.com")) {
      try {
        // Extract public_id from Cloudinary URL and query resource info
        const match = filePath.match(/\/upload\/(?:v\d+\/)?(.+)\.[^.]+$/);
        if (match?.[1]) {
          const info = await cloudinary.api.resource(match[1], { resource_type: "video" });
          duration = info.duration ?? null;
        }
      } catch { /* non-fatal — duration stays null */ }
    }

    const result = await query(
      `INSERT INTO uploads (user_id, project_id, file_name, file_type, mime_type, file_path, file_size, video_duration_sec, analysis_status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id, file_name, file_type, mime_type, file_path, file_size, video_duration_sec, analysis_status, created_at`,
      [session.id, projectId || null, fileName, fileType, mimeType, filePath, fileSize, duration, "ready"]
    );
    // Fire-and-forget AI analysis
    const uploadRow = result.rows[0];
    if (uploadRow?.id && filePath) {
      fetch(`${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/uploads/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: req.headers.get("cookie") || "" },
        body: JSON.stringify({ uploadId: uploadRow.id }),
      }).catch(() => {});
    }
    return NextResponse.json({ upload: uploadRow });
  } catch (err) {
    console.error("Upload error:", err);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
