-- Sprint: dynamic table splitting + team multi-role support
--
-- 1. tables.split_into_ids:
--    cuando una mesa grande se divide en N mesas chicas, guardamos los ids
--    de las mesas hijas acá, para poder hacer "merge" después.
--    La mesa madre queda en status = 'bloqueada' mientras esté dividida.
--
-- 2. team_members.roles:
--    originalmente un miembro tenía un único `role`. Ahora permitimos que
--    una persona tenga varios roles (ej: garzón + cocinero). Mantenemos
--    `role` como "primary role" por compatibilidad.

-- ── tables.split_into_ids ───────────────────────────────────────────────────
alter table tables
  add column if not exists split_into_ids uuid[] null;

comment on column tables.split_into_ids is
  'Ids de las mesas hijas cuando esta mesa está dividida. NULL = no dividida.';

-- ── team_members.roles (multi-rol) ──────────────────────────────────────────
alter table team_members
  add column if not exists roles text[] null;

comment on column team_members.roles is
  'Lista de roles del miembro. Permite multi-rol (ej: garzón + cocina). El campo role sigue siendo el rol primario.';

-- Backfill: si roles es null, copiamos el valor existente de role en un array
update team_members
set    roles = array[role]
where  roles is null
  and  role is not null;
