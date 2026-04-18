-- Migration: Ensure demo restaurant has all required DTE fields
-- This fixes the issue where RUT and razon_social were not set in previous migrations

UPDATE restaurants
SET
  rut           = '77042148-9',
  razon_social  = 'RESTAURANT DEMO SPA',
  giro          = 'VENTA AL POR MAYOR DE BEBIDAS ALCOHOLICAS Y NO ALCOHOLICAS',
  direccion     = 'Av. Ejemplo 123',
  comuna        = 'Ovalle',
  dte_enabled   = true,
  dte_environment = 'certificacion'
WHERE id = '2c8864cd-84a8-4517-b4c1-920b5f6c25f1';
