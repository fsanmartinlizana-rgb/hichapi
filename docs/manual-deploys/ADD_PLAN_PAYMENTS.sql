-- ─── Migración: Tabla de pagos y control de suscripción ──────────────────────
-- Ejecutar en: Supabase SQL Editor

-- 1. Tabla de pagos registrados (historial completo)
CREATE TABLE IF NOT EXISTS public.plan_payments (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id    uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  from_plan        text NOT NULL,
  to_plan          text NOT NULL,
  amount           integer NOT NULL,          -- Monto en CLP
  flow_token       text,                      -- Token de Flow para trazabilidad
  flow_order       text,                      -- commerceOrder enviado a Flow
  paid_at          timestamptz NOT NULL DEFAULT now(),
  next_billing_at  timestamptz NOT NULL,      -- paid_at + 30 días
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_plan_payments_restaurant_id ON public.plan_payments(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_plan_payments_next_billing  ON public.plan_payments(next_billing_at);

-- 2. Agregar columnas de control a restaurants (si no existen)
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS plan_paid_at       timestamptz,  -- Cuándo pagó la última vez
  ADD COLUMN IF NOT EXISTS plan_next_billing  timestamptz;  -- Cuándo vence y hay que cobrar de nuevo

-- 3. RLS: solo service_role puede escribir (el webhook usa Admin client)
ALTER TABLE public.plan_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "plan_payments: solo service_role"
  ON public.plan_payments
  FOR ALL
  USING (auth.role() = 'service_role');
