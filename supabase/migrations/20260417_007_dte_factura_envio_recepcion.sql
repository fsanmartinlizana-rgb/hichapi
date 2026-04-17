-- ════════════════════════════════════════════════════════════════════════════
--  DTE — Envío de factura al receptor + Recepción de facturas de proveedores
--
--  Cambios:
--    1. Nueva columna email_receptor en dte_emissions (para envío automático)
--    2. Nueva tabla dte_incoming_invoices — facturas recibidas de proveedores
--       con flujo de aceptación/rechazo
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. email_receptor en dte_emissions ───────────────────────────────────────
--
--  Almacena el correo del receptor para enviar el XML + PDF cuando la factura
--  es aceptada por el SII. Opcional — si no se provee, no se envía email.

ALTER TABLE dte_emissions
  ADD COLUMN IF NOT EXISTS email_receptor TEXT;

-- ── 2. dte_incoming_invoices — facturas recibidas de proveedores ──────────────
--
--  Registra facturas electrónicas tipo 33 recibidas de proveedores externos.
--  El receptor (restaurante) puede aceptarlas, rechazarlas o reclamarlas
--  dentro del plazo legal (8 días corridos desde la recepción).

CREATE TABLE IF NOT EXISTS dte_incoming_invoices (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id     UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,

  -- Datos del emisor (proveedor)
  rut_emisor        TEXT NOT NULL,
  razon_emisor      TEXT NOT NULL,
  giro_emisor       TEXT,
  email_emisor      TEXT,

  -- Datos del documento
  document_type     INTEGER NOT NULL DEFAULT 33,
  folio             INTEGER NOT NULL,
  fecha_emision     DATE NOT NULL,
  total_amount      INTEGER NOT NULL,
  net_amount        INTEGER,
  iva_amount        INTEGER,

  -- Archivos adjuntos (almacenados como base64 o URL de storage)
  xml_content       TEXT,    -- XML DTE firmado (base64 o texto plano)
  pdf_url           TEXT,    -- URL del PDF en Supabase Storage (opcional)

  -- Estado del proceso de recepción
  -- pendiente: recibida, sin acción
  -- aceptado: receptor acepta la factura
  -- rechazado: receptor rechaza (dentro de 8 días)
  -- reclamado: receptor reclama (discrepancia comercial)
  reception_status  TEXT NOT NULL DEFAULT 'pendiente'
    CHECK (reception_status IN ('pendiente', 'aceptado', 'rechazado', 'reclamado')),

  reception_glosa   TEXT,    -- motivo de rechazo/reclamo
  reception_date    TIMESTAMPTZ,  -- fecha en que se tomó la acción

  -- Metadatos
  received_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Restricción: un folio por emisor por restaurante
  UNIQUE (restaurant_id, rut_emisor, document_type, folio)
);

-- Índices
CREATE INDEX IF NOT EXISTS dte_incoming_restaurant_idx
  ON dte_incoming_invoices (restaurant_id, received_at DESC);

CREATE INDEX IF NOT EXISTS dte_incoming_status_idx
  ON dte_incoming_invoices (restaurant_id, reception_status);

-- RLS
ALTER TABLE dte_incoming_invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_read_incoming" ON dte_incoming_invoices;
DROP POLICY IF EXISTS "owner_admin_write_incoming" ON dte_incoming_invoices;

CREATE POLICY "staff_read_incoming" ON dte_incoming_invoices
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.restaurant_id = dte_incoming_invoices.restaurant_id
        AND tm.user_id = auth.uid()
        AND tm.active = true
    )
  );

CREATE POLICY "owner_admin_write_incoming" ON dte_incoming_invoices
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.restaurant_id = dte_incoming_invoices.restaurant_id
        AND tm.user_id = auth.uid()
        AND tm.active = true
        AND tm.role IN ('owner', 'admin', 'supervisor')
    )
  );

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_dte_incoming_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS dte_incoming_updated_at_trigger ON dte_incoming_invoices;
CREATE TRIGGER dte_incoming_updated_at_trigger
  BEFORE UPDATE ON dte_incoming_invoices
  FOR EACH ROW EXECUTE FUNCTION update_dte_incoming_updated_at();

COMMENT ON TABLE dte_incoming_invoices IS
  'Facturas electrónicas tipo 33 recibidas de proveedores. El restaurante puede aceptarlas, rechazarlas o reclamarlas dentro del plazo legal de 8 días.';

-- ── 3. dte_receptores — directorio de receptores frecuentes ──────────────────
--
--  Guarda los datos de empresas a las que se les ha emitido factura.
--  Al escribir el RUT en el formulario se autocompletan los demás campos.
--  Se actualiza automáticamente cada vez que se emite una factura exitosa.

CREATE TABLE IF NOT EXISTS dte_receptores (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id   UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,

  rut             TEXT NOT NULL,
  razon_social    TEXT NOT NULL,
  giro            TEXT,
  direccion       TEXT,
  comuna          TEXT,
  email           TEXT,

  -- Estadísticas de uso
  facturas_emitidas INTEGER NOT NULL DEFAULT 1,
  ultima_emision    TIMESTAMPTZ NOT NULL DEFAULT now(),

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (restaurant_id, rut)
);

CREATE INDEX IF NOT EXISTS dte_receptores_restaurant_idx
  ON dte_receptores (restaurant_id, ultima_emision DESC);

ALTER TABLE dte_receptores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_read_receptores" ON dte_receptores;
DROP POLICY IF EXISTS "owner_admin_write_receptores" ON dte_receptores;

CREATE POLICY "staff_read_receptores" ON dte_receptores
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.restaurant_id = dte_receptores.restaurant_id
        AND tm.user_id = auth.uid()
        AND tm.active = true
    )
  );

CREATE POLICY "owner_admin_write_receptores" ON dte_receptores
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.restaurant_id = dte_receptores.restaurant_id
        AND tm.user_id = auth.uid()
        AND tm.active = true
        AND tm.role IN ('owner', 'admin', 'supervisor', 'cajero')
    )
  );

CREATE OR REPLACE FUNCTION update_dte_receptores_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS dte_receptores_updated_at_trigger ON dte_receptores;
CREATE TRIGGER dte_receptores_updated_at_trigger
  BEFORE UPDATE ON dte_receptores
  FOR EACH ROW EXECUTE FUNCTION update_dte_receptores_updated_at();

COMMENT ON TABLE dte_receptores IS
  'Directorio de receptores frecuentes de facturas electrónicas. Se autocompleta al escribir el RUT en el formulario de emisión.';

-- ── Función RPC para incrementar contador de facturas emitidas ────────────────

CREATE OR REPLACE FUNCTION increment_receptor_facturas(
  p_restaurant_id UUID,
  p_rut           TEXT
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE dte_receptores
  SET facturas_emitidas = facturas_emitidas + 1
  WHERE restaurant_id = p_restaurant_id
    AND rut = p_rut;
END;
$$;
