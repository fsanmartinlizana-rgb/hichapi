-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 014: Staff-aware RLS + garzon/super_admin roles
-- Run in Supabase SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Extend team_members role enum to include garzon + super_admin
ALTER TABLE public.team_members
  DROP CONSTRAINT IF EXISTS team_members_role_check;

ALTER TABLE public.team_members
  ADD CONSTRAINT team_members_role_check
  CHECK (role IN ('owner', 'admin', 'supervisor', 'garzon', 'waiter', 'super_admin'));

-- ── Helper functions ─────────────────────────────────────────────────────────

-- Returns the restaurant_id of the current authenticated user
CREATE OR REPLACE FUNCTION public.my_restaurant_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT restaurant_id
  FROM public.team_members
  WHERE user_id = auth.uid() AND active = true
  LIMIT 1;
$$;

-- Returns true if the current user is a super_admin
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_members
    WHERE user_id = auth.uid()
      AND role = 'super_admin'
      AND active = true
  );
$$;

-- Returns the role of the current user for a given restaurant
CREATE OR REPLACE FUNCTION public.my_role_for(p_restaurant_id UUID)
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT role FROM public.team_members
  WHERE user_id = auth.uid()
    AND restaurant_id = p_restaurant_id
    AND active = true
  LIMIT 1;
$$;

-- Returns true if user has at least admin-level access to a restaurant
CREATE OR REPLACE FUNCTION public.is_admin_for(p_restaurant_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_members
    WHERE user_id = auth.uid()
      AND restaurant_id = p_restaurant_id
      AND role IN ('owner', 'admin', 'super_admin')
      AND active = true
  ) OR (SELECT public.is_super_admin());
$$;

-- ── ORDERS RLS ────────────────────────────────────────────────────────────────

-- Drop overly permissive public read (replace with staff-only read)
DROP POLICY IF EXISTS "public_read_order" ON public.orders;
DROP POLICY IF EXISTS "owner_manage_orders" ON public.orders;

-- Anon clients (QR scan) can still INSERT orders
-- "public_insert_order" policy already exists — keep it

-- Staff can read orders for their restaurant; super_admin sees all
CREATE POLICY "staff_read_orders" ON public.orders
  FOR SELECT USING (
    public.is_super_admin()
    OR restaurant_id = public.my_restaurant_id()
  );

-- Staff (garzon+) can update orders for their restaurant
CREATE POLICY "staff_update_orders" ON public.orders
  FOR UPDATE USING (
    public.is_super_admin()
    OR restaurant_id = public.my_restaurant_id()
  );

-- Admin+ can delete orders
CREATE POLICY "admin_delete_orders" ON public.orders
  FOR DELETE USING (
    public.is_super_admin()
    OR public.is_admin_for(restaurant_id)
  );

-- ── ORDER_ITEMS RLS ──────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "public_read_order_items" ON public.order_items;
DROP POLICY IF EXISTS "owner_manage_order_items" ON public.order_items;

-- Staff can read order items for their restaurant
CREATE POLICY "staff_read_order_items" ON public.order_items
  FOR SELECT USING (
    public.is_super_admin()
    OR order_id IN (
      SELECT id FROM public.orders
      WHERE restaurant_id = public.my_restaurant_id()
    )
  );

-- Staff can manage order items
CREATE POLICY "staff_manage_order_items" ON public.order_items
  FOR ALL USING (
    public.is_super_admin()
    OR order_id IN (
      SELECT id FROM public.orders
      WHERE restaurant_id = public.my_restaurant_id()
    )
  );

-- ── TABLES RLS ───────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "owner_manage_tables" ON public.tables;

-- Keep "public_read_tables" — anon needs to resolve qr_token → table label

-- Staff can manage (insert/update/delete) tables for their restaurant
CREATE POLICY "staff_manage_tables" ON public.tables
  FOR ALL USING (
    public.is_super_admin()
    OR restaurant_id = public.my_restaurant_id()
  );

-- ── MENU_ITEMS RLS ───────────────────────────────────────────────────────────

ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_menu_items" ON public.menu_items;
DROP POLICY IF EXISTS "owner_manage_menu_items" ON public.menu_items;

-- Anon can read available items (Chapi + QR table experience)
CREATE POLICY "public_read_menu_items" ON public.menu_items
  FOR SELECT USING (true);

-- Admin+ can insert/update/delete menu items for their restaurant
CREATE POLICY "admin_manage_menu_items" ON public.menu_items
  FOR ALL USING (
    public.is_super_admin()
    OR (
      restaurant_id = public.my_restaurant_id()
      AND public.my_role_for(restaurant_id) IN ('owner', 'admin', 'supervisor')
    )
  );

-- ── RESTAURANTS RLS ──────────────────────────────────────────────────────────

ALTER TABLE public.restaurants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_restaurants" ON public.restaurants;
DROP POLICY IF EXISTS "owner_manage_restaurant" ON public.restaurants;

-- Anyone can read restaurant public profile (/r/[slug])
CREATE POLICY "public_read_restaurants" ON public.restaurants
  FOR SELECT USING (true);

-- Only the owner or super_admin can modify the restaurant record
CREATE POLICY "owner_manage_restaurant" ON public.restaurants
  FOR ALL USING (
    public.is_super_admin()
    OR owner_id = auth.uid()
  );

-- ── WAITLIST RLS ─────────────────────────────────────────────────────────────

ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;

-- Anon can insert (join the waitlist) and read their own entry by token
CREATE POLICY "public_join_waitlist" ON public.waitlist
  FOR INSERT WITH CHECK (true);

CREATE POLICY "public_read_waitlist_by_token" ON public.waitlist
  FOR SELECT USING (true);  -- token-based access is handled at app layer

-- Staff can manage waitlist for their restaurant
DROP POLICY IF EXISTS "staff_manage_waitlist" ON public.waitlist;
CREATE POLICY "staff_manage_waitlist" ON public.waitlist
  FOR ALL USING (
    public.is_super_admin()
    OR restaurant_id = public.my_restaurant_id()
  );

-- ── TEAM_MEMBERS RLS ─────────────────────────────────────────────────────────
-- Already set in migration 009, but ensure consistency

DROP POLICY IF EXISTS "team_read_own" ON public.team_members;
DROP POLICY IF EXISTS "owner_manage_team" ON public.team_members;

-- Users can read their own membership record
CREATE POLICY "team_read_own" ON public.team_members
  FOR SELECT USING (
    user_id = auth.uid()
    OR public.is_super_admin()
    OR restaurant_id IN (SELECT id FROM public.restaurants WHERE owner_id = auth.uid())
  );

-- Owner/admin can manage their team
CREATE POLICY "owner_manage_team" ON public.team_members
  FOR ALL USING (
    public.is_super_admin()
    OR restaurant_id IN (SELECT id FROM public.restaurants WHERE owner_id = auth.uid())
  );
