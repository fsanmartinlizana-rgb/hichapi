-- ════════════════════════════════════════════════════════════════════════════
--  Fix unique constraint on attention_number to allow re-upload after delete
--
--  Changes the unique constraint to a partial unique index that only applies
--  to non-deleted test sets. This allows users to re-upload the same file
--  after deleting a previous test set.
-- ════════════════════════════════════════════════════════════════════════════

-- Drop the old unique constraint
ALTER TABLE test_sets DROP CONSTRAINT IF EXISTS unique_attention_number;

-- Create a partial unique index that excludes deleted sets
CREATE UNIQUE INDEX IF NOT EXISTS unique_attention_number_active 
  ON test_sets(restaurant_id, attention_number) 
  WHERE status != 'deleted';

COMMENT ON INDEX unique_attention_number_active IS
  'Ensures attention numbers are unique per restaurant, but only for non-deleted test sets. This allows re-uploading the same file after deletion.';
