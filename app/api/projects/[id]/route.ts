import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { query } from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const projectRes = await query(
    `SELECT id, title, project_type, target_platform, target_duration, vibe, status, generated_content, created_at, updated_at
     FROM projects WHERE id = $1 AND user_id = $2`,
    [id, session.id]
  );
  const project = projectRes.rows[0];
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const voiceRes = await query(
    `SELECT id, script_content, provider_voice_id, status, created_at
     FROM voiceovers WHERE project_id = $1 AND user_id = $2 ORDER BY created_at DESC LIMIT 1`,
    [id, session.id]
  );
  const voiceover = voiceRes.rows[0] || null;

  return NextResponse.json({ project, voiceover });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { title, generated_content } = await req.json();

  const updates: string[] = [];
  const values: unknown[] = [];
  let i = 1;

  if (title !== undefined) { updates.push(`title = $${i++}`); values.push(title); }
  if (generated_content !== undefined) { updates.push(`generated_content = $${i++}`); values.push(JSON.stringify(generated_content)); }

  if (updates.length === 0) return NextResponse.json({ ok: true });

  updates.push(`updated_at = now()`);
  values.push(id, session.id);

  await query(
    `UPDATE projects SET ${updates.join(", ")} WHERE id = $${i} AND user_id = $${i + 1}`,
    values
  );

  return NextResponse.json({ ok: true });
}
