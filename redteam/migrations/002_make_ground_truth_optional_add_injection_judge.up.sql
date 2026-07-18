CREATE TYPE redteam_injection_status AS ENUM ('safe', 'suspicious', 'injected', 'unavailable');

ALTER TABLE redteam_targets
  ALTER COLUMN protected_content DROP NOT NULL;

ALTER TABLE redteam_interactions
  ADD COLUMN injection_status redteam_injection_status NOT NULL DEFAULT 'unavailable',
  ADD COLUMN injection_reason TEXT NOT NULL DEFAULT 'Chưa chấm phản hồi này bằng GPT-4o-mini.',
  ADD COLUMN injection_evidence JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE redteam_sessions
  ADD COLUMN final_injection_status redteam_injection_status,
  ADD COLUMN final_injection_reason TEXT,
  ADD COLUMN final_injection_evidence JSONB;
