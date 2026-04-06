-- ─────────────────────────────────────────────────────────────────────────────
-- waitlist_entries: restaurant walk-in queue with dynamic ETA
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS waitlist_entries (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id      uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  table_id           uuid REFERENCES tables(id) ON DELETE SET NULL,
  name               text NOT NULL,
  phone              text NOT NULL,
  party_size         int  NOT NULL CHECK (party_size >= 1 AND party_size <= 20),
  token              text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  status             text NOT NULL DEFAULT 'waiting'
                       CHECK (status IN ('waiting','notified','seated','cancelled')),
  position           int  NOT NULL,
  joined_at          timestamptz NOT NULL DEFAULT now(),
  notified_at        timestamptz,
  seated_at          timestamptz,
  estimated_wait_min int,
  notes              text,
  created_at         timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS waitlist_restaurant_status_pos
  ON waitlist_entries (restaurant_id, status, position);

CREATE INDEX IF NOT EXISTS waitlist_token_idx
  ON waitlist_entries (token);

-- ─────────────────────────────────────────────────────────────────────────────
-- Trigger: reorder positions when an entry leaves the queue
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION reorder_waitlist_positions()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE waitlist_entries w
  SET    position = sub.new_pos
  FROM (
    SELECT id,
           ROW_NUMBER() OVER (ORDER BY joined_at) AS new_pos
    FROM   waitlist_entries
    WHERE  restaurant_id = OLD.restaurant_id
      AND  status = 'waiting'
  ) sub
  WHERE w.id = sub.id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_reorder_waitlist
AFTER UPDATE OF status ON waitlist_entries
FOR EACH ROW
WHEN (NEW.status IN ('seated', 'cancelled'))
EXECUTE FUNCTION reorder_waitlist_positions();

-- ─────────────────────────────────────────────────────────────────────────────
-- RPC: safe public token lookup (SECURITY DEFINER bypasses RLS for anon)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_waitlist_entry_by_token(p_token text)
RETURNS SETOF waitlist_entries
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT * FROM waitlist_entries WHERE token = p_token LIMIT 1;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE waitlist_entries ENABLE ROW LEVEL SECURITY;

-- Anyone can join (INSERT)
CREATE POLICY "public_can_join" ON waitlist_entries
  FOR INSERT WITH CHECK (true);

-- Staff can manage their restaurant's queue
CREATE POLICY "staff_manage_waitlist" ON waitlist_entries
  FOR ALL USING (
    restaurant_id IN (
      SELECT id FROM restaurants WHERE owner_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- Realtime
-- ─────────────────────────────────────────────────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE waitlist_entries;
