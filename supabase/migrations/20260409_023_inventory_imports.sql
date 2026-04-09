-- Migration 023: Inventory imports tracking

CREATE TABLE IF NOT EXISTS public.inventory_imports (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id   UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  import_type     TEXT NOT NULL CHECK (import_type IN ('manual','excel','photo','csv','pdf')),
  source_url      TEXT,
  raw_extraction  JSONB,
  imported_items  INTEGER DEFAULT 0,
  errors          JSONB,
  status          TEXT DEFAULT 'pending' CHECK (status IN ('pending','processing','completed','failed')),
  created_by      UUID REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.inventory_imports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "restaurant_inventory_imports" ON public.inventory_imports
  FOR ALL USING (
    restaurant_id IN (
      SELECT restaurant_id FROM public.team_members
      WHERE user_id = auth.uid() AND active = true
    )
    OR public.is_super_admin()
  );
