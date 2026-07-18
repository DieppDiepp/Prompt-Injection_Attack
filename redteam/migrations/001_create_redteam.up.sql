CREATE TYPE redteam_target_mode AS ENUM ('webhook', 'local');
CREATE TYPE redteam_session_status AS ENUM ('active', 'stopped', 'completed', 'leaked');
CREATE TYPE redteam_interaction_kind AS ENUM ('probe', 'benign');
CREATE TYPE redteam_leak_severity AS ENUM ('none', 'acknowledges', 'partial', 'verbatim');

CREATE TABLE redteam_targets (
  target_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  mode redteam_target_mode NOT NULL,
  webhook_url TEXT,
  system_prompt TEXT,
  protected_content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (
    (mode = 'webhook' AND webhook_url IS NOT NULL AND system_prompt IS NULL)
    OR (mode = 'local' AND system_prompt IS NOT NULL AND webhook_url IS NULL)
  )
);

CREATE TABLE redteam_sessions (
  session_id TEXT PRIMARY KEY,
  target_id TEXT NOT NULL REFERENCES redteam_targets(target_id) ON DELETE CASCADE,
  status redteam_session_status NOT NULL DEFAULT 'active',
  max_turns INTEGER NOT NULL CHECK (max_turns BETWEEN 1 AND 20),
  attack_turn_count INTEGER NOT NULL DEFAULT 0,
  final_severity redteam_leak_severity,
  final_reason TEXT,
  final_evidence JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX redteam_sessions_target_created_idx
  ON redteam_sessions (target_id, created_at DESC);

CREATE TABLE redteam_interactions (
  interaction_id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES redteam_sessions(session_id) ON DELETE CASCADE,
  ordinal INTEGER NOT NULL,
  round_number INTEGER,
  kind redteam_interaction_kind NOT NULL,
  prompt TEXT NOT NULL,
  target_response TEXT NOT NULL,
  analyst TEXT,
  strategies JSONB,
  lead_reasoning TEXT,
  detected_severity redteam_leak_severity NOT NULL,
  detector_evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
  target_latency_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (session_id, ordinal),
  UNIQUE (session_id, round_number)
);

CREATE INDEX redteam_interactions_session_ordinal_idx
  ON redteam_interactions (session_id, ordinal ASC);
