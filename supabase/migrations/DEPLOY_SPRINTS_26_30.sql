-- ════════════════════════════════════════════════════════════════════════════
--  DEPLOY SCRIPT — Sprints 26–30 (aplica las 4 migraciones en orden)
--  Copiá-pegá todo este bloque en Supabase Studio → SQL Editor → Run.
--  Es idempotente: podés correrlo múltiples veces.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 040: orders.delivered status + bill_requested_at ───────────────────────
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_status_check
  CHECK (status IN ('pending','confirmed','preparing','partial_ready','ready','paying','delivered','paid','cancelled'));

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS delivered_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS bill_requested_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS orders_delivered_idx
  ON orders (restaurant_id, status) WHERE status = 'delivered';

-- ── 041: waste_log soporta platos ──────────────────────────────────────────
ALTER TABLE waste_log
  ADD COLUMN IF NOT EXISTS menu_item_id UUID REFERENCES menu_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS item_type    TEXT NOT NULL DEFAULT 'stock'
    CHECK (item_type IN ('stock','plato'));

ALTER TABLE waste_log DROP CONSTRAINT IF EXISTS waste_log_reason_check;
ALTER TABLE waste_log ADD CONSTRAINT waste_log_reason_check
  CHECK (reason IN (
    'vencimiento','deterioro','rotura','error_prep','sobras','devolucion','otro',
    'merma','perdida',
    'plato_quemado','plato_frio','plato_mal_preparado','plato_devuelto','plato_caido'
  ));

ALTER TABLE waste_log DROP CONSTRAINT IF EXISTS waste_log_item_presence;
ALTER TABLE waste_log ADD CONSTRAINT waste_log_item_presence
  CHECK (stock_item_id IS NOT NULL OR menu_item_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS waste_log_menu_item_idx
  ON waste_log (restaurant_id, menu_item_id)
  WHERE menu_item_id IS NOT NULL;

-- ── 042: restaurant_zones ──────────────────────────────────────────────────
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

DROP POLICY IF EXISTS restaurant_zones_select ON restaurant_zones;
CREATE POLICY restaurant_zones_select
  ON restaurant_zones FOR SELECT
  USING (public.is_team_member(restaurant_id));

DROP POLICY IF EXISTS restaurant_zones_all ON restaurant_zones;
CREATE POLICY restaurant_zones_all
  ON restaurant_zones FOR ALL
  USING (public.is_admin_for(restaurant_id))
  WITH CHECK (public.is_admin_for(restaurant_id));

-- Seed a partir de zonas ya usadas en tables.zone
INSERT INTO restaurant_zones (restaurant_id, name, color, sort_order)
SELECT DISTINCT restaurant_id, zone, '#6B7280', 0
FROM tables
WHERE zone IS NOT NULL AND zone <> ''
ON CONFLICT DO NOTHING;

-- ── 043: custom_roles con permisos granulares ──────────────────────────────
CREATE TABLE IF NOT EXISTS custom_roles (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name          TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 40),
  description   TEXT,
  permissions   TEXT[] NOT NULL DEFAULT '{}',
  base_role     TEXT CHECK (base_role IN ('owner','admin','supervisor','garzon','cocina','anfitrion')),
  color         TEXT NOT NULL DEFAULT '#6B7280' CHECK (color ~ '^#[0-9A-Fa-f]{6}$'),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (restaurant_id, name)
);

CREATE INDEX IF NOT EXISTS custom_roles_rest_idx ON custom_roles (restaurant_id);

ALTER TABLE custom_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS custom_roles_select ON custom_roles;
CREATE POLICY custom_roles_select
  ON custom_roles FOR SELECT
  USING (public.is_team_member(restaurant_id));

DROP POLICY IF EXISTS custom_roles_all ON custom_roles;
CREATE POLICY custom_roles_all
  ON custom_roles FOR ALL
  USING (public.is_admin_for(restaurant_id))
  WITH CHECK (public.is_admin_for(restaurant_id));

ALTER TABLE team_members
  ADD COLUMN IF NOT EXISTS custom_role_id UUID REFERENCES custom_roles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS team_members_custom_role_idx
  ON team_members (custom_role_id) WHERE custom_role_id IS NOT NULL;

-- ════════════════════════════════════════════════════════════════════════════
-- ✅ DONE. Al terminar deberías ver 4 tablas/columnas nuevas:
--    • orders.status incluye 'delivered'
--    • orders.delivered_at + bill_requested_at
--    • waste_log.menu_item_id + item_type
--    • restaurant_zones (con RLS)
--    • custom_roles (con RLS)
--    • team_members.custom_role_id
-- ════════════════════════════════════════════════════════════════════════════
