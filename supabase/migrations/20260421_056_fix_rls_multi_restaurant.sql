-- ── Fix RLS policies para usuarios con múltiples restaurants ─────────────
-- Bug reportado 2026-04-21: admins que son owner de 2+ restaurants (enterprise
-- multi-local) no pueden crear comandas en uno de ellos. El error:
--   "new row violates row-level security policy for table orders (42501)"
--
-- Causa: las policies usan `restaurant_id = my_restaurant_id()`. La función
-- my_restaurant_id() retorna UN solo restaurant_id (el "actual" del user),
-- diseñada para users mono-restaurant. Cuando el admin tiene 2+, la función
-- devuelve uno solo y si el INSERT/UPDATE/SELECT apunta al otro, la policy
-- rechaza la operación.
--
-- Fix: reemplazar `restaurant_id = my_restaurant_id()` por
-- `is_team_member(restaurant_id)` — función que valida membership en EL
-- restaurant específico al que se apunta (definida en migration 042).
-- Así cualquier admin con membership activa en ese restaurant puede operar
-- sin depender de cuál sea el "actual".
--
-- Afecta: orders (read, update), order_items (read, manage).
-- public_insert_order y public_insert_order_items no cambian (son
-- permissive con with_check=true, ya funcionan bien para INSERTs públicos
-- desde el QR de mesa).

-- ── orders.staff_read_orders ─────────────────────────────────────────────
DROP POLICY IF EXISTS staff_read_orders ON public.orders;
CREATE POLICY staff_read_orders ON public.orders
  FOR SELECT
  USING (
    public.is_super_admin()
    OR public.is_team_member(restaurant_id)
  );

-- ── orders.staff_update_orders ───────────────────────────────────────────
DROP POLICY IF EXISTS staff_update_orders ON public.orders;
CREATE POLICY staff_update_orders ON public.orders
  FOR UPDATE
  USING (
    public.is_super_admin()
    OR public.is_team_member(restaurant_id)
  );

-- ── order_items.staff_read_order_items ──────────────────────────────────
DROP POLICY IF EXISTS staff_read_order_items ON public.order_items;
CREATE POLICY staff_read_order_items ON public.order_items
  FOR SELECT
  USING (
    public.is_super_admin()
    OR order_id IN (
      SELECT o.id FROM public.orders o
      WHERE public.is_team_member(o.restaurant_id)
    )
  );

-- ── order_items.staff_manage_order_items ─────────────────────────────────
DROP POLICY IF EXISTS staff_manage_order_items ON public.order_items;
CREATE POLICY staff_manage_order_items ON public.order_items
  FOR ALL
  USING (
    public.is_super_admin()
    OR order_id IN (
      SELECT o.id FROM public.orders o
      WHERE public.is_team_member(o.restaurant_id)
    )
  );
