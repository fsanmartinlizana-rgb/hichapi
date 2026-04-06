-- ─── 004_restaurant_submissions.sql ─────────────────────────────────────────
-- Tabla para solicitudes de restaurantes que quieren unirse a HiChapi.
-- Ejecutar en: Supabase Dashboard → SQL Editor → New Query → Run
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS restaurant_submissions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Datos del restaurante
  name            TEXT NOT NULL,
  slug_proposed   TEXT,
  address         TEXT NOT NULL,
  neighborhood    TEXT NOT NULL,
  cuisine_type    TEXT NOT NULL,
  price_range     TEXT NOT NULL
                    CHECK (price_range IN ('economico', 'medio', 'premium')),
  description     TEXT,
  instagram_url   TEXT,

  -- Datos del dueño / contacto
  owner_name      TEXT NOT NULL,
  owner_email     TEXT NOT NULL,
  owner_phone     TEXT,

  -- Estado interno (solo el equipo HiChapi lo gestiona)
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'approved', 'rejected')),
  notes           TEXT,             -- notas internas del equipo

  created_at      TIMESTAMPTZ DEFAULT now()
);

-- RLS: cualquiera puede insertar (formulario público), nadie puede leer/editar desde el cliente
ALTER TABLE restaurant_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_insert_submissions"
  ON restaurant_submissions
  FOR INSERT
  WITH CHECK (true);

-- SELECT/UPDATE solo via service_role key (desde el servidor), no desde el navegador.
-- Cuando se implemente un panel admin con auth, agregar políticas SELECT/UPDATE acá.

-- Índice para consultas frecuentes del equipo
CREATE INDEX IF NOT EXISTS submissions_status_idx
  ON restaurant_submissions (status, created_at DESC);
