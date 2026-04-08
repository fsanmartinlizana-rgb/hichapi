-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 018: Shifts + shift templates
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Shift templates (reusable weekly patterns)
CREATE TABLE IF NOT EXISTS public.shift_templates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id   UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,           -- "Turno mañana", "Turno tarde"
  day_of_week     INT  NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Domingo
  start_time      TIME NOT NULL,
  end_time        TIME NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS shift_tmpl_restaurant_idx ON public.shift_templates (restaurant_id, day_of_week);

-- 2. Shifts: concrete shift instances per day
CREATE TABLE IF NOT EXISTS public.shifts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id   UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  template_id     UUID REFERENCES shift_templates(id) ON DELETE SET NULL,
  staff_id        UUID NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
  shift_date      DATE NOT NULL,
  start_time      TIME NOT NULL,
  end_time        TIME NOT NULL,
  tables_assigned UUID[] DEFAULT '{}',     -- array of table UUIDs
  status          TEXT NOT NULL DEFAULT 'scheduled'
                    CHECK (status IN ('scheduled', 'open', 'closed', 'no_show')),
  opened_at       TIMESTAMPTZ,
  closed_at       TIMESTAMPTZ,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS shifts_restaurant_date_idx ON public.shifts (restaurant_id, shift_date);
CREATE INDEX IF NOT EXISTS shifts_staff_idx           ON public.shifts (staff_id, shift_date);

-- 3. RLS

ALTER TABLE public.shift_templates  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shifts            ENABLE ROW LEVEL SECURITY;

-- Templates: admin+ can manage, staff can read
CREATE POLICY "admin_manage_shift_templates" ON public.shift_templates
  FOR ALL USING (
    public.is_super_admin()
    OR (
      restaurant_id = public.my_restaurant_id()
      AND public.my_role_for(restaurant_id) IN ('owner', 'admin', 'supervisor')
    )
  );

CREATE POLICY "staff_read_shift_templates" ON public.shift_templates
  FOR SELECT USING (
    public.is_super_admin()
    OR restaurant_id = public.my_restaurant_id()
  );

-- Shifts: admin+ can manage, assigned staff can read their own
CREATE POLICY "admin_manage_shifts" ON public.shifts
  FOR ALL USING (
    public.is_super_admin()
    OR (
      restaurant_id = public.my_restaurant_id()
      AND public.my_role_for(restaurant_id) IN ('owner', 'admin', 'supervisor')
    )
  );

CREATE POLICY "staff_read_own_shifts" ON public.shifts
  FOR SELECT USING (
    public.is_super_admin()
    OR restaurant_id = public.my_restaurant_id()
  );

-- Realtime for shift status updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.shifts;
