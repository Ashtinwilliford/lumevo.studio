import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { query } from "@/lib/db";

export const config = { api: { bodyParser: false } };

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const result = await query(
    `SELECT id, file_type, file_name, mime_type, file_size, analysis_status, transcript_text, created_at
     FROM uploads WHERE user_id = $1 ORDER BY created_at DESC`,
    [session.id]
  );

  return NextResponse.json({ uploads: result.rows });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  try {
    const body = await req.json();
    const { file_name, file_type, mime_type, file_size, file_data, project_id } = body;

    if (!file_name || !file_type) {
      return NextResponse.json({ error: "file_name and file_type required" }, { status: 400 });
    }

    const result = await query(
      `INSERT INTO uploads (user_id, project_id, file_type, file_name, mime_type, file_size, file_data, analysis_status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
       RETURNING id, file_name, file_type, analysis_status, created_at`,
      [session.id, project_id || null, file_type, file_name, mime_type || null, file_size || 0, file_data || null]
    );

    await query(
      `UPDATE brand_profiles SET upload_count = upload_count + 1,
       learning_progress_percent = LEAST(100, learning_progress_percent + 3),
       confidence_score = LEAST(100, confidence_score + 2),
       updated_at = NOW()
       WHERE user_id = $1`,
      [session.id]
    );

    const upload = result.rows[0];

    if (file_type === "caption" || file_type === "script" || file_type === "text") {
      await query(
        `UPDATE uploads SET analysis_status = 'complete', transcript_text = $1 WHERE id = $2`,
        [file_data || file_name, upload.id]
      );
    }

    return NextResponse.json({ upload });
  } catch (err) {
    console.error("Upload error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
