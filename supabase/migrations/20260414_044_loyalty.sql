-- ════════════════════════════════════════════════════════════════════════════
-- 044 — Loyalty / Fidelización v1
-- ════════════════════════════════════════════════════════════════════════════
-- Multi-tenant: every row is scoped by restaurant_id with RLS.
-- Mechanics supported: stamps (sellos) and points (puntos).
-- Stub for customer_wallet (saldo CLP) — schema only, no logic in v1.
-- ════════════════════════════════════════════════════════════════════════════

-- ── Helper: is_team_member ──────────────────────────────────────────────────
-- Used by RLS policies in 042/043/044. Returns true if the current auth user
-- is an active member (any role) of the given restaurant.
CREATE OR REPLACE FUNCTION public.is_team_member(p_restaurant_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_members
    WHERE user_id = auth.uid()
      AND restaurant_id = p_restaurant_id
      AND COALESCE(active, true) = true
  ) OR (SELECT public.is_super_admin());
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- loyalty_programs — un programa por restaurante
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS loyalty_programs (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id            UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name                     TEXT NOT NULL DEFAULT 'Programa de fidelidad',
  active                   BOOLEAN NOT NULL DEFAULT false,
  mechanic                 TEXT NOT NULL DEFAULT 'stamps'
                           CHECK (mechanic IN ('stamps','points','both')),
  -- SELLOS
  stamps_per_reward        INTEGER NOT NULL DEFAULT 10 CHECK (stamps_per_reward > 0),
  stamp_trigger            TEXT NOT NULL DEFAULT 'per_visit'
                           CHECK (stamp_trigger IN ('per_visit','per_order','per_amount')),
  stamp_amount_threshold   INTEGER,    -- en CLP, requerido si trigger=per_amount
  -- PUNTOS
  points_per_clp           NUMERIC NOT NULL DEFAULT 0.01,  -- 1 punto cada $100
  welcome_points           INTEGER NOT NULL DEFAULT 0,
  multi_location           BOOLEAN NOT NULL DEFAULT false,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (restaurant_id)   -- un solo programa por restaurante
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

-- ─────────────────────────────────────────────────────────────────────────────
-- loyalty_tiers — niveles opcionales (silver/gold/diamond, etc)
-- ─────────────────────────────────────────────────────────────────────────────
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

-- ─────────────────────────────────────────────────────────────────────────────
-- stamp_cards — tarjeta de sellos por (user, program)
-- ─────────────────────────────────────────────────────────────────────────────
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

-- ─────────────────────────────────────────────────────────────────────────────
-- customer_loyalty — saldo de puntos por (user, program)
-- ─────────────────────────────────────────────────────────────────────────────
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

-- ─────────────────────────────────────────────────────────────────────────────
-- points_ledger — historial inmutable de puntos
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS points_ledger (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  program_id      UUID NOT NULL REFERENCES loyalty_programs(id) ON DELETE CASCADE,
  restaurant_id   UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  type            TEXT NOT NULL CHECK (type IN ('earn','redeem','expire','bonus','adjust')),
  amount          INTEGER NOT NULL,        -- puede ser negativo en redeem/expire
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

-- ─────────────────────────────────────────────────────────────────────────────
-- multiplier_rules — bonos por día/horario/categoría
-- ─────────────────────────────────────────────────────────────────────────────
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

-- ─────────────────────────────────────────────────────────────────────────────
-- trigger_rules — eventos automáticos (cumpleaños, inactividad, milestones)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS trigger_rules (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id        UUID NOT NULL REFERENCES loyalty_programs(id) ON DELETE CASCADE,
  restaurant_id     UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  event             TEXT NOT NULL CHECK (event IN ('birthday','inactivity','tier_upgrade','milestone','first_visit')),
  days_inactive     INTEGER,
  reward_id         UUID,            -- FK soft a reward_catalog (definida luego)
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

-- ─────────────────────────────────────────────────────────────────────────────
-- reward_catalog — recompensas canjeables por puntos o sellos
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reward_catalog (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id      UUID NOT NULL REFERENCES loyalty_programs(id) ON DELETE CASCADE,
  restaurant_id   UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  type            TEXT NOT NULL CHECK (type IN ('free_item','discount_percent','discount_amount','free_category')),
  name            TEXT NOT NULL,
  description     TEXT,
  value           JSONB NOT NULL DEFAULT '{}'::jsonb,    -- ej {amount: 5000} o {percent: 20} o {menu_item_id: "..."}
  points_cost     INTEGER,
  stamps_cost     INTEGER,
  valid_days      JSONB,    -- ej {monday: true, tuesday: true, ...} | null = todos
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

-- ─────────────────────────────────────────────────────────────────────────────
-- customer_coupons — cupones individuales emitidos a usuarios
-- ─────────────────────────────────────────────────────────────────────────────
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

-- ─────────────────────────────────────────────────────────────────────────────
-- customer_wallet — stub (saldo en CLP). Sin lógica en v1.
-- ─────────────────────────────────────────────────────────────────────────────
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

CREATE INDEX IF NOT EXISTS customer_wallet_user_idx
  ON customer_wallet (user_id, restaurant_id);

ALTER TABLE customer_wallet ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS customer_wallet_select_self ON customer_wallet;
CREATE POLICY customer_wallet_select_self ON customer_wallet FOR SELECT
  USING (user_id = auth.uid() OR public.is_team_member(restaurant_id));

DROP POLICY IF EXISTS customer_wallet_all_admin ON customer_wallet;
CREATE POLICY customer_wallet_all_admin ON customer_wallet FOR ALL
  USING (public.is_admin_for(restaurant_id))
  WITH CHECK (public.is_admin_for(restaurant_id));

COMMENT ON TABLE loyalty_programs IS 'Programas de fidelización por restaurante (sellos / puntos / ambos).';
COMMENT ON TABLE customer_coupons IS 'Cupones únicos emitidos a comensales — verificación SIEMPRE server-side.';
COMMENT ON TABLE customer_wallet IS 'Stub de wallet en CLP. Sin lógica activa en v1.';
