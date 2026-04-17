-- Migration: Add missing DTE fields to restaurants table
-- Adds 'comuna' and 'direccion' columns needed for DTE XML generation
-- 'address' is the generic address field; 'direccion' is the SII-specific one

ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS comuna    TEXT,
  ADD COLUMN IF NOT EXISTS direccion TEXT;

-- Backfill direccion from address for existing rows
UPDATE restaurants
SET direccion = address
WHERE direccion IS NULL AND address IS NOT NULL;

-- Update the demo restaurant with correct DTE data
UPDATE restaurants
SET
  giro      = 'VENTA AL POR MAYOR DE BEBIDAS ALCOHOLICAS Y NO ALCOHOLICAS',
  direccion = 'Av. Ejemplo 123',
  comuna    = 'Ovalle'
WHERE id = '2c8864cd-84a8-4517-b4c1-920b5f6c25f1';
