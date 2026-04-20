-- ── Dashboard layouts configurables ─────────────────────────────────────────
-- Cada usuario puede componer su propio layout de widgets sobre el dashboard
-- unificado de /analytics. Un (restaurant_id, user_id) tiene un solo layout.
--
-- widgets: JSON array con el shape:
--   [{ "id": "uuid-local", "type": "revenue_today", "x": 0, "y": 0, "w": 4, "h": 2, "config": {...} }]
--
-- El "type" mapea a un componente del catálogo definido en el front. Hoy
-- (Sprint 3) el catálogo incluye: revenue_today, revenue_week, top_items_week,
-- peak_hours_heatmap, inventory_low_stock, open_tables_now, avg_ticket,
-- orders_by_hour, chapi_tip_of_the_day.

CREATE TABLE IF NOT EXISTS dashboard_layouts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  widgets       JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (restaurant_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_dashboard_layouts_user
  ON dashboard_layouts (restaurant_id, user_id);

ALTER TABLE dashboard_layouts ENABLE ROW LEVEL SECURITY;

-- Solo el dueño del layout puede leerlo/editarlo
DROP POLICY IF EXISTS dashboard_layouts_self ON dashboard_layouts;
CREATE POLICY dashboard_layouts_self ON dashboard_layouts
  FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

COMMENT ON TABLE dashboard_layouts IS
  'Layout de widgets del dashboard /analytics por usuario. JSONB widgets = array de {type,x,y,w,h,config}.';
