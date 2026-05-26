-- ─── Migración: Facturación Diferida y Periodo de Prueba ──────────────────────
-- Ejecutar en: Supabase SQL Editor

-- 1. Agregar columnas de estado a restaurants
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS trial_ends_at       timestamptz,
  ADD COLUMN IF NOT EXISTS subscription_status text DEFAULT 'active';

-- 2. Tabla para registrar cobros generados (invoices)
CREATE TABLE IF NOT EXISTS public.invoices (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id    uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  period_start     timestamptz NOT NULL,
  period_end       timestamptz NOT NULL,
  plan_base_price  integer NOT NULL,          -- Costo fijo del plan (ej. 59990)
  sales_total      numeric(12,2) NOT NULL,    -- Suma de ventas (comandas)
  sales_commission numeric(12,2) NOT NULL,    -- 1% de sales_total
  total_amount     integer NOT NULL,          -- plan_base_price + sales_commission
  status           text NOT NULL DEFAULT 'pending', -- pending, paid, canceled
  flow_url         text,                      -- Link de pago generado
  flow_token       text,                      -- Token de Flow para el webhook
  paid_at          timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_invoices_restaurant_id ON public.invoices(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON public.invoices(status);

-- 3. RLS
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invoices: solo service_role"
  ON public.invoices
  FOR ALL
  USING (auth.role() = 'service_role');

-- (Opcional) Los admins del restaurante pueden ver sus facturas:
CREATE POLICY "invoices: usuarios ven las de su restaurante"
  ON public.invoices
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM team_members 
      WHERE team_members.restaurant_id = invoices.restaurant_id 
      AND team_members.user_id = auth.uid()
    )
  );
