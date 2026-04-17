-- ══════════════════════════════════════════════════════════════════════════════
--  Migration: Add PHP Bridge fields to dte_credentials and dte_cafs
--  
--  Adds fields needed for the PHP bridge to work with LibreDTE:
--  
--  dte_credentials:
--  - cert_base64: Base64 encoded PFX certificate (for PHP bridge)
--  - cert_password: Plain text password (for PHP bridge)
--  - rut_envia: RUT of the person sending (representante legal)
--  - fecha_resolucion: Resolution date from SII
--  - numero_resolucion: Resolution number from SII
--
--  dte_cafs:
--  - caf_xml: Plain text CAF XML (for PHP bridge)
-- ══════════════════════════════════════════════════════════════════════════════

-- Add new columns to dte_credentials
ALTER TABLE dte_credentials
  ADD COLUMN IF NOT EXISTS cert_base64 TEXT,
  ADD COLUMN IF NOT EXISTS cert_password TEXT,
  ADD COLUMN IF NOT EXISTS rut_envia VARCHAR(20),
  ADD COLUMN IF NOT EXISTS fecha_resolucion DATE,
  ADD COLUMN IF NOT EXISTS numero_resolucion INTEGER;

-- Add new column to dte_cafs
ALTER TABLE dte_cafs
  ADD COLUMN IF NOT EXISTS caf_xml TEXT;

-- Add comments explaining the dual storage approach
COMMENT ON COLUMN dte_credentials.cert_base64 IS 'Base64 encoded PFX certificate for PHP bridge (LibreDTE)';
COMMENT ON COLUMN dte_credentials.cert_password IS 'Plain text password for PHP bridge (LibreDTE)';
COMMENT ON COLUMN dte_credentials.cert_ciphertext IS 'Encrypted PFX certificate for Node.js (node-forge)';
COMMENT ON COLUMN dte_credentials.pass_ciphertext IS 'Encrypted password for Node.js (node-forge)';
COMMENT ON COLUMN dte_credentials.rut_envia IS 'RUT of the person sending (representante legal)';
COMMENT ON COLUMN dte_credentials.fecha_resolucion IS 'Resolution date from SII';
COMMENT ON COLUMN dte_credentials.numero_resolucion IS 'Resolution number from SII';

COMMENT ON COLUMN dte_cafs.caf_xml IS 'Plain text CAF XML for PHP bridge (LibreDTE)';
COMMENT ON COLUMN dte_cafs.xml_ciphertext IS 'Encrypted CAF XML for Node.js (node-forge)';
