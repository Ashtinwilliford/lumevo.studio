-- Migration V3: Rich project brief + voiceover support
-- Run this in Neo against your production database

-- 1. Add project brief fields to projects table
ALTER TABLE projects ADD COLUMN IF NOT EXISTS scene TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS people TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS occasion TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS voiceover_script TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS text_overlays TEXT[];
ALTER TABLE projects ADD COLUMN IF NOT EXISTS music_style TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS tone TEXT;
