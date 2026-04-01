import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { query } from "@/lib/db";

// GET: Fetch user's creator style profile
export async function GET() {
  const session = await getSession();
  if (!session?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await query("SELECT * FROM creator_styles WHERE user_id = $1", [session.id]);
  if (result.rows[0]) {
    return NextResponse.json({ style: result.rows[0] });
  }

  // Create default profile if none exists
  const insert = await query(
    `INSERT INTO creator_styles (user_id) VALUES ($1)
     ON CONFLICT (user_id) DO NOTHING
     RETURNING *`,
    [session.id]
  );
  return NextResponse.json({ style: insert.rows[0] || {} });
}

// PATCH: Update style profile fields
export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const allowed = [
    "vibe_keywords", "pacing", "caption_style", "music_energy",
    "transition_density", "voiceover_preference", "preferred_hooks",
    "banned_elements", "color_grade", "text_amount"
  ];

  const updates: string[] = [];
  const values: unknown[] = [];
  let i = 1;

  for (const key of allowed) {
    if (body[key] !== undefined) {
      updates.push(`${key} = $${i++}`);
      values.push(body[key]);
    }
  }

  if (updates.length === 0) return NextResponse.json({ ok: true });

  updates.push(`updated_at = now()`);
  values.push(session.id);

  // Upsert
  await query(
    `INSERT INTO creator_styles (user_id) VALUES ($${i})
     ON CONFLICT (user_id) DO UPDATE SET ${updates.join(", ")}`,
    values
  );

  const result = await query("SELECT * FROM creator_styles WHERE user_id = $1", [session.id]);
  return NextResponse.json({ style: result.rows[0] });
}
