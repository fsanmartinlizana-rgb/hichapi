-- Add read_at column to notifications if it doesn't exist
-- This column tracks when a notification was read by the user

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS dedupe_key TEXT;

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS action_url TEXT;

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS action_label TEXT;

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- Backfill: if is_read is true and read_at is null, set read_at to now
UPDATE notifications
  SET read_at = COALESCE(created_at, NOW())
  WHERE is_read = true AND read_at IS NULL;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
