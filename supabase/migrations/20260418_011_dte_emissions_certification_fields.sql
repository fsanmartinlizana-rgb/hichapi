-- ════════════════════════════════════════════════════════════════════════════
--  DTE Certification — Extend dte_emissions Table
--
--  Adds certification-specific fields to the existing dte_emissions table.
--  These fields support test case tracking, receptor details, and reference
--  data required for certification documents.
-- ════════════════════════════════════════════════════════════════════════════

-- Add certification tracking fields
ALTER TABLE dte_emissions
  ADD COLUMN IF NOT EXISTS test_case_id UUID REFERENCES test_cases(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_certification BOOLEAN NOT NULL DEFAULT false;

-- Add extended receptor fields (for certification test cases)
ALTER TABLE dte_emissions
  ADD COLUMN IF NOT EXISTS giro_receptor TEXT,
  ADD COLUMN IF NOT EXISTS direccion_receptor TEXT,
  ADD COLUMN IF NOT EXISTS comuna_receptor TEXT;

-- Add payment method field
ALTER TABLE dte_emissions
  ADD COLUMN IF NOT EXISTS fma_pago INTEGER CHECK (fma_pago IN (1, 2, 3));

-- Add reference fields (for notas de crédito/débito)
ALTER TABLE dte_emissions
  ADD COLUMN IF NOT EXISTS tipo_doc_ref INTEGER,
  ADD COLUMN IF NOT EXISTS folio_ref INTEGER,
  ADD COLUMN IF NOT EXISTS fch_ref DATE,
  ADD COLUMN IF NOT EXISTS cod_ref INTEGER CHECK (cod_ref IN (1, 2, 3)),
  ADD COLUMN IF NOT EXISTS razon_ref TEXT;

-- Indexes for certification queries
CREATE INDEX IF NOT EXISTS dte_emissions_certification_idx 
  ON dte_emissions(restaurant_id, is_certification) 
  WHERE is_certification = true;

CREATE INDEX IF NOT EXISTS dte_emissions_test_case_idx 
  ON dte_emissions(test_case_id) 
  WHERE test_case_id IS NOT NULL;

COMMENT ON COLUMN dte_emissions.test_case_id IS
  'Links this emission to a certification test case. NULL for regular production emissions.';

COMMENT ON COLUMN dte_emissions.is_certification IS
  'Flag indicating this emission is part of SII certification process (not a real transaction).';

COMMENT ON COLUMN dte_emissions.giro_receptor IS
  'Business activity of the receptor (required for some certification test cases).';

COMMENT ON COLUMN dte_emissions.direccion_receptor IS
  'Address of the receptor (required for some certification test cases).';

COMMENT ON COLUMN dte_emissions.comuna_receptor IS
  'Municipality of the receptor (required for some certification test cases).';

COMMENT ON COLUMN dte_emissions.fma_pago IS
  'Payment method: 1=Contado, 2=Crédito, 3=Sin Costo (for certification documents).';

COMMENT ON COLUMN dte_emissions.tipo_doc_ref IS
  'Referenced document type (for notas de crédito/débito).';

COMMENT ON COLUMN dte_emissions.folio_ref IS
  'Referenced document folio (for notas de crédito/débito).';

COMMENT ON COLUMN dte_emissions.fch_ref IS
  'Referenced document date (for notas de crédito/débito).';

COMMENT ON COLUMN dte_emissions.cod_ref IS
  'Reference code: 1=Anula, 2=Corrige monto, 3=Corrige texto (for notas).';

COMMENT ON COLUMN dte_emissions.razon_ref IS
  'Reference reason text (for notas de crédito/débito).';
