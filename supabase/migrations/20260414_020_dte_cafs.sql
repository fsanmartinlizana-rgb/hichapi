-- ════════════════════════════════════════════════════════════════════════════
--  DTE CAF & Folios — dte_cafs table, dte_emissions columns, updated RPC
--
--  This migration:
--    1. Creates the `dte_cafs` table — encrypted CAF XML storage with
--       status tracking and folio range constraints.
--    2. Adds missing columns to `dte_emissions` for the full pipeline.
--    3. Replaces `dte_take_next_folio` RPC to target `dte_cafs` with
--       FOR UPDATE atomic increment and `exhausted` status transition.
--
--  The existing `dte_caf_files` table is kept for backward compatibility.
--  `dte_cafs` is the authoritative source going forward.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. dte_cafs table ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS dte_cafs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id       UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  document_type       INTEGER NOT NULL CHECK (document_type IN (33, 39, 41)),
  folio_desde         INTEGER NOT NULL,
  folio_hasta         INTEGER NOT NULL,
  folio_actual        INTEGER NOT NULL,  -- starts at folio_desde, incremented atomically
  fecha_autorizacion  DATE NOT NULL,
  expires_at          TIMESTAMPTZ,
  status              TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'exhausted', 'expired')),

  -- AES-256-GCM encrypted CAF XML (base64 encoded)
  xml_ciphertext      TEXT NOT NULL,
  xml_iv              TEXT NOT NULL,
  xml_auth_tag        TEXT NOT NULL,

  rut_emisor          TEXT NOT NULL,
  uploaded_by         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT folio_range_valid CHECK (folio_hasta >= folio_desde),
  CONSTRAINT folio_actual_in_range CHECK (folio_actual BETWEEN folio_desde AND folio_hasta + 1)
);

-- Partial index for fast lookup of active CAFs per restaurant + document type
CREATE INDEX IF NOT EXISTS dte_cafs_active_idx
  ON dte_cafs (restaurant_id, document_type, status)
  WHERE status = 'active';

ALTER TABLE dte_cafs ENABLE ROW LEVEL SECURITY;

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

COMMENT ON TABLE dte_cafs IS
  'CAF (Código de Autorización de Folios) files encrypted with AES-256-GCM. '
  'Authoritative source for folio ranges. Replaces dte_caf_files.';

-- ── 2. dte_emissions — add missing pipeline columns ──────────────────────────

-- xml_signed already exists in Sprint 13 scaffold; add the rest idempotently
ALTER TABLE dte_emissions
  ADD COLUMN IF NOT EXISTS error_detail  TEXT,        -- error from any failed step
  ADD COLUMN IF NOT EXISTS accepted_at   TIMESTAMPTZ, -- set when SII accepts definitively
  ADD COLUMN IF NOT EXISTS signed_at     TIMESTAMPTZ; -- set when XML is signed

-- ── 3. dte_take_next_folio RPC — retargeted to dte_cafs ──────────────────────

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
  -- Lock the lowest active CAF with available folios (pessimistic lock)
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

  -- Atomically increment folio_actual; mark exhausted if last folio was consumed
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

COMMENT ON FUNCTION dte_take_next_folio IS
  'Atomically reserves the next available folio from dte_cafs for a given '
  'restaurant and document type. Raises P0001 (NO_CAF_AVAILABLE) when no '
  'active CAF with remaining folios exists. Marks CAF as exhausted when the '
  'last folio is consumed.';
