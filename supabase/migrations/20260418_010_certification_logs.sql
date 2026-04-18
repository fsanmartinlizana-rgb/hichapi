-- ════════════════════════════════════════════════════════════════════════════
--  DTE Certification — Audit Logs Table
--
--  Comprehensive audit trail for all certification process events.
--  Tracks uploads, parsing, generation, signing, submission, and errors.
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS certification_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id   UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  
  -- Optional references to specific test set or case
  test_set_id     UUID REFERENCES test_sets(id) ON DELETE SET NULL,
  test_case_id    UUID REFERENCES test_cases(id) ON DELETE SET NULL,
  
  -- Event classification
  event_type      TEXT NOT NULL
    CHECK (event_type IN ('upload', 'parse', 'generate', 'sign', 'submit', 'status_check', 'error')),
  
  -- Event details (flexible JSONB for different event types)
  event_data      JSONB,
  
  -- User who triggered the event
  user_id         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Timestamp
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS certification_logs_restaurant_idx 
  ON certification_logs(restaurant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS certification_logs_set_idx 
  ON certification_logs(test_set_id) WHERE test_set_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS certification_logs_case_idx 
  ON certification_logs(test_case_id) WHERE test_case_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS certification_logs_event_type_idx 
  ON certification_logs(restaurant_id, event_type, created_at DESC);

-- RLS policies
ALTER TABLE certification_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_read_certification_logs" ON certification_logs;

CREATE POLICY "staff_read_certification_logs" ON certification_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.restaurant_id = certification_logs.restaurant_id
        AND tm.user_id = auth.uid()
        AND tm.active = true
    )
  );

-- Only system can write logs (no direct user writes)
DROP POLICY IF EXISTS "system_write_certification_logs" ON certification_logs;

CREATE POLICY "system_write_certification_logs" ON certification_logs
  FOR INSERT WITH CHECK (true);

COMMENT ON TABLE certification_logs IS
  'Audit trail for DTE certification process. Records all events including uploads, parsing, generation, signing, submission, status checks, and errors. Retained for compliance and debugging.';
