-- Prevent duplicate active emissions for the same order
-- Uses a partial unique index: only one non-cancelled emission per order
CREATE UNIQUE INDEX IF NOT EXISTS dte_emissions_order_active_unique
  ON dte_emissions (order_id)
  WHERE status NOT IN ('cancelled');
