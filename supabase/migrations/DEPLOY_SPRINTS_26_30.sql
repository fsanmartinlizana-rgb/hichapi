-- ════════════════════════════════════════════════════════════════════════════
--  DEPLOY SCRIPT — Sprints 26-31 (incluye loyalty v1)
--  Copia-pega TODO este bloque en Supabase Studio → SQL Editor → Run.
--  Es idempotente: podes correrlo múltiples veces.
-- ════════════════════════════════════════════════════════════════════════════

-- ── Helper RLS function (necesaria para 042/043/044) ───────────────────────
CREATE OR REPLACE FUNCTION public.is_team_member(p_restaurant_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_members
    WHERE user_id = auth.uid()
      AND restaurant_id = p_restaurant_id
      AND COALESCE(active, true) = true
  ) OR (SELECT public.is_super_admin());
$$;

-- ── 035: tables.pos_x / pos_y (floorplan positions) ────────────────────────
ALTER TABLE public.tables
  ADD COLUMN IF NOT EXISTS pos_x NUMERIC,
  ADD COLUMN IF NOT EXISTS pos_y NUMERIC;

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
  ADD COLUMN IF NOT EXISTS menu_item_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'waste_log_menu_item_fk'
  ) THEN
    ALTER TABLE waste_log
      ADD CONSTRAINT waste_log_menu_item_fk
      FOREIGN KEY (menu_item_id)
      REFERENCES menu_items(id)
      ON DELETE SET NULL;
  END IF;
END $$;

ALTER TABLE waste_log
  ADD COLUMN IF NOT EXISTS item_type TEXT NOT NULL DEFAULT 'stock';

ALTER TABLE waste_log DROP CONSTRAINT IF EXISTS waste_log_item_type_check;
ALTER TABLE waste_log ADD CONSTRAINT waste_log_item_type_check
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

-- Dos pasos: agregar columna primero, luego FK (evita problemas de parseo
-- con ADD COLUMN IF NOT EXISTS … REFERENCES … ON DELETE … en algunas versiones).
ALTER TABLE team_members
  ADD COLUMN IF NOT EXISTS custom_role_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'team_members_custom_role_fk'
  ) THEN
    ALTER TABLE team_members
      ADD CONSTRAINT team_members_custom_role_fk
      FOREIGN KEY (custom_role_id)
      REFERENCES custom_roles(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS team_members_custom_role_idx
  ON team_members (custom_role_id) WHERE custom_role_id IS NOT NULL;

-- ── 044: loyalty / fidelización v1 ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS loyalty_programs (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id            UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name                     TEXT NOT NULL DEFAULT 'Programa de fidelidad',
  active                   BOOLEAN NOT NULL DEFAULT false,
  mechanic                 TEXT NOT NULL DEFAULT 'stamps'
                           CHECK (mechanic IN ('stamps','points','both')),
  stamps_per_reward        INTEGER NOT NULL DEFAULT 10 CHECK (stamps_per_reward > 0),
  stamp_trigger            TEXT NOT NULL DEFAULT 'per_visit'
                           CHECK (stamp_trigger IN ('per_visit','per_order','per_amount')),
  stamp_amount_threshold   INTEGER,
  points_per_clp           NUMERIC NOT NULL DEFAULT 0.01,
  welcome_points           INTEGER NOT NULL DEFAULT 0,
  multi_location           BOOLEAN NOT NULL DEFAULT false,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (restaurant_id)
);

CREATE INDEX IF NOT EXISTS loyalty_programs_rest_idx ON loyalty_programs (restaurant_id);
ALTER TABLE loyalty_programs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS loyalty_programs_select ON loyalty_programs;
CREATE POLICY loyalty_programs_select ON loyalty_programs FOR SELECT
  USING (public.is_team_member(restaurant_id) OR active = true);
DROP POLICY IF EXISTS loyalty_programs_all ON loyalty_programs;
CREATE POLICY loyalty_programs_all ON loyalty_programs FOR ALL
  USING (public.is_admin_for(restaurant_id))
  WITH CHECK (public.is_admin_for(restaurant_id));

CREATE TABLE IF NOT EXISTS loyalty_tiers (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id        UUID NOT NULL REFERENCES loyalty_programs(id) ON DELETE CASCADE,
  restaurant_id     UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  points_threshold  INTEGER NOT NULL DEFAULT 0,
  benefits          JSONB NOT NULL DEFAULT '{}'::jsonb,
  sort_order        INTEGER NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS loyalty_tiers_program_idx ON loyalty_tiers (program_id, sort_order);
ALTER TABLE loyalty_tiers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS loyalty_tiers_select ON loyalty_tiers;
CREATE POLICY loyalty_tiers_select ON loyalty_tiers FOR SELECT USING (true);
DROP POLICY IF EXISTS loyalty_tiers_all ON loyalty_tiers;
CREATE POLICY loyalty_tiers_all ON loyalty_tiers FOR ALL
  USING (public.is_admin_for(restaurant_id))
  WITH CHECK (public.is_admin_for(restaurant_id));

CREATE TABLE IF NOT EXISTS stamp_cards (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  program_id            UUID NOT NULL REFERENCES loyalty_programs(id) ON DELETE CASCADE,
  restaurant_id         UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  current_stamps        INTEGER NOT NULL DEFAULT 0 CHECK (current_stamps >= 0),
  total_stamps_earned   INTEGER NOT NULL DEFAULT 0 CHECK (total_stamps_earned >= 0),
  last_stamp_at         TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, program_id)
);
CREATE INDEX IF NOT EXISTS stamp_cards_user_idx ON stamp_cards (user_id, restaurant_id);
ALTER TABLE stamp_cards ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS stamp_cards_select_self ON stamp_cards;
CREATE POLICY stamp_cards_select_self ON stamp_cards FOR SELECT
  USING (user_id = auth.uid() OR public.is_team_member(restaurant_id));
DROP POLICY IF EXISTS stamp_cards_all_admin ON stamp_cards;
CREATE POLICY stamp_cards_all_admin ON stamp_cards FOR ALL
  USING (public.is_admin_for(restaurant_id))
  WITH CHECK (public.is_admin_for(restaurant_id));

CREATE TABLE IF NOT EXISTS customer_loyalty (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  program_id        UUID NOT NULL REFERENCES loyalty_programs(id) ON DELETE CASCADE,
  restaurant_id     UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  points_balance    INTEGER NOT NULL DEFAULT 0 CHECK (points_balance >= 0),
  tier_id           UUID REFERENCES loyalty_tiers(id) ON DELETE SET NULL,
  lifetime_points   INTEGER NOT NULL DEFAULT 0 CHECK (lifetime_points >= 0),
  last_visit_at     TIMESTAMPTZ,
  welcome_granted   BOOLEAN NOT NULL DEFAULT false,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, program_id)
);
CREATE INDEX IF NOT EXISTS customer_loyalty_user_idx ON customer_loyalty (user_id, restaurant_id);
ALTER TABLE customer_loyalty ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS customer_loyalty_select_self ON customer_loyalty;
CREATE POLICY customer_loyalty_select_self ON customer_loyalty FOR SELECT
  USING (user_id = auth.uid() OR public.is_team_member(restaurant_id));
DROP POLICY IF EXISTS customer_loyalty_all_admin ON customer_loyalty;
CREATE POLICY customer_loyalty_all_admin ON customer_loyalty FOR ALL
  USING (public.is_admin_for(restaurant_id))
  WITH CHECK (public.is_admin_for(restaurant_id));

CREATE TABLE IF NOT EXISTS points_ledger (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  program_id      UUID NOT NULL REFERENCES loyalty_programs(id) ON DELETE CASCADE,
  restaurant_id   UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  type            TEXT NOT NULL CHECK (type IN ('earn','redeem','expire','bonus','adjust')),
  amount          INTEGER NOT NULL,
  order_id        UUID REFERENCES orders(id) ON DELETE SET NULL,
  description     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS points_ledger_user_idx ON points_ledger (user_id, restaurant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS points_ledger_order_idx ON points_ledger (order_id) WHERE order_id IS NOT NULL;
ALTER TABLE points_ledger ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS points_ledger_select_self ON points_ledger;
CREATE POLICY points_ledger_select_self ON points_ledger FOR SELECT
  USING (user_id = auth.uid() OR public.is_team_member(restaurant_id));
DROP POLICY IF EXISTS points_ledger_all_admin ON points_ledger;
CREATE POLICY points_ledger_all_admin ON points_ledger FOR ALL
  USING (public.is_admin_for(restaurant_id))
  WITH CHECK (public.is_admin_for(restaurant_id));

CREATE TABLE IF NOT EXISTS multiplier_rules (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id        UUID NOT NULL REFERENCES loyalty_programs(id) ON DELETE CASCADE,
  restaurant_id     UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  type              TEXT NOT NULL CHECK (type IN ('day_of_week','time_range','category','item')),
  config            JSONB NOT NULL DEFAULT '{}'::jsonb,
  multiplier_value  NUMERIC NOT NULL DEFAULT 1.0 CHECK (multiplier_value > 0),
  active            BOOLEAN NOT NULL DEFAULT true,
  active_from       DATE,
  active_to         DATE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS multiplier_rules_program_idx ON multiplier_rules (program_id, active);
ALTER TABLE multiplier_rules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS multiplier_rules_select ON multiplier_rules;
CREATE POLICY multiplier_rules_select ON multiplier_rules FOR SELECT
  USING (public.is_team_member(restaurant_id));
DROP POLICY IF EXISTS multiplier_rules_all_admin ON multiplier_rules;
CREATE POLICY multiplier_rules_all_admin ON multiplier_rules FOR ALL
  USING (public.is_admin_for(restaurant_id))
  WITH CHECK (public.is_admin_for(restaurant_id));

CREATE TABLE IF NOT EXISTS trigger_rules (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id        UUID NOT NULL REFERENCES loyalty_programs(id) ON DELETE CASCADE,
  restaurant_id     UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  event             TEXT NOT NULL CHECK (event IN ('birthday','inactivity','tier_upgrade','milestone','first_visit')),
  days_inactive     INTEGER,
  reward_id         UUID,
  message_template  TEXT,
  active            BOOLEAN NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS trigger_rules_program_idx ON trigger_rules (program_id, active);
ALTER TABLE trigger_rules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS trigger_rules_select ON trigger_rules;
CREATE POLICY trigger_rules_select ON trigger_rules FOR SELECT
  USING (public.is_team_member(restaurant_id));
DROP POLICY IF EXISTS trigger_rules_all_admin ON trigger_rules;
CREATE POLICY trigger_rules_all_admin ON trigger_rules FOR ALL
  USING (public.is_admin_for(restaurant_id))
  WITH CHECK (public.is_admin_for(restaurant_id));

CREATE TABLE IF NOT EXISTS reward_catalog (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id      UUID NOT NULL REFERENCES loyalty_programs(id) ON DELETE CASCADE,
  restaurant_id   UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  type            TEXT NOT NULL CHECK (type IN ('free_item','discount_percent','discount_amount','free_category')),
  name            TEXT NOT NULL,
  description     TEXT,
  value           JSONB NOT NULL DEFAULT '{}'::jsonb,
  points_cost     INTEGER,
  stamps_cost     INTEGER,
  valid_days      JSONB,
  active          BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (points_cost IS NOT NULL OR stamps_cost IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS reward_catalog_program_idx ON reward_catalog (program_id, active);
ALTER TABLE reward_catalog ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS reward_catalog_select ON reward_catalog;
CREATE POLICY reward_catalog_select ON reward_catalog FOR SELECT USING (true);
DROP POLICY IF EXISTS reward_catalog_all_admin ON reward_catalog;
CREATE POLICY reward_catalog_all_admin ON reward_catalog FOR ALL
  USING (public.is_admin_for(restaurant_id))
  WITH CHECK (public.is_admin_for(restaurant_id));

CREATE TABLE IF NOT EXISTS customer_coupons (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  restaurant_id       UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  reward_id           UUID NOT NULL REFERENCES reward_catalog(id) ON DELETE CASCADE,
  code                TEXT NOT NULL UNIQUE,
  status              TEXT NOT NULL DEFAULT 'active'
                      CHECK (status IN ('active','redeemed','expired','revoked')),
  issued_by           TEXT NOT NULL DEFAULT 'system'
                      CHECK (issued_by IN ('admin','system','garzon')),
  issued_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at          TIMESTAMPTZ,
  redeemed_at         TIMESTAMPTZ,
  redeemed_order_id   UUID REFERENCES orders(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS customer_coupons_user_idx
  ON customer_coupons (user_id, restaurant_id, status);
CREATE INDEX IF NOT EXISTS customer_coupons_code_idx
  ON customer_coupons (code) WHERE status = 'active';
ALTER TABLE customer_coupons ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS customer_coupons_select_self ON customer_coupons;
CREATE POLICY customer_coupons_select_self ON customer_coupons FOR SELECT
  USING (user_id = auth.uid() OR public.is_team_member(restaurant_id));
DROP POLICY IF EXISTS customer_coupons_all_admin ON customer_coupons;
CREATE POLICY customer_coupons_all_admin ON customer_coupons FOR ALL
  USING (public.is_admin_for(restaurant_id))
  WITH CHECK (public.is_admin_for(restaurant_id));

CREATE TABLE IF NOT EXISTS customer_wallet (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  restaurant_id   UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  balance_clp     INTEGER NOT NULL DEFAULT 0,
  type            TEXT NOT NULL DEFAULT 'credit'
                  CHECK (type IN ('credit','refund')),
  active          BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, restaurant_id)
);
CREATE INDEX IF NOT EXISTS customer_wallet_user_idx ON customer_wallet (user_id, restaurant_id);
ALTER TABLE customer_wallet ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS customer_wallet_select_self ON customer_wallet;
CREATE POLICY customer_wallet_select_self ON customer_wallet FOR SELECT
  USING (user_id = auth.uid() OR public.is_team_member(restaurant_id));
DROP POLICY IF EXISTS customer_wallet_all_admin ON customer_wallet;
CREATE POLICY customer_wallet_all_admin ON customer_wallet FOR ALL
  USING (public.is_admin_for(restaurant_id))
  WITH CHECK (public.is_admin_for(restaurant_id));

-- ════════════════════════════════════════════════════════════════════════════
-- 045 — Loyalty: cupones emitidos por email (pre-registro)
-- ════════════════════════════════════════════════════════════════════════════
ALTER TABLE customer_coupons
  ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE customer_coupons
  ADD COLUMN IF NOT EXISTS customer_email TEXT,
  ADD COLUMN IF NOT EXISTS customer_name  TEXT,
  ADD COLUMN IF NOT EXISTS claimed_at     TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'customer_coupons_user_or_email_chk'
  ) THEN
    ALTER TABLE customer_coupons
      ADD CONSTRAINT customer_coupons_user_or_email_chk
      CHECK (user_id IS NOT NULL OR customer_email IS NOT NULL);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS customer_coupons_email_idx
  ON customer_coupons (restaurant_id, lower(customer_email), status)
  WHERE customer_email IS NOT NULL AND status = 'active';

DROP POLICY IF EXISTS customer_coupons_select_self ON customer_coupons;
CREATE POLICY customer_coupons_select_self ON customer_coupons FOR SELECT
  USING (
    user_id = auth.uid()
    OR (
      customer_email IS NOT NULL
      AND lower(customer_email) = lower((SELECT email FROM auth.users WHERE id = auth.uid()))
    )
    OR public.is_team_member(restaurant_id)
  );

CREATE OR REPLACE FUNCTION public.get_user_id_by_email(p_email TEXT)
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT id FROM auth.users WHERE lower(email) = lower(p_email) LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.claim_email_coupons(p_user_id UUID)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_email  TEXT;
  v_count  INTEGER;
BEGIN
  SELECT email INTO v_email FROM auth.users WHERE id = p_user_id;
  IF v_email IS NULL THEN RETURN 0; END IF;

  UPDATE customer_coupons
     SET user_id    = p_user_id,
         claimed_at = now()
   WHERE user_id IS NULL
     AND status = 'active'
     AND lower(customer_email) = lower(v_email);

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END $$;

-- ════════════════════════════════════════════════════════════════════════════
-- ✅ DONE. Tablas / columnas creadas:
--    • is_team_member(restaurant_id) helper
--    • tables.pos_x, tables.pos_y
--    • orders.status incluye 'delivered' + delivered_at + bill_requested_at
--    • waste_log.menu_item_id + item_type
--    • restaurant_zones (RLS)
--    • custom_roles (RLS) + team_members.custom_role_id
--    • loyalty_programs, loyalty_tiers, stamp_cards, customer_loyalty,
--      points_ledger, multiplier_rules, trigger_rules, reward_catalog,
--      customer_coupons, customer_wallet (todas con RLS)
--    • customer_coupons: user_id nullable + customer_email/name/claimed_at
--      + get_user_id_by_email() + claim_email_coupons() RPCs
-- ════════════════════════════════════════════════════════════════════════════
