-- Adds persistence tables for orchestration and A/B testing analysis.
-- Safe to run multiple times because each table uses IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS ab_test_runs (
  id UUID PRIMARY KEY,
  test_name VARCHAR(128) NOT NULL,
  control_workflow VARCHAR(64) NOT NULL,
  candidate_workflow VARCHAR(64) NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ NOT NULL,
  recommendation TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ab_test_cases (
  id UUID PRIMARY KEY,
  run_id UUID NOT NULL REFERENCES ab_test_runs(id) ON DELETE CASCADE,
  sample_index INTEGER NOT NULL,
  run_index INTEGER NOT NULL,
  control_success BOOLEAN NOT NULL,
  control_error TEXT,
  control_duration_ms INTEGER NOT NULL,
  control_tokens_used INTEGER NOT NULL,
  control_retry_count INTEGER NOT NULL,
  candidate_success BOOLEAN NOT NULL,
  candidate_error TEXT,
  candidate_duration_ms INTEGER NOT NULL,
  candidate_tokens_used INTEGER NOT NULL,
  candidate_retry_count INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ab_test_runs_test_name ON ab_test_runs(test_name);
CREATE INDEX IF NOT EXISTS idx_ab_test_cases_run_id ON ab_test_cases(run_id);
