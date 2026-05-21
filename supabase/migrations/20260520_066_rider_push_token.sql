-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 066: Rider Push Token
-- Agrega columna expo_push_token a rider_profiles para enviar push notifications
-- desde el backend a la app móvil del rider usando Expo Push API.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.rider_profiles
  ADD COLUMN IF NOT EXISTS expo_push_token text;

-- Un token puede pertenecer solo a un rider (cuando cambia de dispositivo,
-- el token anterior se sobreescribe).
CREATE UNIQUE INDEX IF NOT EXISTS idx_rider_profiles_expo_push_token
  ON public.rider_profiles (expo_push_token)
  WHERE expo_push_token IS NOT NULL;

-- Comentario de documentación
COMMENT ON COLUMN public.rider_profiles.expo_push_token IS
  'Expo push notification token del dispositivo del rider. Se sincroniza al iniciar sesión en la app. NULL = rider sin push registrado.';
