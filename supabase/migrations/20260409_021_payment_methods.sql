-- Migration 021: Payment methods tracking + cash register sessions

-- 1. Extend orders with payment tracking (all additive)
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_method TEXT NOT NULL DEFAULT 'pending'
    CHECK (payment_method IN ('digital', 'cash', 'mixed', 'pending'));

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS cash_amount     INTEGER DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS digital_amount  INTEGER DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS cash_registered_by   UUID REFERENCES auth.users(id);
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS cash_registered_at   TIMESTAMPTZ;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS hichapi_commission   INTEGER DEFAULT 0;

-- 2. Cash register sessions table
CREATE TABLE IF NOT EXISTS public.cash_register_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id   UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  opened_by       UUID NOT NULL REFERENCES auth.users(id),
  closed_by       UUID REFERENCES auth.users(id),
  opened_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at       TIMESTAMPTZ,
  opening_amount  INTEGER NOT NULL DEFAULT 0,
  actual_cash     INTEGER,
  total_digital   INTEGER DEFAULT 0,
  total_cash      INTEGER DEFAULT 0,
  total_orders    INTEGER DEFAULT 0,
  difference      INTEGER,
  notes           TEXT,
  status          TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed'))
);

ALTER TABLE public.cash_register_sessions ENABLE ROW LEVEL SECURITY;

-- RLS: restaurant admins see their own sessions
CREATE POLICY "restaurant_cash_sessions" ON public.cash_register_sessions
  FOR ALL USING (
    restaurant_id IN (
      SELECT restaurant_id FROM public.team_members
      WHERE user_id = auth.uid()
      AND active = true
      AND role IN ('owner','admin','supervisor','super_admin')
    )
    OR public.is_super_admin()
  );
