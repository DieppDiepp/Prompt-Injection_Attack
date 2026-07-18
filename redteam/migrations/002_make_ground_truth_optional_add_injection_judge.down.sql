ALTER TABLE redteam_sessions
  DROP COLUMN final_injection_evidence,
  DROP COLUMN final_injection_reason,
  DROP COLUMN final_injection_status;

ALTER TABLE redteam_interactions
  DROP COLUMN injection_evidence,
  DROP COLUMN injection_reason,
  DROP COLUMN injection_status;

ALTER TABLE redteam_targets
  ALTER COLUMN protected_content SET NOT NULL;

DROP TYPE redteam_injection_status;
