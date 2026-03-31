CREATE TABLE IF NOT EXISTS ab_tests (
  id SERIAL PRIMARY KEY,
  test_id VARCHAR(100) UNIQUE,
  agent_type VARCHAR(50),
  variant_a VARCHAR(50),
  variant_b VARCHAR(50),
  status VARCHAR(20),
  started_at TIMESTAMP,
  completed_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ab_test_executions (
  id SERIAL PRIMARY KEY,
  test_id VARCHAR(100),
  variant VARCHAR(50),
  input_data JSONB,
  output_data JSONB,
  duration_ms INTEGER,
  tokens_used INTEGER,
  success BOOLEAN,
  validation_passed BOOLEAN,
  created_at TIMESTAMP
);
