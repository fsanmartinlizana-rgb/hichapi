-- ════════════════════════════════════════════════════════════════════════════
--  DTE Certification — Test Sets Table
--
--  Stores uploaded SET_DE_PRUEBAS files from SII for certification process.
--  Each test set contains multiple test cases that must be generated and
--  submitted to SII for approval.
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS test_sets (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id     UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  
  -- File metadata
  attention_number  TEXT NOT NULL,
  set_type          TEXT NOT NULL,
  file_name         TEXT NOT NULL,
  file_content      TEXT NOT NULL,
  
  -- Progress tracking
  case_count        INTEGER NOT NULL DEFAULT 0,
  generated_count   INTEGER NOT NULL DEFAULT 0,
  submitted_count   INTEGER NOT NULL DEFAULT 0,
  approved_count    INTEGER NOT NULL DEFAULT 0,
  
  -- Status workflow
  status            TEXT NOT NULL DEFAULT 'uploaded'
    CHECK (status IN ('uploaded', 'generating', 'generated', 'submitting', 'submitted', 'approved', 'rejected', 'deleted')),
  
  -- SII tracking
  track_id          TEXT,
  
  -- Audit fields
  uploaded_by       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Unique constraint: one attention number per restaurant
  CONSTRAINT unique_attention_number UNIQUE (restaurant_id, attention_number)
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS test_sets_restaurant_idx 
  ON test_sets(restaurant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS test_sets_status_idx 
  ON test_sets(restaurant_id, status);

-- RLS policies
ALTER TABLE test_sets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_read_test_sets" ON test_sets;
DROP POLICY IF EXISTS "owner_admin_write_test_sets" ON test_sets;

CREATE POLICY "staff_read_test_sets" ON test_sets
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.restaurant_id = test_sets.restaurant_id
        AND tm.user_id = auth.uid()
        AND tm.active = true
    )
  );

CREATE POLICY "owner_admin_write_test_sets" ON test_sets
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.restaurant_id = test_sets.restaurant_id
        AND tm.user_id = auth.uid()
        AND tm.active = true
        AND tm.role IN ('owner', 'admin')
    )
  );

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_test_sets_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS test_sets_updated_at_trigger ON test_sets;
CREATE TRIGGER test_sets_updated_at_trigger
  BEFORE UPDATE ON test_sets
  FOR EACH ROW EXECUTE FUNCTION update_test_sets_updated_at();

COMMENT ON TABLE test_sets IS
  'Stores SII test case files (SET_DE_PRUEBAS) uploaded for DTE certification. Each set contains multiple test cases that must be generated, signed, and submitted to SII.';
