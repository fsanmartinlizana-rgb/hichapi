-- ── S25.12: Restaurant photo gallery ─────────────────────────────────────
-- Allow each restaurant to expose up to N gallery photos on its public
-- landing page. Stored as an array of URLs pointing to Supabase Storage.

ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS gallery_urls TEXT[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN restaurants.gallery_urls IS
  'Up to 12 gallery photos (dish / venue) shown on the public landing page.';
