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

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const result = await query(
    `SELECT id, file_type, file_name, mime_type, file_size, analysis_status,
            transcript_text, file_path, thumb_path, ai_analysis, video_duration_sec, created_at
     FROM uploads WHERE user_id = $1 ORDER BY created_at DESC`,
    [session.id]
  );
  return NextResponse.json({ uploads: result.rows });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  try {
    const { projectId, fileName, fileType, mimeType, fileSize, filePath } = await req.json();
    const result = await query(
      `INSERT INTO uploads (user_id, project_id, file_name, file_type, mime_type, file_path, file_size, analysis_status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, file_name, file_type, mime_type, file_path, file_size, analysis_status, created_at`,
      [session.id, projectId || null, fileName, fileType, mimeType, filePath, fileSize, "ready"]
    );
    return NextResponse.json({ upload: result.rows[0] });
  } catch (err) {
    console.error("Upload error:", err);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const projectId = formData.get("projectId") as string | null;

    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64 = buffer.toString("base64");
    const dataUri = `data:${file.type};base64,${base64}`;

    const isVideo = file.type.startsWith("video/");

    const uploaded = await cloudinary.uploader.upload(dataUri, {
      resource_type: isVideo ? "video" : "image",
      folder: `lumevo/${session.id}`,
    });

    const result = await query(
      `INSERT INTO uploads (user_id, project_id, file_name, file_type, mime_type, file_path, file_size, analysis_status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, file_name, file_type, mime_type, file_path, file_size, analysis_status, created_at`,
      [
        session.id,
        projectId || null,
        file.name,
        isVideo ? "video" : "image",
        file.type,
        uploaded.secure_url,
        file.size,
        "ready",
      ]
    );

    return NextResponse.json({ upload: result.rows[0] });
  } catch (err) {
    console.error("Upload error:", err);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
