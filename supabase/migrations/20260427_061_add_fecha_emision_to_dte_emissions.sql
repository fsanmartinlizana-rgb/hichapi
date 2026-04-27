-- ══════════════════════════════════════════════════════════════════════════════
--  Migration: Add fecha_emision to dte_emissions
--  Date: 2026-04-27
--
--  Fixes the FAU rejection bug where the SII rejects factura status queries
--  because the date extracted from `emitted_at` (UTC timestamp) differs from
--  the `<FchEmis>` date in the XML (local date).
--
--  Solution: store the emission date (YYYY-MM-DD) separately so it can be
--  used directly in queryEstDteFactura without timezone conversion issues.
--
--  Requirements: 2.1, 3.4
-- ══════════════════════════════════════════════════════════════════════════════

-- Add the fecha_emision column (nullable to allow backfill)
ALTER TABLE dte_emissions
  ADD COLUMN IF NOT EXISTS fecha_emision TEXT;

-- Backfill existing rows: extract <FchEmis> from xml_signed when available
UPDATE dte_emissions
SET fecha_emision = substring(xml_signed FROM '<FchEmis>([^<]+)</FchEmis>')
WHERE fecha_emision IS NULL
  AND xml_signed IS NOT NULL
  AND xml_signed LIKE '%<FchEmis>%';

-- Fallback: for rows without xml_signed, extract date from emitted_at
-- (best effort — these rows may still have the timezone mismatch issue
--  but at least they'll have a value for the column)
UPDATE dte_emissions
SET fecha_emision = (emitted_at::timestamptz AT TIME ZONE 'America/Santiago')::date::text
WHERE fecha_emision IS NULL
  AND emitted_at IS NOT NULL;

-- Add a comment documenting the column purpose
COMMENT ON COLUMN dte_emissions.fecha_emision IS
  'Emission date (YYYY-MM-DD) in local Chile time, matching the <FchEmis> field in the signed XML. '
  'Stored separately from emitted_at (UTC timestamp) to avoid timezone mismatch when querying SII status.';
