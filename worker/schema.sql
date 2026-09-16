-- DUKE LAB — D1 schema (the fleet ledger)
-- Apply: npx wrangler d1 execute duke-lab-db --file=schema.sql --remote
-- (use without --remote for local dev)

CREATE TABLE IF NOT EXISTS musicians (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  blurb       TEXT,
  description TEXT,
  centroid    TEXT NOT NULL,           -- JSON: 16 feature keys → [0,1]
  progression TEXT DEFAULT 'duke',
  source      TEXT,                    -- designed | evolved
  plays       INTEGER DEFAULT 0,
  created_at  TEXT
);
CREATE INDEX IF NOT EXISTS idx_musicians_source ON musicians (source, created_at);

CREATE TABLE IF NOT EXISTS judges (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT,
  weights     TEXT NOT NULL,           -- JSON: subset of 16 feature keys → 0..3
  floor       REAL DEFAULT 0,
  voice       TEXT,
  source      TEXT,                    -- llm | local-fallback
  uses        INTEGER DEFAULT 0,
  created_at  TEXT
);

CREATE TABLE IF NOT EXISTS runs (
  id         TEXT PRIMARY KEY,
  seed       TEXT NOT NULL,
  canon      TEXT,                     -- artist key or designed id
  judge      TEXT,                     -- persona key or judge id
  verdict    TEXT,                     -- CONVERGED | HONEST GAP
  rounds     INTEGER,
  sigma      REAL,
  asks       TEXT,                     -- JSON array of free-text nudges
  banter     REAL,                     -- duet fitness, when the run was a duet
  created_at TEXT,
  ip         INTEGER                   -- fnv1a hash — a fingerprint, not an identity
);
CREATE INDEX IF NOT EXISTS idx_runs_created ON runs (created_at);
