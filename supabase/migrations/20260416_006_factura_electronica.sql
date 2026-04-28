-- ════════════════════════════════════════════════════════════════════════════
--  Factura Electrónica — columnas, restricciones e índices nuevos
--
--  Esta migración extiende la infraestructura DTE existente (boleta 39/41)
--  para soportar:
--    - Factura electrónica (tipo 33)
--    - Nota de débito (tipo 56)
--    - Nota de crédito (tipo 61)
--
--  Cambios:
--    1. Nuevas columnas en dte_emissions para datos del receptor, AEC,
--       forma de pago y referencia a documento original.
--    2. Actualización del CHECK constraint de dte_cafs.document_type
--       para incluir los tipos 56 y 61.
--    3. Reemplazo de dte_take_next_folio para soportar tipos 56 y 61.
--    4. Índice en dte_emissions (restaurant_id, document_type) para
--       filtrado eficiente por tipo de documento.
--
--  Requisitos: 1.6, 7.5, 8.1, 8.2, 8.3
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. Nuevas columnas en dte_emissions ──────────────────────────────────────

-- Datos del receptor (obligatorios para factura tipo 33, 56 y 61)
ALTER TABLE dte_emissions
  ADD COLUMN IF NOT EXISTS giro_receptor      TEXT,
  ADD COLUMN IF NOT EXISTS direccion_receptor TEXT,
  ADD COLUMN IF NOT EXISTS comuna_receptor    TEXT;

-- Estado del proceso de intercambio electrónico (AEC / acuse de recibo)
-- Solo aplica para facturas (tipo 33) y notas de débito (tipo 56)
-- Las notas de crédito (tipo 61) NO requieren AEC cuando anulan boletas
-- Requisitos: 8.1, 8.2, 8.3
ALTER TABLE dte_emissions
  ADD COLUMN IF NOT EXISTS aec_status TEXT
    CHECK (aec_status IN ('pendiente', 'aceptado', 'rechazado', 'reclamado'))
    DEFAULT 'pendiente',
  ADD COLUMN IF NOT EXISTS aec_fecha  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS aec_glosa  TEXT;

-- Forma de pago (1 = contado, 2 = crédito, 3 = sin costo)
-- Requisito: 2.2, 2.3
ALTER TABLE dte_emissions
  ADD COLUMN IF NOT EXISTS fma_pago INTEGER DEFAULT 1;

-- Referencia a documento original (para notas de crédito tipo 61 y débito tipo 56)
-- Requisito: 7.1, 7.2
ALTER TABLE dte_emissions
  ADD COLUMN IF NOT EXISTS tipo_doc_ref INTEGER,
  ADD COLUMN IF NOT EXISTS folio_ref    INTEGER,
  ADD COLUMN IF NOT EXISTS fch_ref      DATE,
  ADD COLUMN IF NOT EXISTS cod_ref      INTEGER,
  ADD COLUMN IF NOT EXISTS razon_ref    TEXT;

-- ── 2. Actualizar CHECK constraint de dte_cafs.document_type ─────────────────
--
--  El constraint original solo permite (33, 39, 41).
--  Lo reemplazamos para incluir 56 (Nota de Débito) y 61 (Nota de Crédito).
--  Requisito: 7.5

ALTER TABLE dte_cafs
  DROP CONSTRAINT IF EXISTS dte_cafs_document_type_check;

ALTER TABLE dte_cafs
  ADD CONSTRAINT dte_cafs_document_type_check
    CHECK (document_type IN (33, 39, 41, 56, 61));

-- ── 3. Reemplazar dte_take_next_folio para soportar tipos 56 y 61 ────────────
--
--  La lógica es idéntica a la versión anterior; solo se amplía el rango de
--  tipos válidos en el mensaje de error (la validación real la hace el
--  CHECK constraint de dte_cafs.document_type).
--  Requisito: 7.5

CREATE OR REPLACE FUNCTION dte_take_next_folio(
  p_restaurant_id UUID,
  p_document_type INTEGER
)
RETURNS TABLE (caf_id UUID, folio INTEGER) AS $func$
DECLARE
  v_caf_id UUID;
  v_folio  INTEGER;
  v_to     INTEGER;
BEGIN
  -- Validar que el tipo de documento es soportado
  IF p_document_type NOT IN (33, 39, 41, 56, 61) THEN
    RAISE EXCEPTION 'INVALID_DOCUMENT_TYPE: tipo % no soportado (válidos: 33, 39, 41, 56, 61)', p_document_type
      USING ERRCODE = 'P0001';
  END IF;

  -- Bloquear el CAF activo más antiguo con folios disponibles (lock pesimista)
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

  -- Incrementar folio_actual atómicamente; marcar como exhausted si se consumió el último
  UPDATE dte_cafs
     SET folio_actual = v_folio + 1,
         status       = CASE WHEN v_folio + 1 > v_to THEN 'exhausted' ELSE 'active' END
   WHERE id = v_caf_id;

  caf_id := v_caf_id;
  folio  := v_folio;
  RETURN NEXT;
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION dte_take_next_folio(UUID, INTEGER) TO authenticated;

COMMENT ON FUNCTION dte_take_next_folio IS
  'Reserva atómicamente el siguiente folio disponible de dte_cafs para un '
  'restaurante y tipo de documento. Soporta tipos 33, 39, 41, 56 y 61. '
  'Lanza P0001 (NO_CAF_AVAILABLE) cuando no hay CAF activo con folios '
  'disponibles. Marca el CAF como exhausted al consumir el último folio.';

-- ── 4. Índice en dte_emissions (restaurant_id, document_type) ────────────────
--
--  Optimiza el filtrado por tipo de documento en el panel DTE.
--  Requisito: 10.5

CREATE INDEX IF NOT EXISTS dte_emissions_restaurant_doctype_idx
  ON dte_emissions (restaurant_id, document_type);
