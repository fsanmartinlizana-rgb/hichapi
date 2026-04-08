-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 017: Stock adjustment RPC (atomic, avoids race conditions)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.adjust_stock(
  p_stock_item_id UUID,
  p_delta         NUMERIC
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.stock_items
  SET
    current_qty = GREATEST(0, current_qty + p_delta),
    updated_at  = now()
  WHERE id = p_stock_item_id;
END;
$$;
