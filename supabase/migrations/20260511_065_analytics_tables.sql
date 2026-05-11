-- ══════════════════════════════════════════════════════════════════════════════
-- Migration 065 — Analytics tables (search_events, search_result_events, page_views)
-- Sprint 2026-05-11
--
-- Objetivo:
--   Capturar uso real de Discovery para alimentar el dashboard admin y tomar
--   decisiones de producto. Insert anónimo público (sin auth necesaria),
--   SELECT solo para super_admin.
--
-- Privacidad (Ley 19.628 Chile - Protección de Datos):
--   - NUNCA guardamos IP cruda. Solo país y región derivados de headers
--     Vercel (x-vercel-ip-country, x-vercel-ip-country-region).
--   - session_id es un UUID random pseudoanónimo en localStorage del cliente.
--   - Retención: expires_at NOT NULL default now() + interval '12 months'.
--     Un cron diario puede DELETE WHERE expires_at < now() para purge.
--   - El user puede ejercer ARCO (acceso/rectificación/cancelación): el
--     admin puede DELETE rows por user_id o session_id a pedido.
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1. search_events: cada query de Discovery ────────────────────────────────

CREATE TABLE IF NOT EXISTS search_events (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Privacy: rows se purgan automáticamente tras 12 meses (Ley 19.628)
  expires_at             TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '12 months'),
  session_id             TEXT NOT NULL,
  user_id                UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  query_text             TEXT NOT NULL,
  parsed_intent          JSONB,
  zone_detected          TEXT,
  zone_lat               NUMERIC,
  zone_lng               NUMERIC,
  results_count          INT,
  no_results_in_zone     BOOLEAN NOT NULL DEFAULT false,
  triggered_enrichment   BOOLEAN NOT NULL DEFAULT false,
  user_agent             TEXT,
  -- referrer: limpiamos query params al insertar para no guardar tokens UTM
  referrer               TEXT,
  ip_country             TEXT,  -- derivado de x-vercel-ip-country
  ip_region              TEXT   -- derivado de x-vercel-ip-country-region
);

CREATE INDEX IF NOT EXISTS idx_search_events_created
  ON search_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_search_events_zone
  ON search_events(zone_detected, created_at DESC)
  WHERE zone_detected IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_search_events_no_results
  ON search_events(zone_detected, created_at DESC)
  WHERE no_results_in_zone = true;
CREATE INDEX IF NOT EXISTS idx_search_events_session
  ON search_events(session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_search_events_expires
  ON search_events(expires_at);

-- ── 2. search_result_events: 1 row por resultado mostrado, con click ─────────

CREATE TABLE IF NOT EXISTS search_result_events (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at        TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '12 months'),
  search_event_id   UUID REFERENCES search_events(id) ON DELETE CASCADE,
  restaurant_id     UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  position          INT NOT NULL,
  clicked           BOOLEAN NOT NULL DEFAULT false,
  clicked_at        TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_search_results_search
  ON search_result_events(search_event_id);
CREATE INDEX IF NOT EXISTS idx_search_results_clicks
  ON search_result_events(restaurant_id)
  WHERE clicked = true;
CREATE INDEX IF NOT EXISTS idx_search_results_expires
  ON search_result_events(expires_at);

-- ── 3. page_views: navegación general ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS page_views (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at      TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '12 months'),
  session_id      TEXT NOT NULL,
  user_id         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  path            TEXT NOT NULL,
  restaurant_id   UUID REFERENCES restaurants(id) ON DELETE SET NULL,
  referrer        TEXT,
  user_agent      TEXT,
  duration_ms     INT,
  ip_country      TEXT,
  ip_region       TEXT
);

CREATE INDEX IF NOT EXISTS idx_page_views_created
  ON page_views(created_at DESC, path);
CREATE INDEX IF NOT EXISTS idx_page_views_session
  ON page_views(session_id, created_at DESC);
-- Top restaurants más vistos: queries WHERE path LIKE '/r/%'
CREATE INDEX IF NOT EXISTS idx_page_views_restaurant_paths
  ON page_views(restaurant_id, created_at DESC)
  WHERE restaurant_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_page_views_expires
  ON page_views(expires_at);

-- ── 4. RLS: append-only, INSERT público, SELECT super_admin ──────────────────

ALTER TABLE search_events        ENABLE ROW LEVEL SECURITY;
ALTER TABLE search_result_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE page_views           ENABLE ROW LEVEL SECURITY;

-- INSERT público para tracking anónimo (anon role permitido)
CREATE POLICY "public_insert_search_events"
  ON search_events FOR INSERT WITH CHECK (true);
CREATE POLICY "public_insert_search_result_events"
  ON search_result_events FOR INSERT WITH CHECK (true);
CREATE POLICY "public_insert_page_views"
  ON page_views FOR INSERT WITH CHECK (true);

-- UPDATE limitado: solo se permite marcar `clicked=true` en search_result_events
-- (no se puede modificar nada más — append-only de facto)
CREATE POLICY "public_update_click"
  ON search_result_events FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- SELECT solo super_admin
CREATE POLICY "super_admin_read_search_events"
  ON search_events FOR SELECT USING (public.is_super_admin());
CREATE POLICY "super_admin_read_search_result_events"
  ON search_result_events FOR SELECT USING (public.is_super_admin());
CREATE POLICY "super_admin_read_page_views"
  ON page_views FOR SELECT USING (public.is_super_admin());

-- DELETE solo super_admin (para ARCO compliance: user pide eliminación)
CREATE POLICY "super_admin_delete_search_events"
  ON search_events FOR DELETE USING (public.is_super_admin());
CREATE POLICY "super_admin_delete_search_result_events"
  ON search_result_events FOR DELETE USING (public.is_super_admin());
CREATE POLICY "super_admin_delete_page_views"
  ON page_views FOR DELETE USING (public.is_super_admin());

COMMENT ON TABLE search_events IS
  'Tracking de búsquedas Discovery. Retention 12 meses por Ley 19.628 — el cron debe DELETE WHERE expires_at < now() diariamente.';
COMMENT ON TABLE search_result_events IS
  'Eventos de resultados mostrados y clickeados. Cascade delete por search_event_id.';
COMMENT ON TABLE page_views IS
  'Page views generales. Retention 12 meses. NUNCA IP cruda — solo país y región.';
