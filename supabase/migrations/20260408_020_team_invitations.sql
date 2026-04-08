-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 020: Add cocina/anfitrion roles + invitation support on team_members
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Extend roles to include cocina + anfitrion
ALTER TABLE public.team_members
  DROP CONSTRAINT IF EXISTS team_members_role_check;

ALTER TABLE public.team_members
  ADD CONSTRAINT team_members_role_check
  CHECK (role IN ('owner','admin','supervisor','garzon','waiter','cocina','anfitrion','super_admin'));

-- 2. Add invitation columns
ALTER TABLE public.team_members
  ADD COLUMN IF NOT EXISTS invited_email TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('pending','active','revoked'));

-- 3. Allow NULL user_id for pending invitations
ALTER TABLE public.team_members
  DROP CONSTRAINT IF EXISTS team_members_restaurant_id_user_id_key;

-- New unique constraint: one active/pending entry per email per restaurant
CREATE UNIQUE INDEX IF NOT EXISTS team_members_restaurant_email_unique
  ON public.team_members (restaurant_id, invited_email)
  WHERE status != 'revoked';

-- 4. Allow admin/owner to read all team members of their restaurant (not just own row)
DROP POLICY IF EXISTS "admin_read_team_members" ON public.team_members;
CREATE POLICY "admin_read_team_members" ON public.team_members
  FOR SELECT USING (
    public.is_super_admin()
    OR user_id = auth.uid()
    OR restaurant_id IN (
      SELECT id FROM public.restaurants WHERE owner_id = auth.uid()
    )
    OR (
      restaurant_id = public.my_restaurant_id()
      AND public.my_role_for(public.my_restaurant_id()) IN ('admin','owner','supervisor')
    )
  );
