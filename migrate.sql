-- Migration: Add missing columns and tables
-- Run this in Neo against your production database

-- 1. Add missing columns to uploads table
ALTER TABLE uploads ADD COLUMN IF NOT EXISTS mime_type TEXT;
ALTER TABLE uploads ADD COLUMN IF NOT EXISTS thumb_path TEXT;
ALTER TABLE uploads ADD COLUMN IF NOT EXISTS analysis_status TEXT DEFAULT 'ready';

-- 2. Add missing columns to projects table
ALTER TABLE projects ADD COLUMN IF NOT EXISTS prompt_text TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS render_path TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS tone TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS audience_goal TEXT;

-- 3. Add missing columns to brand_profiles table
ALTER TABLE brand_profiles ADD COLUMN IF NOT EXISTS cta_style TEXT;
ALTER TABLE brand_profiles ADD COLUMN IF NOT EXISTS avg_pacing_bpm FLOAT;

-- 4. Create voiceovers table
CREATE TABLE IF NOT EXISTS voiceovers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  script_content TEXT,
  provider_voice_id TEXT,
  audio_url TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT now()
);
