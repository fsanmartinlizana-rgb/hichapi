-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 012: Create `tables` table + add owner_id to restaurants
-- Run this in Supabase SQL Editor BEFORE running seed-demo.mjs
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Create the `tables` (mesas) table
CREATE TABLE IF NOT EXISTS public.tables (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  label         TEXT NOT NULL,
  seats         INT  NOT NULL DEFAULT 4,
  status        TEXT NOT NULL DEFAULT 'libre'
                  CHECK (status IN ('libre','ocupada','reservada','bloqueada')),
  zone          TEXT DEFAULT 'interior'
                  CHECK (zone IN ('interior','terraza','barra','privado')),
  smoking       BOOLEAN DEFAULT false,
  min_pax       INT DEFAULT 1,
  max_pax       INT DEFAULT 4,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Indexes
CREATE INDEX IF NOT EXISTS tables_restaurant_idx ON public.tables (restaurant_id);
CREATE INDEX IF NOT EXISTS tables_status_idx     ON public.tables (restaurant_id, status);

-- 3. RLS
ALTER TABLE public.tables ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read_tables" ON public.tables
  FOR SELECT USING (true);

CREATE POLICY "owner_manage_tables" ON public.tables
  FOR ALL USING (
    restaurant_id IN (
      SELECT id FROM restaurants WHERE owner_id = auth.uid()
    )
  );

-- 4. Add owner_id to restaurants (from migration 011 seed that references it)
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id);
