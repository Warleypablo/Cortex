-- Treinamento Interno — 5 tabelas: trilhas, vídeos, conclusões, likes, comentários

CREATE TABLE IF NOT EXISTS cortex_core.internal_video_tracks (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  drive_folder_id TEXT NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cortex_core.internal_videos (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  track_id VARCHAR NOT NULL REFERENCES cortex_core.internal_video_tracks(id),
  drive_file_id TEXT NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  mime_type TEXT,
  thumbnail_url TEXT,
  duracao_ms BIGINT,
  drive_modified_time TIMESTAMP,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_internal_videos_track_active
  ON cortex_core.internal_videos(track_id, is_active);

CREATE TABLE IF NOT EXISTS cortex_core.internal_video_completions (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id VARCHAR NOT NULL REFERENCES cortex_core.internal_videos(id) ON DELETE CASCADE,
  user_email VARCHAR(100) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_completion_user_video UNIQUE (video_id, user_email)
);

CREATE TABLE IF NOT EXISTS cortex_core.internal_video_likes (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id VARCHAR NOT NULL REFERENCES cortex_core.internal_videos(id) ON DELETE CASCADE,
  user_email VARCHAR(100) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_like_user_video UNIQUE (video_id, user_email)
);

CREATE TABLE IF NOT EXISTS cortex_core.internal_video_comments (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id VARCHAR NOT NULL REFERENCES cortex_core.internal_videos(id) ON DELETE CASCADE,
  user_email VARCHAR(100) NOT NULL,
  user_nome TEXT NOT NULL,
  conteudo TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_internal_comments_video_created
  ON cortex_core.internal_video_comments(video_id, created_at DESC);
