-- ── S28.2: Zonas custom configurables por restaurante ────────────────────
-- Antes: zona era un enum hardcoded (interior/terraza/barra).
-- Ahora: cada restaurante crea sus zonas con nombre y color a gusto.

-- Helper RLS: is_team_member (definida idempotente para que esta migración
-- no dependa del orden de aplicación).
CREATE OR REPLACE FUNCTION public.is_team_member(p_restaurant_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_members
    WHERE user_id = auth.uid()
      AND restaurant_id = p_restaurant_id
      AND COALESCE(active, true) = true
  ) OR (SELECT public.is_super_admin());
$$;

CREATE TABLE IF NOT EXISTS restaurant_zones (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name          TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 40),
  color         TEXT NOT NULL DEFAULT '#6B7280'
                CHECK (color ~ '^#[0-9A-Fa-f]{6}$'),
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (restaurant_id, name)
);

CREATE INDEX IF NOT EXISTS restaurant_zones_rest_idx
  ON restaurant_zones (restaurant_id, sort_order);

ALTER TABLE restaurant_zones ENABLE ROW LEVEL SECURITY;

-- Read: anyone in the restaurant team can see zones (needed for mesas UI)
DROP POLICY IF EXISTS restaurant_zones_select ON restaurant_zones;
CREATE POLICY restaurant_zones_select
  ON restaurant_zones FOR SELECT
  USING (public.is_team_member(restaurant_id));

-- Write: only owner/admin via service role or RLS
DROP POLICY IF EXISTS restaurant_zones_all ON restaurant_zones;
CREATE POLICY restaurant_zones_all
  ON restaurant_zones FOR ALL
  USING (public.is_admin_for(restaurant_id))
  WITH CHECK (public.is_admin_for(restaurant_id));

COMMENT ON TABLE restaurant_zones IS
  'Zonas custom (interior, terraza, salón privado, etc) que el admin crea para organizar mesas.';

-- Seed default zones for any existing restaurants that have table.zone filled in
INSERT INTO restaurant_zones (restaurant_id, name, color, sort_order)
SELECT DISTINCT restaurant_id, zone, '#6B7280', 0
FROM tables
WHERE zone IS NOT NULL AND zone <> ''
ON CONFLICT DO NOTHING;
