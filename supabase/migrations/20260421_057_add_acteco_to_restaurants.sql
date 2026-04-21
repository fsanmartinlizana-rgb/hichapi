-- ══════════════════════════════════════════════════════════════════════════════
-- Migration: Add acteco field to restaurants table
-- 
-- The acteco (código de actividad económica) is required for DTE emissions,
-- specifically for facturas (invoices). This field stores the economic activity
-- code that identifies the business type for tax purposes.
-- ══════════════════════════════════════════════════════════════════════════════

-- Add acteco field to restaurants table
ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS acteco TEXT;

-- Add comment explaining the field
COMMENT ON COLUMN restaurants.acteco IS 
  'Código de actividad económica del SII. Requerido para emisión de facturas electrónicas (DTE tipo 33, 56, 61).';

-- Update existing restaurants with a default acteco for food services
-- 463020 = "Venta al por menor de comidas preparadas en puestos de venta móviles"
-- This is a common code for restaurants and food services
UPDATE restaurants 
SET acteco = '463020' 
WHERE acteco IS NULL;