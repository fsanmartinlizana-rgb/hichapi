-- ─────────────────────────────────────────────────────────────────────────────
-- team_members: roles del equipo por restaurante
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS team_members (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id  uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role           text NOT NULL CHECK (role IN ('owner','admin','supervisor','waiter')),
  invited_by     uuid REFERENCES auth.users(id),
  joined_at      timestamptz DEFAULT now(),
  active         bool DEFAULT true,
  UNIQUE (restaurant_id, user_id)
);

ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "team_read_own" ON team_members
  FOR SELECT USING (user_id = auth.uid() OR
    restaurant_id IN (SELECT id FROM restaurants WHERE owner_id = auth.uid()));

CREATE POLICY "owner_manage_team" ON team_members
  FOR ALL USING (
    restaurant_id IN (SELECT id FROM restaurants WHERE owner_id = auth.uid())
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- audit_log: registro de acciones críticas
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_log (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id  uuid REFERENCES restaurants(id) ON DELETE SET NULL,
  user_id        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type     text NOT NULL,
  -- Examples: 'login' | 'logout' | 'password_change' | 'price_change'
  --           'order_approve' | 'menu_item_toggle' | 'team_invite'
  metadata       jsonb,
  ip_hash        text,    -- hashed, never raw IP
  user_agent     text,
  created_at     timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_restaurant_idx ON audit_log (restaurant_id, created_at DESC);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_read_audit" ON audit_log
  FOR SELECT USING (
    restaurant_id IN (SELECT id FROM restaurants WHERE owner_id = auth.uid())
  );

-- Only backend (service role) can insert audit events
-- No INSERT policy for normal users

-- ─────────────────────────────────────────────────────────────────────────────
-- user_preferences: perfil del cliente registrado
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_preferences (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  dietary_restrictions text[]   DEFAULT '{}',
  favorite_zones       text[]   DEFAULT '{}',
  favorite_cuisines    text[]   DEFAULT '{}',
  budget_min_clp       int,
  budget_max_clp       int,
  favorite_restaurants uuid[]   DEFAULT '{}',
  search_history       jsonb[]  DEFAULT '{}',
  -- [{zone, cuisine_type, budget_clp, timestamp}] last 50
  order_count          int      DEFAULT 0,
  last_active_at       timestamptz DEFAULT now(),
  created_at           timestamptz DEFAULT now()
);

ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_own_prefs" ON user_preferences
  FOR ALL USING (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────────
-- dead_time_slots: horarios muertos identificados por el cron
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS dead_time_slots (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id    uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  day_of_week      int  NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=domingo
  hour_start       int  NOT NULL CHECK (hour_start BETWEEN 0 AND 23),
  hour_end         int  NOT NULL CHECK (hour_end BETWEEN 1 AND 24),
  avg_occupancy_pct float4,   -- promedio histórico de ocupación en este slot
  confidence       float4,    -- 0-1, basado en semanas de datos
  identified_at    timestamptz DEFAULT now(),
  UNIQUE (restaurant_id, day_of_week, hour_start)
);

ALTER TABLE dead_time_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_read_dead_times" ON dead_time_slots
  FOR SELECT USING (
    restaurant_id IN (SELECT id FROM restaurants WHERE owner_id = auth.uid())
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- promotions: ofertas en horarios muertos
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS promotions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id    uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  dead_time_slot_id uuid REFERENCES dead_time_slots(id) ON DELETE SET NULL,
  title            text NOT NULL,          -- "Happy hour pasta"
  description      text,                  -- "20% off en toda la carta de pastas"
  discount_pct     int,                   -- 0-100
  featured_item_id uuid REFERENCES menu_items(id) ON DELETE SET NULL,
  active           bool DEFAULT true,
  valid_days       int[] DEFAULT '{1,2,3,4,5}',  -- días de la semana que aplica
  hour_start       int,
  hour_end         int,
  -- Métricas
  impressions      int DEFAULT 0,          -- veces que Chapi lo mostró
  clicks           int DEFAULT 0,          -- veces que generó un cover
  covers_generated int DEFAULT 0,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);

ALTER TABLE promotions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_manage_promotions" ON promotions
  FOR ALL USING (
    restaurant_id IN (SELECT id FROM restaurants WHERE owner_id = auth.uid())
  );

-- Chapi (anon) puede leer promociones activas para recomendarlas
CREATE POLICY "public_read_active_promotions" ON promotions
  FOR SELECT USING (active = true);

-- Realtime para el panel
ALTER PUBLICATION supabase_realtime ADD TABLE promotions;
