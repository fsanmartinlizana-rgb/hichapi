-- ════════════════════════════════════════════════════════════════════════════
--  Migration 058: Restaurant print settings for manual print control
--
--  Adds a print_settings JSONB column to restaurants to store:
--    - precuentaPrinterId: UUID of the print_server used for precuenta docs
--    - boletaPrinterId: UUID of the print_server used for boleta docs
--    - autoPreCuenta: boolean (false = manual control, default)
--    - printTimeout: milliseconds for print request timeout (default 10000)
--
--  This supports Requirements 5.1, 5.2, 5.3, 5.4 of the manual print control
--  feature, allowing the garzon panel to retrieve printer configuration per
--  document type.
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS print_settings JSONB NOT NULL DEFAULT '{
    "autoPreCuenta": false,
    "printTimeout": 10000
  }'::jsonb;

COMMENT ON COLUMN restaurants.print_settings IS
  'Print configuration for manual print control. Keys: precuentaPrinterId (UUID), boletaPrinterId (UUID), autoPreCuenta (bool), printTimeout (ms).';
