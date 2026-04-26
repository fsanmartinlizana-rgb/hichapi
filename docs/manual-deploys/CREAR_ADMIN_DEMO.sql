-- ─────────────────────────────────────────────────────────────────────────────
-- Crear usuario admin para el restaurant Demo (d2babcfe-...)
-- Para uso interno: sacar screenshots para landing page.
-- ─────────────────────────────────────────────────────────────────────────────
--
-- INSTRUCCIONES:
--
-- 1. Crear el usuario en Supabase Auth (NO se puede hacer desde SQL puro).
--    a) Ve a Supabase Dashboard → Authentication → Users → Add user
--    b) Email:    demo-admin@hichapi.cl
--    c) Password: HiChapi-Demo-2026!  (cámbialo después)
--    d) Auto-confirm user: ✅ ON
--    e) Click "Create user"
--    f) Copia el UUID del nuevo usuario.
--
-- 2. Pegá este SQL en el SQL Editor de Supabase, REEMPLAZA el UUID en la
--    línea v_user_id := '...'  por el UUID del paso 1, y ejecutá.
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  -- ⚠️ REEMPLAZAR por el UUID del usuario creado en el paso 1 ⚠️
  -- (último usado en prod: e4602097-adb2-4808-809e-017e33b00dde)
  v_user_id uuid := 'e4602097-adb2-4808-809e-017e33b00dde';
  v_restaurant_id uuid := 'd2babcfe-b51b-454e-8117-f8489a24dc33';
BEGIN
  -- Verificación: que el usuario existe en auth.users
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = v_user_id) THEN
    RAISE EXCEPTION 'El usuario % no existe en auth.users. Crealo primero en Authentication → Users.', v_user_id;
  END IF;

  -- Verificación: que el restaurant existe
  IF NOT EXISTS (SELECT 1 FROM restaurants WHERE id = v_restaurant_id) THEN
    RAISE EXCEPTION 'El restaurant % no existe. ¿Aplicaste la migration 20260408_019_demo_week_seed.sql?', v_restaurant_id;
  END IF;

  -- Linkear como propietario (idempotente)
  -- Notas sobre el schema de team_members en prod:
  --   • NO tiene columna created_at
  --   • NO tiene unique constraint en (restaurant_id, user_id)
  -- Por eso usamos chequeo manual en lugar de ON CONFLICT.
  IF EXISTS (
    SELECT 1 FROM team_members
    WHERE restaurant_id = v_restaurant_id AND user_id = v_user_id
  ) THEN
    UPDATE team_members
       SET role   = 'owner',
           status = 'active'
     WHERE restaurant_id = v_restaurant_id
       AND user_id       = v_user_id;
  ELSE
    INSERT INTO team_members (
      id, restaurant_id, user_id, role, status, invited_email
    ) VALUES (
      gen_random_uuid(), v_restaurant_id, v_user_id,
      'owner', 'active', 'demo-admin@hichapi.cl'
    );
  END IF;

  RAISE NOTICE 'OK — usuario % linkeado como owner del restaurant %', v_user_id, v_restaurant_id;
END $$;

-- ── Verificar ────────────────────────────────────────────────────────────────
SELECT
  tm.role,
  tm.status,
  r.name AS restaurant_name,
  r.slug,
  u.email AS user_email
FROM team_members tm
JOIN restaurants r ON r.id = tm.restaurant_id
JOIN auth.users  u ON u.id = tm.user_id
WHERE r.id = 'd2babcfe-b51b-454e-8117-f8489a24dc33';

-- ── Login ────────────────────────────────────────────────────────────────────
-- Ahora podés ir a hichapi.cl/login con:
--   email:    demo-admin@hichapi.cl
--   password: HiChapi-Demo-2026!
-- y verás el panel del Restaurante Demo con 7 días de data realista.
