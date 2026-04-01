import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { query } from "@/lib/db";

// GET /api/migrate — runs all pending migrations safely (idempotent)
// Protected: requires authenticated session
export async function GET() {
  const session = await getSession();
  if (!session?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const results: { step: string; status: string; error?: string }[] = [];

  async function run(step: string, sql: string) {
    try {
      await query(sql, []);
      results.push({ step, status: "ok" });
    } catch (err) {
      results.push({ step, status: "error", error: err instanceof Error ? err.message : String(err) });
    }
  }

  // migrate.sql (v1) — safe to re-run
  await run("uploads.mime_type", `ALTER TABLE uploads ADD COLUMN IF NOT EXISTS mime_type TEXT`);
  await run("uploads.thumb_path", `ALTER TABLE uploads ADD COLUMN IF NOT EXISTS thumb_path TEXT`);
  await run("uploads.analysis_status", `ALTER TABLE uploads ADD COLUMN IF NOT EXISTS analysis_status TEXT DEFAULT 'ready'`);
  await run("projects.prompt_text", `ALTER TABLE projects ADD COLUMN IF NOT EXISTS prompt_text TEXT`);
  await run("projects.render_path", `ALTER TABLE projects ADD COLUMN IF NOT EXISTS render_path TEXT`);
  await run("projects.tone", `ALTER TABLE projects ADD COLUMN IF NOT EXISTS tone TEXT`);
  await run("projects.audience_goal", `ALTER TABLE projects ADD COLUMN IF NOT EXISTS audience_goal TEXT`);
  await run("brand_profiles.cta_style", `ALTER TABLE brand_profiles ADD COLUMN IF NOT EXISTS cta_style TEXT`);
  await run("brand_profiles.avg_pacing_bpm", `ALTER TABLE brand_profiles ADD COLUMN IF NOT EXISTS avg_pacing_bpm FLOAT`);
  await run("voiceovers table", `CREATE TABLE IF NOT EXISTS voiceovers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    script_content TEXT,
    provider_voice_id TEXT,
    audio_url TEXT,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT now()
  )`);

  // migrate-v2.sql — creator styles + generation logs
  await run("creator_styles table", `CREATE TABLE IF NOT EXISTS creator_styles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    vibe_keywords TEXT[] DEFAULT '{}',
    pacing TEXT DEFAULT 'medium',
    caption_style TEXT DEFAULT 'minimal',
    music_energy TEXT DEFAULT 'cinematic',
    transition_density TEXT DEFAULT 'smooth',
    voiceover_preference TEXT DEFAULT 'none',
    preferred_hooks TEXT[] DEFAULT '{}',
    banned_elements TEXT[] DEFAULT '{}',
    color_grade TEXT DEFAULT 'warm',
    text_amount TEXT DEFAULT 'minimal',
    updated_at TIMESTAMP DEFAULT now(),
    UNIQUE(user_id)
  )`);
  await run("generation_logs table", `CREATE TABLE IF NOT EXISTS generation_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    stage TEXT NOT NULL,
    payload JSONB,
    result JSONB,
    error TEXT,
    duration_ms INTEGER,
    created_at TIMESTAMP DEFAULT now()
  )`);
  await run("projects.claude_plan", `ALTER TABLE projects ADD COLUMN IF NOT EXISTS claude_plan JSONB`);
  await run("projects.render_payload", `ALTER TABLE projects ADD COLUMN IF NOT EXISTS render_payload JSONB`);
  await run("projects.render_id", `ALTER TABLE projects ADD COLUMN IF NOT EXISTS render_id TEXT`);
  await run("projects.video_url", `ALTER TABLE projects ADD COLUMN IF NOT EXISTS video_url TEXT`);
  await run("voiceovers.audio_type", `ALTER TABLE voiceovers ADD COLUMN IF NOT EXISTS audio_type TEXT DEFAULT 'voiceover'`);
  await run("voiceovers.style_prompt", `ALTER TABLE voiceovers ADD COLUMN IF NOT EXISTS style_prompt TEXT`);

  // migrate-v3.sql — rich project brief fields
  await run("projects.scene", `ALTER TABLE projects ADD COLUMN IF NOT EXISTS scene TEXT`);
  await run("projects.people", `ALTER TABLE projects ADD COLUMN IF NOT EXISTS people TEXT`);
  await run("projects.location", `ALTER TABLE projects ADD COLUMN IF NOT EXISTS location TEXT`);
  await run("projects.occasion", `ALTER TABLE projects ADD COLUMN IF NOT EXISTS occasion TEXT`);
  await run("projects.voiceover_script", `ALTER TABLE projects ADD COLUMN IF NOT EXISTS voiceover_script TEXT`);
  await run("projects.text_overlays", `ALTER TABLE projects ADD COLUMN IF NOT EXISTS text_overlays TEXT[]`);
  await run("projects.music_style", `ALTER TABLE projects ADD COLUMN IF NOT EXISTS music_style TEXT`);

  const errors = results.filter(r => r.status === "error");
  return NextResponse.json({
    message: errors.length === 0 ? "All migrations applied successfully" : `${errors.length} steps had errors`,
    results,
  });
}
