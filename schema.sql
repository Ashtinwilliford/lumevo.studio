CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  subscription_tier TEXT DEFAULT 'trial',
  trial_started_at TIMESTAMP,
  elevenlabs_voice_id TEXT,
  voice_clone_name TEXT,
  created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS brand_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  brand_name TEXT,
  tone_summary TEXT,
  personality_summary TEXT,
  audience_summary TEXT,
  visual_style_summary TEXT,
  pacing_style TEXT,
  voice_preferences TEXT,
  music_preferences TEXT,
  hook_style TEXT,
  pattern_interrupt_style TEXT,
  emotional_arc_preference TEXT,
  music_genre_preference TEXT,
  creator_archetype TEXT,
  confidence_score INTEGER DEFAULT 0,
  learning_progress_percent INTEGER DEFAULT 0,
  upload_count INTEGER DEFAULT 0,
  generation_count INTEGER DEFAULT 0,
  feedback_summary JSONB,
  last_learned_at TIMESTAMP,
  updated_at TIMESTAMP DEFAULT now(),
  UNIQUE(user_id)
);

CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  status TEXT DEFAULT 'chatting',
  target_platform TEXT,
  vibe TEXT,
  target_duration INTEGER,
  generated_content JSONB,
  timeline JSONB,
  chat_history JSONB DEFAULT '[]',
  draft_state JSONB DEFAULT '{}',
  project_type TEXT,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  file_name TEXT NOT NULL,
  file_type TEXT,
  file_path TEXT,
  file_size INTEGER,
  ai_analysis JSONB,
  transcript_text TEXT,
  extracted_metadata JSONB,
  video_duration_sec FLOAT,
  created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS generated_contents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  content_type TEXT,
  content TEXT,
  created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS project_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  context JSONB,
  created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS learning_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  insight_type TEXT,
  insight_data JSONB,
  confidence FLOAT,
  source TEXT,
  created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS music_tracks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  artist TEXT,
  genre TEXT,
  vibe_tags TEXT[],
  bpm INTEGER,
  duration_sec INTEGER,
  url TEXT,
  created_at TIMESTAMP DEFAULT now()
);
