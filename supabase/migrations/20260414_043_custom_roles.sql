-- ── S30.9: Roles personalizados con permisos granulares ────────────────
-- Antes: los roles estaban hardcodeados (owner/admin/supervisor/garzon/…).
-- Ahora: cada restaurante puede crear roles custom con un set de permisos.
-- team_members.custom_role_id apunta al rol custom (opcional, coexiste con role).

CREATE TABLE IF NOT EXISTS custom_roles (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name          TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 40),
  description   TEXT,
  -- Permisos granulares: array de strings. Ej:
  --   'dashboard.view','comandas.view','comandas.edit','mesas.manage',
  --   'stock.view','stock.edit','caja.open','caja.close','turnos.manage',
  --   'equipo.manage','reportes.view','insights.view','config.edit'
  permissions   TEXT[] NOT NULL DEFAULT '{}',
  -- Opcional: rol base (para heredar accesos legacy si queda vacío en permissions)
  base_role     TEXT CHECK (base_role IN ('owner','admin','supervisor','garzon','cocina','anfitrion')),
  color         TEXT NOT NULL DEFAULT '#6B7280' CHECK (color ~ '^#[0-9A-Fa-f]{6}$'),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (restaurant_id, name)
);

CREATE INDEX IF NOT EXISTS custom_roles_rest_idx ON custom_roles (restaurant_id);

ALTER TABLE custom_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS custom_roles_select ON custom_roles;
CREATE POLICY custom_roles_select
  ON custom_roles FOR SELECT
  USING (public.is_team_member(restaurant_id));

DROP POLICY IF EXISTS custom_roles_all ON custom_roles;
CREATE POLICY custom_roles_all
  ON custom_roles FOR ALL
  USING (public.is_admin_for(restaurant_id))
  WITH CHECK (public.is_admin_for(restaurant_id));

-- Extender team_members con pointer al rol custom
ALTER TABLE team_members
  ADD COLUMN IF NOT EXISTS custom_role_id UUID REFERENCES custom_roles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS team_members_custom_role_idx
  ON team_members (custom_role_id) WHERE custom_role_id IS NOT NULL;

COMMENT ON TABLE custom_roles IS
  'Roles custom por restaurante con permisos granulares. Coexiste con role hardcoded en team_members.';
COMMENT ON COLUMN custom_roles.permissions IS
  'Array de permisos granulares. Formato: modulo.accion (dashboard.view, stock.edit, …).';
