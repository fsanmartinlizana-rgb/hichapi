-- Migration: 20260420_020_stock_purchase_rls
-- RLS policies for purchase_orders, purchase_order_items, purchase_invoices
-- Requirements: 7.1, 8.1

-- ── Enable RLS ───────────────────────────────────────────────────────────────

ALTER TABLE public.purchase_orders       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_order_items  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_invoices     ENABLE ROW LEVEL SECURITY;

-- ── purchase_orders ──────────────────────────────────────────────────────────

-- admin/owner: full access scoped to their restaurant_id
DROP POLICY IF EXISTS "admin_manage_purchase_orders" ON public.purchase_orders;
CREATE POLICY "admin_manage_purchase_orders" ON public.purchase_orders
  FOR ALL
  USING  (public.is_admin_for(restaurant_id))
  WITH CHECK (public.is_admin_for(restaurant_id));

-- garzon: SELECT only on their restaurant's orders
DROP POLICY IF EXISTS "garzon_read_purchase_orders" ON public.purchase_orders;
CREATE POLICY "garzon_read_purchase_orders" ON public.purchase_orders
  FOR SELECT
  USING (restaurant_id = public.my_restaurant_id());

-- ── purchase_order_items ─────────────────────────────────────────────────────

-- admin/owner: full access via join to purchase_orders.restaurant_id
DROP POLICY IF EXISTS "admin_manage_purchase_order_items" ON public.purchase_order_items;
CREATE POLICY "admin_manage_purchase_order_items" ON public.purchase_order_items
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.purchase_orders po
      WHERE po.id = purchase_order_items.purchase_order_id
        AND public.is_admin_for(po.restaurant_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.purchase_orders po
      WHERE po.id = purchase_order_items.purchase_order_id
        AND public.is_admin_for(po.restaurant_id)
    )
  );

-- garzon: SELECT only via join to purchase_orders.restaurant_id
DROP POLICY IF EXISTS "garzon_read_purchase_order_items" ON public.purchase_order_items;
CREATE POLICY "garzon_read_purchase_order_items" ON public.purchase_order_items
  FOR SELECT
  USING (
    purchase_order_id IN (
      SELECT id FROM public.purchase_orders
      WHERE restaurant_id = public.my_restaurant_id()
    )
  );

-- ── purchase_invoices ────────────────────────────────────────────────────────

-- admin/owner: full access scoped to their restaurant_id
-- garzon: no access (invoices are financial data)
DROP POLICY IF EXISTS "admin_manage_purchase_invoices" ON public.purchase_invoices;
CREATE POLICY "admin_manage_purchase_invoices" ON public.purchase_invoices
  FOR ALL
  USING  (public.is_admin_for(restaurant_id))
  WITH CHECK (public.is_admin_for(restaurant_id));
