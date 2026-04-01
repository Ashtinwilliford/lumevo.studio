import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { query } from "@/lib/db";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const result = await query(
    `SELECT id, title, project_type, target_platform, target_duration, vibe, status, created_at, updated_at
     FROM projects WHERE user_id = $1 ORDER BY updated_at DESC`,
    [session.id]
  );

  return NextResponse.json({ projects: result.rows });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  try {
    const body = await req.json();
    const { title, project_type, target_platform, target_duration, prompt_text, vibe, tone, audience_goal,
            scene, people, location, occasion, voiceover_script, text_overlays, music_style } = body;

    if (!title) return NextResponse.json({ error: "title required" }, { status: 400 });

    // Base INSERT — columns that exist in original schema + migrate.sql (v1)
    const result = await query(
      `INSERT INTO projects (user_id, title, project_type, target_platform, target_duration, prompt_text, vibe, tone, audience_goal, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'draft')
       RETURNING id, title, project_type, target_platform, status, created_at`,
      [session.id, title, project_type || "caption", target_platform || "general",
       target_duration || null, prompt_text || null, vibe || null, tone || null, audience_goal || null]
    );
    const projectId = result.rows[0].id;

    // Try to save v3 rich brief fields — requires migrate-v3.sql to have been run
    const hasV3Fields = scene || people || location || occasion || voiceover_script || text_overlays?.length || music_style;
    if (hasV3Fields) {
      try {
        await query(
          `UPDATE projects SET scene=$1, people=$2, location=$3, occasion=$4, voiceover_script=$5, text_overlays=$6, music_style=$7, updated_at=now() WHERE id=$8`,
          [scene || null, people || null, location || null, occasion || null, voiceover_script || null, text_overlays || null, music_style || null, projectId]
        );
      } catch { /* migrate-v3.sql not run yet — v3 fields skipped */ }
    }

    return NextResponse.json({ project: result.rows[0] });
  } catch (err) {
    console.error("Project create error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
