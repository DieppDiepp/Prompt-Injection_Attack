CREATE TYPE redteam_round_status AS ENUM (
  'analysing',
  'analyst_ready',
  'strategizing',
  'strategist_ready',
  'leading',
  'lead_ready',
  'dispatching',
  'completed'
);

CREATE TABLE redteam_rounds (
  round_id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES redteam_sessions(session_id) ON DELETE CASCADE,
  round_number INTEGER NOT NULL,
  status redteam_round_status NOT NULL,
  analyst TEXT,
  strategies JSONB NOT NULL DEFAULT '[]'::jsonb,
  lead_reasoning TEXT,
  probe TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (session_id, round_number)
);

CREATE INDEX redteam_rounds_session_status_idx
  ON redteam_rounds (session_id, status, round_number DESC);
