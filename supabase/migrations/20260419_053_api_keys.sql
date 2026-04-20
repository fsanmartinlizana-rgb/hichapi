-- ── API pública con keys + scopes + rate limiting ──────────────────────────
-- Sprint 5 (2026-04-19). Feature enterprise.
--
-- Modelo:
-- * api_keys: una fila por key emitida. Guarda solo el hash SHA-256 del
--   secret para que nunca podamos restaurar la key al usuario. El prefix
--   (primeros 8 chars del secret) se guarda en claro para poder mostrarle
--   al user "hc_live_abc12345..." en el listado y permitirle identificar
--   cuál es cuál antes de revocar.
-- * api_request_log: audit + base de rate limiting simple. Conteo de
--   requests por (api_key_id, minute bucket) vía index.
--
-- Scopes soportados inicialmente:
--   'menu:read', 'menu:write',
--   'orders:read', 'orders:write',
--   'reservations:read', 'reservations:write',
--   'stock:read', 'stock:write'

CREATE TABLE IF NOT EXISTS api_keys (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  created_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name          TEXT NOT NULL,                           -- etiqueta humana
  prefix        TEXT NOT NULL,                           -- "hc_live_abc12345"
  secret_hash   TEXT NOT NULL,                           -- SHA-256 del secret completo
  scopes        TEXT[] NOT NULL DEFAULT '{}',
  rate_limit    INTEGER NOT NULL DEFAULT 1000,           -- requests / minuto
  last_used_at  TIMESTAMPTZ,
  expires_at    TIMESTAMPTZ,                             -- NULL = no expira
  revoked_at    TIMESTAMPTZ,                             -- NULL = activa
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_api_keys_restaurant ON api_keys(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_prefix     ON api_keys(prefix) WHERE revoked_at IS NULL;

-- Audit + rate limiting
CREATE TABLE IF NOT EXISTS api_request_log (
  id            BIGSERIAL PRIMARY KEY,
  api_key_id    UUID NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
  method        TEXT NOT NULL,
  path          TEXT NOT NULL,
  status_code   INTEGER NOT NULL,
  ip            TEXT,
  duration_ms   INTEGER,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índice para el conteo rate-limit (last 60s)
CREATE INDEX IF NOT EXISTS idx_api_request_log_key_time
  ON api_request_log(api_key_id, created_at DESC);

ALTER TABLE api_keys        ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_request_log ENABLE ROW LEVEL SECURITY;

-- RLS: solo owner/admin del restaurant puede ver/editar sus keys.
DROP POLICY IF EXISTS api_keys_admin_rw ON api_keys;
CREATE POLICY api_keys_admin_rw ON api_keys
  FOR ALL
  USING  (public.is_admin_for(restaurant_id))
  WITH CHECK (public.is_admin_for(restaurant_id));

DROP POLICY IF EXISTS api_request_log_admin_r ON api_request_log;
CREATE POLICY api_request_log_admin_r ON api_request_log
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM api_keys k
      WHERE k.id = api_request_log.api_key_id
        AND public.is_admin_for(k.restaurant_id)
    )
  );

COMMENT ON TABLE api_keys IS
  'API keys publicas por restaurant (feature enterprise). secret_hash es SHA-256 del secret; el prefix se muestra al user para identificar la key.';
