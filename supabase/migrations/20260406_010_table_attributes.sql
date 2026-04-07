-- Migration: table attributes + WhatsApp config + menu stock enhancements
-- 20260406_010_table_attributes.sql

-- ── Table zone & smoking attributes ──────────────────────────────────────────
ALTER TABLE tables
  ADD COLUMN IF NOT EXISTS zone        TEXT    DEFAULT 'interior'
                                       CHECK (zone IN ('interior', 'terraza', 'barra', 'privado')),
  ADD COLUMN IF NOT EXISTS smoking     BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS min_pax     INT     DEFAULT 1,
  ADD COLUMN IF NOT EXISTS max_pax     INT     DEFAULT 4;

-- ── Reservation expiry ───────────────────────────────────────────────────────
ALTER TABLE reservations
  ADD COLUMN IF NOT EXISTS reserved_until  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS hold_minutes    INT  DEFAULT 15,  -- grace period before auto-release
  ADD COLUMN IF NOT EXISTS auto_released   BOOLEAN DEFAULT false;

-- ── WhatsApp & Chapi config per restaurant ───────────────────────────────────
ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS whatsapp_number          TEXT,
  ADD COLUMN IF NOT EXISTS chapi_waitlist_enabled   BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS chapi_waitlist_start_min INT     DEFAULT 10,  -- minutes before turn
  ADD COLUMN IF NOT EXISTS chapi_init_message       TEXT    DEFAULT 'Hola! Mientras esperas tu mesa, puedes ver nuestra carta y elegir tu pedido para que lo tengamos listo al sentarte 🍽';

-- ── Menu item stock tracking ─────────────────────────────────────────────────
ALTER TABLE menu_items
  ADD COLUMN IF NOT EXISTS stock_status  TEXT DEFAULT 'available'
                                         CHECK (stock_status IN ('available', 'low_stock', 'out_of_stock', '86')),
  ADD COLUMN IF NOT EXISTS stock_qty     INT,   -- NULL = unlimited
  ADD COLUMN IF NOT EXISTS quiebre_note  TEXT;  -- reason for 86 (e.g. "se terminó el risotto")

-- Function: auto-release expired reservations
CREATE OR REPLACE FUNCTION auto_release_expired_reservations()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE tables t
  SET status = 'libre'
  FROM reservations r
  WHERE r.table_id = t.id
    AND r.reserved_until < NOW()
    AND r.auto_released = false
    AND t.status = 'reserva';

  UPDATE reservations
  SET auto_released = true
  WHERE reserved_until < NOW()
    AND auto_released = false;
END;
$$;

-- Schedule auto-release every 5 minutes (if pg_cron is available)
-- SELECT cron.schedule('release-expired-reservations', '*/5 * * * *', 'SELECT auto_release_expired_reservations()');

-- ── RLS for new columns ───────────────────────────────────────────────────────
-- Inherit existing table/restaurant RLS policies (no new tables created)

COMMENT ON COLUMN menu_items.stock_status IS 'available=normal, low_stock=<5 remaining, out_of_stock=0, 86=kitchen marked as unavailable';
COMMENT ON COLUMN restaurants.chapi_waitlist_start_min IS 'Minutes before estimated turn to send Chapi engage message. 0 = immediately on joining.';
