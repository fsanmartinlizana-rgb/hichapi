-- ════════════════════════════════════════════════════════════════════════════
-- 035 — Floorplan position for tables
-- ════════════════════════════════════════════════════════════════════════════
-- Adds (x, y) coordinates so the user can drag mesas around in /mesas and
-- the layout persists. Coordinates are stored in pixels relative to the
-- floorplan canvas (0,0 = top-left).
--
-- Existing tables get NULL coordinates and the UI auto-arranges them in a
-- default grid until the user drags them once.
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.tables
  ADD COLUMN IF NOT EXISTS pos_x NUMERIC,
  ADD COLUMN IF NOT EXISTS pos_y NUMERIC;

-- Optional: zone bounding box, useful later if we want per-zone canvases.
-- (Left as a comment for future use.)
-- ALTER TABLE public.tables ADD COLUMN IF NOT EXISTS canvas_zone TEXT;

COMMENT ON COLUMN public.tables.pos_x IS 'X coordinate in floorplan canvas (px). NULL = auto-arranged.';
COMMENT ON COLUMN public.tables.pos_y IS 'Y coordinate in floorplan canvas (px). NULL = auto-arranged.';
