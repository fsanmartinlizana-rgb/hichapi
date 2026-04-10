-- ════════════════════════════════════════════════════════════════════════════
--  Sprint 12 — Restaurant public profile fields
--
--  Adds the missing columns the admin "Mi restaurante" page binds to and the
--  public landing page reads from. All columns are nullable / safe defaults so
--  existing rows keep working without backfill.
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS description     TEXT,
  ADD COLUMN IF NOT EXISTS phone           TEXT,
  ADD COLUMN IF NOT EXISTS website         TEXT,
  ADD COLUMN IF NOT EXISTS instagram       TEXT,
  ADD COLUMN IF NOT EXISTS capacity        INTEGER,
  ADD COLUMN IF NOT EXISTS tags            TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
  ADD COLUMN IF NOT EXISTS gallery_urls    TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
  ADD COLUMN IF NOT EXISTS hours           JSONB  NOT NULL DEFAULT '{}'::JSONB,
  ADD COLUMN IF NOT EXISTS profile_score   INTEGER NOT NULL DEFAULT 0
    CHECK (profile_score BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS profile_updated_at TIMESTAMPTZ;

-- Helpful indexes for discovery filtering
CREATE INDEX IF NOT EXISTS restaurants_tags_idx
  ON restaurants USING GIN (tags);

CREATE INDEX IF NOT EXISTS restaurants_profile_score_idx
  ON restaurants (profile_score DESC)
  WHERE active = true;

COMMENT ON COLUMN restaurants.hours IS
  'JSONB map: { "Lunes": {open, close, closed}, ... } — consumed by admin + landing.';
COMMENT ON COLUMN restaurants.profile_score IS
  '0-100 completion score recomputed by /api/restaurants/profile on every save.';
