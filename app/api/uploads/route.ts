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

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  try {
    const { projectId, fileName, fileType, mimeType, fileSize, filePath } = await req.json();
    const result = await query(
      `INSERT INTO uploads (user_id, project_id, file_name, file_type, mime_type, file_path, file_size, analysis_status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id, file_name, file_type, mime_type, file_path, file_size, analysis_status, created_at`,
      [session.id, projectId || null, fileName, fileType, mimeType, filePath, fileSize, "ready"]
    );
    return NextResponse.json({ upload: result.rows[0] });
  } catch (err) {
    console.error("Upload error:", err);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
