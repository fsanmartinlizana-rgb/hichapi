-- ════════════════════════════════════════════════════════════════════════════
--  Sprint 14 — Print server: registered devices + job queue
--
--  Architecture: a small Node agent runs on each restaurant's local network
--  (print-server/ subpackage), authenticates with a token, and subscribes to
--  Supabase Realtime on `print_jobs` rows it owns. On new job → it sends ESC/POS
--  bytes to the configured printer. Status flows back via PATCH on the same row.
-- ════════════════════════════════════════════════════════════════════════════

-- 1. Registered print servers (one per local agent install) ─────────────────

CREATE TABLE IF NOT EXISTS print_servers (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name          TEXT NOT NULL, -- e.g. "Cocina principal", "Caja"
  token_hash    TEXT NOT NULL UNIQUE, -- sha256(token)
  printer_kind  TEXT NOT NULL DEFAULT 'network'
    CHECK (printer_kind IN ('network', 'usb', 'serial')),
  printer_addr  TEXT, -- ip:port for network, /dev/usb/lp0 for usb, etc
  paper_width   INTEGER NOT NULL DEFAULT 32, -- chars per line (32 = 58mm, 48 = 80mm)
  active        BOOLEAN NOT NULL DEFAULT true,
  last_seen_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS print_servers_restaurant_idx
  ON print_servers (restaurant_id, active);

ALTER TABLE print_servers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_read_print_servers" ON print_servers
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.restaurant_id = print_servers.restaurant_id
        AND tm.user_id = auth.uid()
        AND tm.active = true
    )
  );

CREATE POLICY "owner_admin_modify_print_servers" ON print_servers
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.restaurant_id = print_servers.restaurant_id
        AND tm.user_id = auth.uid()
        AND tm.active = true
        AND tm.role IN ('owner', 'admin')
    )
  );

-- 2. Print jobs queue ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS print_jobs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  server_id     UUID NOT NULL REFERENCES print_servers(id) ON DELETE CASCADE,
  job_type      TEXT NOT NULL
    CHECK (job_type IN ('receipt', 'kitchen_ticket', 'bar_ticket', 'cash_close', 'test')),
  payload       JSONB NOT NULL, -- { lines: [...], copies, header, footer }
  status        TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'printing', 'completed', 'failed')),
  attempts      INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  created_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  printed_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS print_jobs_pending_idx
  ON print_jobs (server_id, created_at)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS print_jobs_restaurant_idx
  ON print_jobs (restaurant_id, created_at DESC);

ALTER TABLE print_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_read_print_jobs" ON print_jobs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.restaurant_id = print_jobs.restaurant_id
        AND tm.user_id = auth.uid()
        AND tm.active = true
    )
  );

CREATE POLICY "staff_create_print_jobs" ON print_jobs
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.restaurant_id = print_jobs.restaurant_id
        AND tm.user_id = auth.uid()
        AND tm.active = true
    )
  );

-- Realtime: enable for print_jobs so the agent can subscribe to INSERTs
ALTER PUBLICATION supabase_realtime ADD TABLE print_jobs;

COMMENT ON TABLE print_servers IS
  'Local print agents. token_hash is sha256 of the bearer token issued at registration.';
COMMENT ON TABLE print_jobs IS
  'Queue of print jobs. Agents subscribe via Supabase Realtime and PATCH status as they progress.';
