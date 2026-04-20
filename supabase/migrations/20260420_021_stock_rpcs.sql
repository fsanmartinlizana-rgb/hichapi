-- Migration: 20260420_021_stock_rpcs
-- Requirements: 3.1, 3.2, 3.3, 7.6

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. deduct_order_stock(p_order_id UUID) — idempotent
--    Deducts stock for each ingredient × portions in an order.
--    Idempotent: if movements of type 'orden' already exist for this order,
--    returns early without double-deducting.
--    Allows stock to go negative (no GREATEST(0, ...) guard).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.deduct_order_stock(p_order_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_order      RECORD;
  v_item       RECORD;
  v_ingredient RECORD;
  v_deduction  NUMERIC;
  v_results    JSONB := '[]'::jsonb;
  v_exists     INTEGER;
BEGIN
  -- Idempotency check: if movements of type 'orden' already exist for this order, return early
  SELECT COUNT(*) INTO v_exists
  FROM public.stock_movements
  WHERE order_id = p_order_id
    AND reason = 'orden';

  IF v_exists > 0 THEN
    RETURN jsonb_build_object('ok', true, 'skipped', true, 'reason', 'already_deducted');
  END IF;

  -- Get order with restaurant_id
  SELECT id, restaurant_id INTO v_order
  FROM public.orders
  WHERE id = p_order_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'order not found');
  END IF;

  -- Loop through order items
  FOR v_item IN
    SELECT oi.quantity, oi.menu_item_id, mi.ingredients
    FROM public.order_items oi
    JOIN public.menu_items mi ON mi.id = oi.menu_item_id
    WHERE oi.order_id = p_order_id
      AND mi.ingredients IS NOT NULL
      AND jsonb_array_length(mi.ingredients) > 0
  LOOP
    -- Loop through ingredients of each menu item
    FOR v_ingredient IN
      SELECT * FROM jsonb_array_elements(v_item.ingredients)
    LOOP
      v_deduction := (v_ingredient.value->>'qty')::numeric * v_item.quantity;

      -- Deduct stock — allow negative (Req 3.4)
      UPDATE public.stock_items
      SET current_qty = current_qty - v_deduction,
          updated_at  = now()
      WHERE id = (v_ingredient.value->>'stock_item_id')::uuid;

      -- Log movement
      INSERT INTO public.stock_movements (restaurant_id, stock_item_id, delta, reason, order_id)
      VALUES (
        v_order.restaurant_id,
        (v_ingredient.value->>'stock_item_id')::uuid,
        -v_deduction,
        'orden',
        p_order_id
      );

      v_results := v_results || jsonb_build_array(
        jsonb_build_object(
          'stock_item_id', v_ingredient.value->>'stock_item_id',
          'deducted', v_deduction
        )
      );
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'deductions', v_results);
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. reverse_purchase_order_stock(p_purchase_order_id UUID)
--    Reverses stock increments from a received purchase order.
--    Subtracts each movement's delta back from stock_items, then deletes
--    the movements so they can be re-applied with corrected quantities.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.reverse_purchase_order_stock(
  p_purchase_order_id UUID
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Revert each purchase movement: subtract the delta that was previously added
  UPDATE public.stock_items si
  SET current_qty = si.current_qty - sm.delta,
      updated_at  = now()
  FROM public.stock_movements sm
  WHERE sm.purchase_order_id = p_purchase_order_id
    AND sm.reason = 'compra'
    AND si.id = sm.stock_item_id;

  -- Delete the reverted movements
  DELETE FROM public.stock_movements
  WHERE purchase_order_id = p_purchase_order_id
    AND reason = 'compra';
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. recalculate_stock_from_movements(p_stock_item_ids UUID[])
--    Recalculates current_qty for each given stock_item as the sum of all
--    its movement deltas. Used after reversals to ensure consistency.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.recalculate_stock_from_movements(
  p_stock_item_ids UUID[]
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_id UUID;
BEGIN
  FOREACH v_id IN ARRAY p_stock_item_ids
  LOOP
    UPDATE public.stock_items
    SET current_qty = (
          SELECT COALESCE(SUM(delta), 0)
          FROM public.stock_movements
          WHERE stock_item_id = v_id
        ),
        updated_at = now()
    WHERE id = v_id;
  END LOOP;
END;
$$;
