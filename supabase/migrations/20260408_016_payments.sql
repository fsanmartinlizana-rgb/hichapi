-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 016: Payment transactions (Stripe)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.payment_transactions (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id                  UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  stripe_payment_intent_id  TEXT NOT NULL UNIQUE,
  amount                    INTEGER NOT NULL,       -- CLP (no decimal)
  currency                  TEXT NOT NULL DEFAULT 'clp',
  status                    TEXT NOT NULL
                              CHECK (status IN ('pending', 'succeeded', 'failed', 'refunded')),
  split_index               INTEGER,                -- 1-based
  split_total               INTEGER,
  refund_reason             TEXT,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS payment_order_idx  ON public.payment_transactions (order_id);
CREATE INDEX IF NOT EXISTS payment_pi_idx     ON public.payment_transactions (stripe_payment_intent_id);

ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;

-- Admin+ can read transactions for their restaurant
CREATE POLICY "admin_read_payments" ON public.payment_transactions
  FOR SELECT USING (
    public.is_super_admin()
    OR order_id IN (
      SELECT id FROM public.orders
      WHERE restaurant_id = public.my_restaurant_id()
    )
  );

-- Only service role (Stripe webhook backend) can insert/update
-- No INSERT/UPDATE policy for normal users
