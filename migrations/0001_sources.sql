CREATE TABLE IF NOT EXISTS video_sources (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  url TEXT NOT NULL UNIQUE,
  enabled INTEGER NOT NULL DEFAULT 0 CHECK (enabled IN (0,1)),
  rights_confirmed INTEGER NOT NULL DEFAULT 0 CHECK (rights_confirmed IN (0,1)),
  origin TEXT NOT NULL DEFAULT 'manual',
  last_status TEXT NOT NULL DEFAULT 'untested',
  last_latency_ms INTEGER,
  last_checked_at TEXT,
  last_error TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_video_sources_enabled ON video_sources (enabled,rights_confirmed);
