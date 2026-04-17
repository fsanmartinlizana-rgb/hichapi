-- ════════════════════════════════════════════════════════════════════════════
--  Script seguro: aplica solo lo que falta para el pipeline DTE CAF & Folios
--  Usa IF NOT EXISTS y DROP ... IF EXISTS para ser idempotente.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. Columnas faltantes en restaurants ─────────────────────────────────────

ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS rut             TEXT,
  ADD COLUMN IF NOT EXISTS razon_social    TEXT,
  ADD COLUMN IF NOT EXISTS giro            TEXT,
  ADD COLUMN IF NOT EXISTS dte_environment TEXT NOT NULL DEFAULT 'certification'
    CHECK (dte_environment IN ('certification', 'production')),
  ADD COLUMN IF NOT EXISTS dte_enabled     BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS restaurants_rut_unique
  ON restaurants (rut)
  WHERE rut IS NOT NULL;

-- ── 2. notifications ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS notifications (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  type          TEXT NOT NULL,
  title         TEXT NOT NULL,
  message       TEXT,
  severity      TEXT NOT NULL DEFAULT 'info'
    CHECK (severity IN ('info','success','warning','critical')),
  category      TEXT CHECK (category IN ('operacion','inventario','caja','dte','equipo','sistema')),
  is_read       BOOLEAN NOT NULL DEFAULT false,
  resolved      BOOLEAN NOT NULL DEFAULT false,
  action_url    TEXT,
  action_label  TEXT,
  dedupe_key    TEXT,
  metadata      JSONB,
  expires_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notifications_restaurant_id_idx
  ON notifications(restaurant_id);
CREATE INDEX IF NOT EXISTS notifications_is_read_idx
  ON notifications(restaurant_id, is_read) WHERE is_read = false;

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "team members can manage notifications" ON notifications;
CREATE POLICY "team members can manage notifications"
  ON notifications FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.restaurant_id = notifications.restaurant_id
        AND tm.user_id = auth.uid()
        AND tm.active = true
    )
  );

-- ── 3. dte_credentials ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS dte_credentials (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id   UUID NOT NULL UNIQUE REFERENCES restaurants(id) ON DELETE CASCADE,
  cert_ciphertext TEXT NOT NULL,
  cert_iv         TEXT NOT NULL,
  cert_auth_tag   TEXT NOT NULL,
  pass_ciphertext TEXT NOT NULL,
  pass_iv         TEXT NOT NULL,
  pass_auth_tag   TEXT NOT NULL,
  cert_subject    TEXT,
  cert_issuer     TEXT,
  cert_valid_from TIMESTAMPTZ,
  cert_valid_to   TIMESTAMPTZ,
  uploaded_by     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  uploaded_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  rotated_at      TIMESTAMPTZ
);

ALTER TABLE dte_credentials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owners_select_dte_credentials" ON dte_credentials;
DROP POLICY IF EXISTS "owners_modify_dte_credentials" ON dte_credentials;
DROP POLICY IF EXISTS "only owner can manage dte credentials" ON dte_credentials;
CREATE POLICY "owners_manage_dte_credentials" ON dte_credentials
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.restaurant_id = dte_credentials.restaurant_id
        AND tm.user_id = auth.uid()
        AND tm.role IN ('owner', 'admin')
        AND tm.active = true
    )
  );

-- ── 4. dte_caf_files (backward compat) ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS dte_caf_files (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  document_type INTEGER NOT NULL,
  folio_from    INTEGER NOT NULL,
  folio_to      INTEGER NOT NULL,
  next_folio    INTEGER NOT NULL,
  caf_xml       TEXT NOT NULL,
  authorized_at TIMESTAMPTZ,
  expires_at    TIMESTAMPTZ,
  exhausted     BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT folio_range_valid_files CHECK (folio_to >= folio_from),
  CONSTRAINT next_folio_in_range_files CHECK (next_folio BETWEEN folio_from AND folio_to + 1)
);

CREATE INDEX IF NOT EXISTS dte_caf_files_lookup_idx
  ON dte_caf_files (restaurant_id, document_type, exhausted)
  WHERE exhausted = false;

ALTER TABLE dte_caf_files ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_read_caf" ON dte_caf_files;
DROP POLICY IF EXISTS "owner_admin_modify_caf" ON dte_caf_files;
CREATE POLICY "staff_read_caf" ON dte_caf_files
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.restaurant_id = dte_caf_files.restaurant_id
        AND tm.user_id = auth.uid()
        AND tm.active = true
        AND tm.role IN ('owner', 'admin', 'supervisor')
    )
  );
CREATE POLICY "owner_admin_modify_caf" ON dte_caf_files
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.restaurant_id = dte_caf_files.restaurant_id
        AND tm.user_id = auth.uid()
        AND tm.active = true
        AND tm.role IN ('owner', 'admin')
    )
  );

-- ── 5. dte_emissions ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS dte_emissions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id  UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  order_id       UUID REFERENCES orders(id) ON DELETE SET NULL,
  document_type  INTEGER NOT NULL,
  folio          INTEGER NOT NULL,
  caf_id         UUID REFERENCES dte_caf_files(id) ON DELETE SET NULL,
  rut_emisor     TEXT NOT NULL,
  rut_receptor   TEXT,
  razon_receptor TEXT,
  net_amount     INTEGER NOT NULL,
  iva_amount     INTEGER NOT NULL,
  total_amount   INTEGER NOT NULL,
  status         TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','pending','signed','sent','accepted','rejected','cancelled')),
  sii_track_id   TEXT,
  sii_response   JSONB,
  pdf_url        TEXT,
  xml_signed     TEXT,
  error_detail   TEXT,
  accepted_at    TIMESTAMPTZ,
  signed_at      TIMESTAMPTZ,
  emitted_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  emitted_by     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  cancelled_at   TIMESTAMPTZ,
  CONSTRAINT folio_per_doctype_unique UNIQUE (restaurant_id, document_type, folio)
);

CREATE INDEX IF NOT EXISTS dte_emissions_restaurant_idx
  ON dte_emissions (restaurant_id, emitted_at DESC);
CREATE INDEX IF NOT EXISTS dte_emissions_order_idx
  ON dte_emissions (order_id) WHERE order_id IS NOT NULL;

ALTER TABLE dte_emissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_read_emissions" ON dte_emissions;
DROP POLICY IF EXISTS "owner_admin_write_emissions" ON dte_emissions;
CREATE POLICY "staff_read_emissions" ON dte_emissions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.restaurant_id = dte_emissions.restaurant_id
        AND tm.user_id = auth.uid()
        AND tm.active = true
        AND tm.role IN ('owner', 'admin', 'supervisor', 'cajero')
    )
  );
CREATE POLICY "owner_admin_write_emissions" ON dte_emissions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.restaurant_id = dte_emissions.restaurant_id
        AND tm.user_id = auth.uid()
        AND tm.active = true
        AND tm.role IN ('owner', 'admin', 'supervisor', 'cajero')
    )
  );

-- ── 6. dte_cafs (nueva tabla autorizada) ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS dte_cafs (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id      UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  document_type      INTEGER NOT NULL CHECK (document_type IN (33, 39, 41)),
  folio_desde        INTEGER NOT NULL,
  folio_hasta        INTEGER NOT NULL,
  folio_actual       INTEGER NOT NULL,
  fecha_autorizacion DATE NOT NULL,
  expires_at         TIMESTAMPTZ,
  status             TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'exhausted', 'expired')),
  xml_ciphertext     TEXT NOT NULL,
  xml_iv             TEXT NOT NULL,
  xml_auth_tag       TEXT NOT NULL,
  rut_emisor         TEXT NOT NULL,
  uploaded_by        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT folio_range_valid CHECK (folio_hasta >= folio_desde),
  CONSTRAINT folio_actual_in_range CHECK (folio_actual BETWEEN folio_desde AND folio_hasta + 1)
);

CREATE INDEX IF NOT EXISTS dte_cafs_active_idx
  ON dte_cafs (restaurant_id, document_type, status)
  WHERE status = 'active';

ALTER TABLE dte_cafs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_read_dte_cafs" ON dte_cafs;
DROP POLICY IF EXISTS "owner_admin_modify_dte_cafs" ON dte_cafs;
CREATE POLICY "staff_read_dte_cafs" ON dte_cafs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.restaurant_id = dte_cafs.restaurant_id
        AND tm.user_id = auth.uid()
        AND tm.active = true
        AND tm.role IN ('owner', 'admin', 'supervisor')
    )
  );
CREATE POLICY "owner_admin_modify_dte_cafs" ON dte_cafs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.restaurant_id = dte_cafs.restaurant_id
        AND tm.user_id = auth.uid()
        AND tm.active = true
        AND tm.role IN ('owner', 'admin')
    )
  );

-- ── 7. dte_take_next_folio RPC ────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION dte_take_next_folio(
  p_restaurant_id UUID,
  p_document_type INTEGER
)
RETURNS TABLE (caf_id UUID, folio INTEGER) AS $$
DECLARE
  v_caf_id UUID;
  v_folio  INTEGER;
  v_to     INTEGER;
BEGIN
  SELECT id, folio_actual, folio_hasta
    INTO v_caf_id, v_folio, v_to
    FROM dte_cafs
   WHERE restaurant_id = p_restaurant_id
     AND document_type = p_document_type
     AND status        = 'active'
     AND folio_actual  <= folio_hasta
     AND (expires_at IS NULL OR expires_at > now())
   ORDER BY folio_desde ASC
   LIMIT 1
   FOR UPDATE;

  IF v_caf_id IS NULL THEN
    RAISE EXCEPTION 'NO_CAF_AVAILABLE' USING ERRCODE = 'P0001';
  END IF;

  UPDATE dte_cafs
     SET folio_actual = v_folio + 1,
         status       = CASE WHEN v_folio + 1 > v_to THEN 'exhausted' ELSE 'active' END
   WHERE id = v_caf_id;

  caf_id := v_caf_id;
  folio  := v_folio;
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION dte_take_next_folio(UUID, INTEGER) TO authenticated;
