-- ════════════════════════════════════════════════════════════════════════════
-- 034 — Notifications system
-- ════════════════════════════════════════════════════════════════════════════
-- Centralized notification stream per restaurant. Replaces the scattered
-- per-page toast/banner pattern (stock alerts in /comandas, etc.) with a
-- single source of truth visible from the bell in the sidebar.
--
-- Each notification can carry an "action shortcut" (action_url + action_label)
-- so the user can jump straight to the page that solves the problem.
--
-- Retention: notifications older than 10 days are auto-purged on read.
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.notifications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id   UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,

  -- Classification
  type            TEXT NOT NULL,            -- 'stock_low' | 'stock_out' | 'item_86' | 'caja_open' | 'dte_pending' | ...
  severity        TEXT NOT NULL DEFAULT 'info'
                  CHECK (severity IN ('info','success','warning','critical')),
  category        TEXT NOT NULL DEFAULT 'operacion'
                  CHECK (category IN ('operacion','inventario','caja','dte','equipo','sistema')),

  -- Content
  title           TEXT NOT NULL,
  message         TEXT,

  -- Optional shortcut to fix / handle the issue
  action_url      TEXT,
  action_label    TEXT,

  -- De-duplication: a stable key per (restaurant, dedupe_key) prevents
  -- spamming the bell when the same condition keeps firing (e.g. realtime
  -- low-stock pings every few seconds).
  dedupe_key      TEXT,

  -- Free-form payload (e.g. { stock_item_id, qty, threshold })
  metadata        JSONB DEFAULT '{}'::jsonb,

  -- State
  is_read         BOOLEAN NOT NULL DEFAULT false,
  read_at         TIMESTAMPTZ,
  resolved_at     TIMESTAMPTZ,             -- set when the user clicked the action / fixed it

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at      TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '10 days')
);

-- Indexes
CREATE INDEX IF NOT EXISTS notifications_restaurant_created_idx
  ON public.notifications (restaurant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS notifications_restaurant_unread_idx
  ON public.notifications (restaurant_id, is_read)
  WHERE is_read = false;

-- Unique-ish dedupe within last 24h: implemented at app level via UPSERT,
-- but we add a partial index for quick lookups.
CREATE INDEX IF NOT EXISTS notifications_dedupe_idx
  ON public.notifications (restaurant_id, dedupe_key, created_at DESC)
  WHERE dedupe_key IS NOT NULL;

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Drop legacy policies if re-running
DROP POLICY IF EXISTS notifications_select   ON public.notifications;
DROP POLICY IF EXISTS notifications_insert   ON public.notifications;
DROP POLICY IF EXISTS notifications_update   ON public.notifications;
DROP POLICY IF EXISTS notifications_delete   ON public.notifications;

-- Members of the restaurant can see and update notifications
CREATE POLICY notifications_select ON public.notifications
  FOR SELECT
  USING (
    restaurant_id IN (
      SELECT restaurant_id FROM public.team_members
      WHERE user_id = auth.uid() AND active = true
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

CREATE POLICY notifications_insert ON public.notifications
  FOR INSERT
  WITH CHECK (
    restaurant_id IN (
      SELECT restaurant_id FROM public.team_members
      WHERE user_id = auth.uid() AND active = true
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

CREATE POLICY notifications_update ON public.notifications
  FOR UPDATE
  USING (
    restaurant_id IN (
      SELECT restaurant_id FROM public.team_members
      WHERE user_id = auth.uid() AND active = true
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

CREATE POLICY notifications_delete ON public.notifications
  FOR DELETE
  USING (
    restaurant_id IN (
      SELECT restaurant_id FROM public.team_members
      WHERE user_id = auth.uid() AND active = true
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

-- ── Realtime ─────────────────────────────────────────────────────────────────
-- Lets the bell badge update live when a notification is created elsewhere.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- Publication may not exist in some environments, that's fine.
  NULL;
END $$;

-- ── Auto-purge ───────────────────────────────────────────────────────────────
-- Helper function: deletes notifications past their expires_at.
-- Called from the API on every list request so we don't need a cron.
CREATE OR REPLACE FUNCTION public.purge_expired_notifications()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  DELETE FROM public.notifications
  WHERE expires_at < now();
$$;
