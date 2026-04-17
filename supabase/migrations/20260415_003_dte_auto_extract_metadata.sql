-- ════════════════════════════════════════════════════════════════════════════
--  Auto-extract metadata from PFX certificate
--  
--  Adds fields to dte_credentials to store:
--  - rut_envia: RUT del representante legal (extracted from cert)
--  - dte_environment: certification or production (auto-detected from cert)
-- ════════════════════════════════════════════════════════════════════════════

-- Add rut_envia to dte_credentials (extracted from certificate subject/SAN)
ALTER TABLE dte_credentials
  ADD COLUMN IF NOT EXISTS rut_envia TEXT;

-- Add dte_environment to dte_credentials (auto-detected from certificate issuer)
-- This overrides the restaurant-level dte_environment when present
ALTER TABLE dte_credentials
  ADD COLUMN IF NOT EXISTS dte_environment TEXT
    CHECK (dte_environment IN ('certification', 'production'));

-- Add comment explaining the fields
COMMENT ON COLUMN dte_credentials.rut_envia IS 
  'RUT del representante legal extraído automáticamente del certificado (subjectAltName o subject CN)';

COMMENT ON COLUMN dte_credentials.dte_environment IS 
  'Ambiente del certificado (certification o production) detectado automáticamente del emisor del certificado';
