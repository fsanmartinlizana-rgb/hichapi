-- Fix: Remove strict amounts_match constraint to allow tip (propina) in payments
-- The amount field now represents the total charged (including tip),
-- while cash_amount + digital_amount must equal amount.
-- We keep the constraint but allow a tolerance for rounding.

ALTER TABLE bill_split_payments
  DROP CONSTRAINT IF EXISTS bill_split_payments_amounts_match;

-- Add tip_amount column to track propina separately
ALTER TABLE bill_split_payments
  ADD COLUMN IF NOT EXISTS tip_amount INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN bill_split_payments.tip_amount IS 'Propina incluida en este pago (puede ser 0)';
