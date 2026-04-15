-- ════════════════════════════════════════════════════════════════════════════
-- 046 — team_members.full_name + phone
-- ════════════════════════════════════════════════════════════════════════════
-- Permite registrar el nombre completo (y tel) del miembro al invitarlo,
-- para mostrarlo en turnos, equipo y resto de UI en vez del email.
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.team_members
  ADD COLUMN IF NOT EXISTS full_name TEXT,
  ADD COLUMN IF NOT EXISTS phone     TEXT;

COMMENT ON COLUMN public.team_members.full_name IS 'Nombre y apellido del miembro (capturado al invitar).';
COMMENT ON COLUMN public.team_members.phone     IS 'Teléfono de contacto opcional del miembro.';
