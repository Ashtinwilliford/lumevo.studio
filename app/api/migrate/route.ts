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

  // uploads optional columns
  await run("uploads.transcript_text", `ALTER TABLE uploads ADD COLUMN IF NOT EXISTS transcript_text TEXT`);
  await run("uploads.ai_analysis", `ALTER TABLE uploads ADD COLUMN IF NOT EXISTS ai_analysis JSONB`);
  await run("uploads.video_duration_sec", `ALTER TABLE uploads ADD COLUMN IF NOT EXISTS video_duration_sec FLOAT`);
  await run("uploads.thumb_path", `ALTER TABLE uploads ADD COLUMN IF NOT EXISTS thumb_path TEXT`);

  // migrate-v4.sql — project feedback + uploads project linkage
  await run("project_feedback table", `CREATE TABLE IF NOT EXISTS project_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    context JSONB,
    created_at TIMESTAMP DEFAULT now()
  )`);
  await run("uploads.project_id fk", `ALTER TABLE uploads ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE SET NULL`);

  // migrate-v5.sql — music track library
  await run("music_tracks table", `CREATE TABLE IF NOT EXISTS music_tracks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    artist TEXT,
    genre TEXT,
    vibe_tags TEXT[] DEFAULT '{}',
    bpm INT,
    duration_sec INT,
    url TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT now()
  )`);

  // migrate-v6.sql — Soundstripe metadata on cached tracks
  await run("music_tracks.source", `ALTER TABLE music_tracks ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'library'`);
  await run("music_tracks.soundstripe_id", `ALTER TABLE music_tracks ADD COLUMN IF NOT EXISTS soundstripe_id TEXT`);

  // Ensure unique constraint exists (table may have been created without it)
  await run("music_tracks.url_unique", `CREATE UNIQUE INDEX IF NOT EXISTS music_tracks_url_unique ON music_tracks(url)`);

  await run("seed_music_tracks", `INSERT INTO music_tracks (name, artist, genre, vibe_tags, bpm, duration_sec, url) VALUES
    ('Acoustic Breeze', 'Bensound', 'folk', ARRAY['chill','acoustic','gentle','warm'], 75, 200, 'https://www.bensound.com/bensound-music/bensound-acousticbreeze.mp3'),
    ('Ukulele', 'Bensound', 'folk', ARRAY['warm','happy','ukulele','sunny','light'], 118, 120, 'https://www.bensound.com/bensound-music/bensound-ukulele.mp3'),
    ('Sunny', 'Bensound', 'country', ARRAY['sunny','upbeat','warm','cheerful','country'], 122, 132, 'https://www.bensound.com/bensound-music/bensound-sunny.mp3'),
    ('Tenderness', 'Bensound', 'emotional', ARRAY['emotional','tender','warm','gentle','intimate'], 68, 224, 'https://www.bensound.com/bensound-music/bensound-tenderness.mp3'),
    ('Happiness', 'Bensound', 'folk', ARRAY['happy','upbeat','warm','folk','bright'], 126, 199, 'https://www.bensound.com/bensound-music/bensound-happiness.mp3')
  ON CONFLICT (url) DO NOTHING`);

  const errors = results.filter(r => r.status === "error");
  return NextResponse.json({
    message: errors.length === 0 ? "All migrations applied successfully" : `${errors.length} steps had errors`,
    results,
  });
}
