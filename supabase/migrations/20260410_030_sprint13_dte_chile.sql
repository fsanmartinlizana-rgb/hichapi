-- ════════════════════════════════════════════════════════════════════════════
--  Sprint 13 — DTE Chile (boletas + facturas electrónicas) scaffold
--
--  Tablas:
--    1. dte_credentials  — certificados PFX cifrados (AES-256-GCM)
--    2. dte_caf_files    — rangos de folios autorizados por SII
--    3. dte_emissions    — boletas/facturas emitidas (track + estado SII)
--
--  Datos sensibles cifrados a nivel app (lib/crypto/aes.ts) usando
--  DTE_MASTER_KEY. La DB sólo guarda ciphertext + iv + auth_tag en base64.
-- ════════════════════════════════════════════════════════════════════════════

-- 1. Datos tributarios en restaurants ───────────────────────────────────────

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

-- 2. Credenciales SII (cert PFX cifrado) ────────────────────────────────────

CREATE TABLE IF NOT EXISTS dte_credentials (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id   UUID NOT NULL UNIQUE REFERENCES restaurants(id) ON DELETE CASCADE,

  -- AES-256-GCM ciphertext (base64) of the PFX file bytes
  cert_ciphertext TEXT NOT NULL,
  cert_iv         TEXT NOT NULL,
  cert_auth_tag   TEXT NOT NULL,

  -- AES-256-GCM ciphertext (base64) of the cert password
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

-- Sólo owners pueden ver/tocar credenciales del SII (super sensible)
CREATE POLICY "owners_select_dte_credentials" ON dte_credentials
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.restaurant_id = dte_credentials.restaurant_id
        AND tm.user_id = auth.uid()
        AND tm.role = 'owner'
        AND tm.active = true
    )
  );

CREATE POLICY "owners_modify_dte_credentials" ON dte_credentials
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.restaurant_id = dte_credentials.restaurant_id
        AND tm.user_id = auth.uid()
        AND tm.role = 'owner'
        AND tm.active = true
    )
  );

-- 3. CAF files (rangos de folios autorizados por SII) ───────────────────────

CREATE TABLE IF NOT EXISTS dte_caf_files (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id   UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  document_type   INTEGER NOT NULL, -- 39 boleta, 41 boleta exenta, 33 factura
  folio_from      INTEGER NOT NULL,
  folio_to        INTEGER NOT NULL,
  next_folio      INTEGER NOT NULL,
  caf_xml         TEXT NOT NULL, -- raw XML del SII
  authorized_at   TIMESTAMPTZ,
  expires_at      TIMESTAMPTZ,
  exhausted       BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT folio_range_valid CHECK (folio_to >= folio_from),
  CONSTRAINT next_folio_in_range CHECK (next_folio BETWEEN folio_from AND folio_to + 1)
);

CREATE INDEX IF NOT EXISTS dte_caf_files_lookup_idx
  ON dte_caf_files (restaurant_id, document_type, exhausted)
  WHERE exhausted = false;

ALTER TABLE dte_caf_files ENABLE ROW LEVEL SECURITY;

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

-- 4. Emisiones de DTE ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS dte_emissions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id   UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  order_id        UUID REFERENCES orders(id) ON DELETE SET NULL,

  document_type   INTEGER NOT NULL, -- 39 / 41 / 33
  folio           INTEGER NOT NULL,
  caf_id          UUID REFERENCES dte_caf_files(id) ON DELETE SET NULL,

  rut_emisor      TEXT NOT NULL,
  rut_receptor    TEXT, -- nullable on consumer-final boletas
  razon_receptor  TEXT,

  net_amount      INTEGER NOT NULL,
  iva_amount      INTEGER NOT NULL,
  total_amount    INTEGER NOT NULL,

  -- DTE pipeline state
  status          TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'signed', 'sent', 'accepted', 'rejected', 'cancelled')),
  sii_track_id    TEXT,
  sii_response    JSONB,
  pdf_url         TEXT,
  xml_signed      TEXT,

  emitted_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  emitted_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  cancelled_at    TIMESTAMPTZ,

  CONSTRAINT folio_per_doctype_unique UNIQUE (restaurant_id, document_type, folio)
);

CREATE INDEX IF NOT EXISTS dte_emissions_restaurant_idx
  ON dte_emissions (restaurant_id, emitted_at DESC);

CREATE INDEX IF NOT EXISTS dte_emissions_order_idx
  ON dte_emissions (order_id)
  WHERE order_id IS NOT NULL;

ALTER TABLE dte_emissions ENABLE ROW LEVEL SECURITY;

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

-- 5. RPC: tomar siguiente folio atómicamente ────────────────────────────────

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
  -- Lock the lowest CAF with available folios
  SELECT id, next_folio, folio_to
    INTO v_caf_id, v_folio, v_to
    FROM dte_caf_files
   WHERE restaurant_id = p_restaurant_id
     AND document_type = p_document_type
     AND exhausted     = false
     AND next_folio   <= folio_to
   ORDER BY folio_from ASC
   LIMIT 1
   FOR UPDATE;

  IF v_caf_id IS NULL THEN
    RAISE EXCEPTION 'NO_CAF_AVAILABLE: no hay folios autorizados para document_type %', p_document_type
      USING ERRCODE = 'P0001';
  END IF;

  UPDATE dte_caf_files
     SET next_folio = v_folio + 1,
         exhausted  = (v_folio + 1 > v_to)
   WHERE id = v_caf_id;

  caf_id := v_caf_id;
  folio  := v_folio;
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION dte_take_next_folio(UUID, INTEGER) TO authenticated;

COMMENT ON TABLE dte_credentials IS
  'PFX cert + password cifrados con AES-256-GCM (lib/crypto/aes.ts).';
COMMENT ON FUNCTION dte_take_next_folio IS
  'Reserva el siguiente folio disponible para un tipo de documento, con lock pesimista.';
