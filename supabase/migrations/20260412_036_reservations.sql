-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  Sprint 16 — Reservations system                                       ║
-- ║  Separate from waitlist (waitlist = internal host management)           ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- ── 1. Reservations table ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS reservations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id   uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  table_id        uuid REFERENCES tables(id) ON DELETE SET NULL,

  -- Customer info
  name            text NOT NULL,
  phone           text NOT NULL,
  email           text,
  party_size      int NOT NULL CHECK (party_size BETWEEN 1 AND 20),
  notes           text CHECK (char_length(notes) <= 500),

  -- Reservation timing
  reservation_date  date NOT NULL,
  reservation_time  time NOT NULL,
  duration_min      int NOT NULL DEFAULT 90,  -- expected duration

  -- Status flow: pending → confirmed → seated → completed | no_show | cancelled
  status          text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','confirmed','seated','completed','no_show','cancelled')),

  -- Token for customer status lookup
  token           text UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),

  -- Timestamps
  confirmed_at    timestamptz,
  seated_at       timestamptz,
  completed_at    timestamptz,
  no_show_at      timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),

  -- Composite unique: prevent double-booking same slot
  CONSTRAINT no_duplicate_reservation UNIQUE (restaurant_id, phone, reservation_date, reservation_time)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_reservations_restaurant_date
  ON reservations (restaurant_id, reservation_date, status);

CREATE INDEX IF NOT EXISTS idx_reservations_token
  ON reservations (token);

CREATE INDEX IF NOT EXISTS idx_reservations_status
  ON reservations (restaurant_id, status)
  WHERE status IN ('pending', 'confirmed');

-- ── 2. Restaurant settings for reservations ─────────────────────────────────

ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS reservations_enabled     boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reservation_timeout_min  int NOT NULL DEFAULT 15,
  ADD COLUMN IF NOT EXISTS reservation_slot_duration int NOT NULL DEFAULT 90,
  ADD COLUMN IF NOT EXISTS reservation_max_party    int NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS reservation_advance_days int NOT NULL DEFAULT 30;

COMMENT ON COLUMN restaurants.reservations_enabled IS 'Whether the restaurant accepts online reservations via HiChapi';
COMMENT ON COLUMN restaurants.reservation_timeout_min IS 'Minutes after reservation time before auto-releasing as no-show';
COMMENT ON COLUMN restaurants.reservation_slot_duration IS 'Default reservation duration in minutes';
COMMENT ON COLUMN restaurants.reservation_max_party IS 'Maximum party size for online reservations';
COMMENT ON COLUMN restaurants.reservation_advance_days IS 'How many days in advance can customers book';

-- ── 3. RLS Policies ─────────────────────────────────────────────────────────

ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;

-- Anyone can create a reservation (public)
CREATE POLICY reservations_public_insert ON reservations
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

-- Anyone can read their own reservation via token (handled via RPC)
-- Staff can manage reservations for their restaurant
CREATE POLICY reservations_staff_all ON reservations
  FOR ALL TO authenticated
  USING (
    restaurant_id IN (
      SELECT tm.restaurant_id FROM team_members tm WHERE tm.user_id = auth.uid()
    )
    OR EXISTS (SELECT 1 FROM team_members tm WHERE tm.user_id = auth.uid() AND tm.role = 'super_admin')
  )
  WITH CHECK (
    restaurant_id IN (
      SELECT tm.restaurant_id FROM team_members tm WHERE tm.user_id = auth.uid()
    )
    OR EXISTS (SELECT 1 FROM team_members tm WHERE tm.user_id = auth.uid() AND tm.role = 'super_admin')
  );

-- ── 4. RPC for token-based lookup (public / anon) ───────────────────────────

CREATE OR REPLACE FUNCTION get_reservation_by_token(p_token text)
RETURNS TABLE (
  id uuid, restaurant_id uuid, name text, phone text, party_size int,
  reservation_date date, reservation_time time, status text,
  notes text, token text, created_at timestamptz,
  confirmed_at timestamptz, seated_at timestamptz
)
LANGUAGE sql SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.id, r.restaurant_id, r.name, r.phone, r.party_size,
         r.reservation_date, r.reservation_time, r.status,
         r.notes, r.token, r.created_at,
         r.confirmed_at, r.seated_at
  FROM reservations r
  WHERE r.token = p_token
  LIMIT 1;
$$;

-- ── 5. Auto no-show function (called by cron or on-demand) ──────────────────

CREATE OR REPLACE FUNCTION mark_noshow_reservations()
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected int;
BEGIN
  UPDATE reservations r
  SET status = 'no_show',
      no_show_at = now()
  FROM restaurants rest
  WHERE r.restaurant_id = rest.id
    AND r.status IN ('pending', 'confirmed')
    AND (r.reservation_date + r.reservation_time) < (now() - (rest.reservation_timeout_min || ' minutes')::interval);

  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;

-- ── 6. Availability helper ──────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION check_reservation_availability(
  p_restaurant_id uuid,
  p_date date,
  p_time time,
  p_party_size int DEFAULT 2,
  p_duration_min int DEFAULT 90
)
RETURNS TABLE (available boolean, total_tables int, reserved_count int, available_tables int)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total int;
  v_reserved int;
BEGIN
  -- Count total tables that fit the party
  SELECT count(*) INTO v_total
  FROM tables t
  WHERE t.restaurant_id = p_restaurant_id
    AND t.seats >= p_party_size
    AND t.status != 'bloqueada';

  -- Count reservations that overlap this time slot
  SELECT count(*) INTO v_reserved
  FROM reservations r
  WHERE r.restaurant_id = p_restaurant_id
    AND r.reservation_date = p_date
    AND r.status IN ('pending', 'confirmed', 'seated')
    AND (
      -- Overlap check: new slot [p_time, p_time+duration] overlaps [existing_time, existing_time+duration]
      (r.reservation_time, (r.reservation_time + (r.duration_min || ' minutes')::interval)::time)
      OVERLAPS
      (p_time, (p_time + (p_duration_min || ' minutes')::interval)::time)
    );

  RETURN QUERY SELECT
    (v_total - v_reserved) > 0,
    v_total,
    v_reserved,
    GREATEST(v_total - v_reserved, 0);
END;
$$;
