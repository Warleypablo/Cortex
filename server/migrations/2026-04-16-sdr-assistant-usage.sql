CREATE TABLE IF NOT EXISTS cortex_core.sdr_assistant_usage (
  id              SERIAL PRIMARY KEY,
  user_id         INTEGER,
  query           TEXT,
  matched_company TEXT,
  tool_calls      INTEGER,
  tokens_total    INTEGER,
  duration_ms     INTEGER,
  created_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sdr_usage_user_date
  ON cortex_core.sdr_assistant_usage (user_id, created_at DESC);
