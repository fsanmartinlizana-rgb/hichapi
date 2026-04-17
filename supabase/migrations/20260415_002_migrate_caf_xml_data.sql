-- ══════════════════════════════════════════════════════════════════════════════
--  Migration: Populate caf_xml from encrypted data
--  
--  This migration decrypts existing CAF XML data and populates the new caf_xml
--  column for use with the PHP bridge. This is a one-time data migration.
--  
--  Note: This requires the decrypt function to be available. If you're using
--  Supabase with the DTE_MASTER_KEY, you'll need to run this migration through
--  your application code instead of directly in SQL.
-- ══════════════════════════════════════════════════════════════════════════════

-- This migration intentionally left empty because decryption requires the
-- DTE_MASTER_KEY which is only available in the application layer, not in SQL.
--
-- Instead, we'll create an API endpoint to migrate the data.

COMMENT ON COLUMN dte_cafs.caf_xml IS 'Plain text CAF XML for PHP bridge - populated via API migration endpoint';
