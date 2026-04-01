-- Migration V2: Creator style profiles + generation logs
-- Run this in Neo against your production database

-- 1. Creator style profiles (replaces loose brand_profile fields for video style)
CREATE TABLE IF NOT EXISTS creator_styles (
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
);

-- 2. Generation logs - every stage of every render
CREATE TABLE IF NOT EXISTS generation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  stage TEXT NOT NULL,
  payload JSONB,
  result JSONB,
  error TEXT,
  duration_ms INTEGER,
  created_at TIMESTAMP DEFAULT now()
);

-- 3. Add claude_plan and render_payload to projects for debugging
ALTER TABLE projects ADD COLUMN IF NOT EXISTS claude_plan JSONB;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS render_payload JSONB;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS render_id TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS video_url TEXT;

-- 4. Add audio_url to voiceovers for ElevenLabs music
ALTER TABLE voiceovers ADD COLUMN IF NOT EXISTS audio_type TEXT DEFAULT 'voiceover';
ALTER TABLE voiceovers ADD COLUMN IF NOT EXISTS style_prompt TEXT;
