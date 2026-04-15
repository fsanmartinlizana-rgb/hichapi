-- ════════════════════════════════════════════════════════════════════════════
-- 🚀 HICHAPI — MIGRATIONS PENDIENTES (045, 046, 047)
-- ════════════════════════════════════════════════════════════════════════════
-- Copia y pega este bloque COMPLETO en Supabase Studio → SQL Editor → Run.
-- Es idempotente: podés correrlo múltiples veces sin romper nada.
-- Tiempo estimado: 2 segundos.
-- ════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- 045 — Cupones emitidos por email (wallet virtual pre-registro)
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE customer_coupons
  ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE customer_coupons
  ADD COLUMN IF NOT EXISTS customer_email TEXT,
  ADD COLUMN IF NOT EXISTS customer_name  TEXT,
  ADD COLUMN IF NOT EXISTS claimed_at     TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'customer_coupons_user_or_email_chk'
  ) THEN
    ALTER TABLE customer_coupons
      ADD CONSTRAINT customer_coupons_user_or_email_chk
      CHECK (user_id IS NOT NULL OR customer_email IS NOT NULL);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS customer_coupons_email_idx
  ON customer_coupons (restaurant_id, lower(customer_email), status)
  WHERE customer_email IS NOT NULL AND status = 'active';

DROP POLICY IF EXISTS customer_coupons_select_self ON customer_coupons;
CREATE POLICY customer_coupons_select_self ON customer_coupons FOR SELECT
  USING (
    user_id = auth.uid()
    OR (
      customer_email IS NOT NULL
      AND lower(customer_email) = lower((SELECT email FROM auth.users WHERE id = auth.uid()))
    )
    OR public.is_team_member(restaurant_id)
  );

CREATE OR REPLACE FUNCTION public.get_user_id_by_email(p_email TEXT)
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT id FROM auth.users WHERE lower(email) = lower(p_email) LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.claim_email_coupons(p_user_id UUID)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_email  TEXT;
  v_count  INTEGER;
BEGIN
  SELECT email INTO v_email FROM auth.users WHERE id = p_user_id;
  IF v_email IS NULL THEN RETURN 0; END IF;

  UPDATE customer_coupons
     SET user_id    = p_user_id,
         claimed_at = now()
   WHERE user_id IS NULL
     AND status = 'active'
     AND lower(customer_email) = lower(v_email);

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 046 — team_members.full_name + phone (nombre visible en turnos/equipo)
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.team_members
  ADD COLUMN IF NOT EXISTS full_name TEXT,
  ADD COLUMN IF NOT EXISTS phone     TEXT;

-- ─────────────────────────────────────────────────────────────────────────────
-- 047 — FK orders.table_id → ON DELETE SET NULL (permitir borrar mesas)
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  fk_name TEXT;
BEGIN
  SELECT conname INTO fk_name
  FROM pg_constraint
  WHERE conrelid = 'public.orders'::regclass
    AND contype  = 'f'
    AND conkey   = (SELECT ARRAY[attnum]
                    FROM pg_attribute
                    WHERE attrelid = 'public.orders'::regclass
                      AND attname  = 'table_id')
  LIMIT 1;

  IF fk_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.orders DROP CONSTRAINT %I', fk_name);
  END IF;
END $$;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_table_id_fkey
  FOREIGN KEY (table_id)
  REFERENCES public.tables(id)
  ON DELETE SET NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- ✅ DONE. Para verificar, corré:
-- ─────────────────────────────────────────────────────────────────────────────
-- SELECT column_name FROM information_schema.columns
-- WHERE table_name='customer_coupons' AND column_name IN ('customer_email','customer_name','claimed_at');
-- SELECT column_name FROM information_schema.columns
-- WHERE table_name='team_members' AND column_name IN ('full_name','phone');
-- ═════════════════════════════════════════════════════════════════════════════
