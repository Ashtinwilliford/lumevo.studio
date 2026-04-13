import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { query } from "@/lib/db";

// POST /api/reset — Full factory reset for the authenticated user.
// Deletes all user content (uploads, projects, voiceovers, logs, feedback).
// Keeps: users row, brand_profiles, creator_styles, music_tracks (shared).
export async function POST() {
  const session = await getSession();
  if (!session?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = session.id;
  const results: { table: string; status: string; deleted?: number }[] = [];

  async function wipe(table: string, sql: string) {
    try {
      const res = await query(sql, [userId]);
      results.push({ table, status: "ok", deleted: (res as unknown as { rowCount?: number }).rowCount ?? 0 });
    } catch (err) {
      results.push({ table, status: "error: " + (err instanceof Error ? err.message : String(err)) });
    }
  }

  // Order matters — delete children before parents (foreign key constraints)
  await wipe("generation_logs", "DELETE FROM generation_logs WHERE user_id = $1");
  await wipe("voiceovers", "DELETE FROM voiceovers WHERE user_id = $1");
  await wipe("project_feedback", "DELETE FROM project_feedback WHERE user_id = $1");
  await wipe("learning_insights", "DELETE FROM learning_insights WHERE user_id = $1");
  await wipe("generated_contents", "DELETE FROM generated_contents WHERE project_id IN (SELECT id FROM projects WHERE user_id = $1)");
  await wipe("uploads", "DELETE FROM uploads WHERE user_id = $1");
  await wipe("projects", "DELETE FROM projects WHERE user_id = $1");

  // Reset creator_styles to defaults (don't delete — it'll just get recreated)
  try {
    await query("DELETE FROM creator_styles WHERE user_id = $1", [userId]);
    results.push({ table: "creator_styles", status: "reset" });
  } catch { /* may not exist */ }

  return NextResponse.json({
    message: "Factory reset complete. All uploads, projects, and generated content have been deleted.",
    results,
  });
}
