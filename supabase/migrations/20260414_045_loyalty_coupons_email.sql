-- ════════════════════════════════════════════════════════════════════════════
-- 045 — Loyalty: cupones emitidos por email (pre-registro)
-- ════════════════════════════════════════════════════════════════════════════
-- Permite emitir un cupón a un correo que todavía no tiene cuenta en HiChapi.
-- Cuando el destinatario se registre con ese correo, los cupones pendientes se
-- asocian a su user_id (virtual wallet).
-- ════════════════════════════════════════════════════════════════════════════

-- 1. user_id ahora es nullable (antes NOT NULL)
ALTER TABLE customer_coupons
  ALTER COLUMN user_id DROP NOT NULL;

-- 2. Campos para cupón por email
ALTER TABLE customer_coupons
  ADD COLUMN IF NOT EXISTS customer_email TEXT,
  ADD COLUMN IF NOT EXISTS customer_name  TEXT,
  ADD COLUMN IF NOT EXISTS claimed_at     TIMESTAMPTZ;

-- 3. Guard: debe existir user_id O customer_email
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

-- 4. Índice parcial por email (rápido lookup de cupones pendientes al registrarse)
CREATE INDEX IF NOT EXISTS customer_coupons_email_idx
  ON customer_coupons (restaurant_id, lower(customer_email), status)
  WHERE customer_email IS NOT NULL AND status = 'active';

-- 5. RLS: ampliar política de SELECT para que un usuario pueda ver los cupones
--    de su email incluso si aún no están asociados a su user_id
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

-- 6. Helper: lookup de user_id por email (service role)
CREATE OR REPLACE FUNCTION public.get_user_id_by_email(p_email TEXT)
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT id FROM auth.users WHERE lower(email) = lower(p_email) LIMIT 1;
$$;

-- 7. Función para reclamar cupones pendientes post-registro (llamada por API)
CREATE OR REPLACE FUNCTION public.claim_email_coupons(p_user_id UUID)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_email  TEXT;
  v_count  INTEGER;
BEGIN
  SELECT email INTO v_email FROM auth.users WHERE id = p_user_id;
  IF v_email IS NULL THEN
    RETURN 0;
  END IF;

  UPDATE customer_coupons
     SET user_id    = p_user_id,
         claimed_at = now()
   WHERE user_id IS NULL
     AND status = 'active'
     AND lower(customer_email) = lower(v_email);

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END $$;

COMMENT ON COLUMN customer_coupons.customer_email IS 'Correo del destinatario cuando el cupón se emite antes del registro.';
COMMENT ON COLUMN customer_coupons.claimed_at    IS 'Timestamp en que un usuario registrado reclamó el cupón pendiente.';
COMMENT ON FUNCTION public.claim_email_coupons(UUID) IS 'Asocia cupones pendientes (email) al user_id que acaba de registrarse con ese correo. Retorna cantidad asociada.';
