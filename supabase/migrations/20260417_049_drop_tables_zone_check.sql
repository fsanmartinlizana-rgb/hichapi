-- ── Drop obsolete CHECK on tables.zone ─────────────────────────────────────
-- Contexto: la migration 042 (restaurant_zones) introdujo zonas custom
-- configurables por restaurant (ej: "fumador", "salón VIP", "terraza norte").
-- Pero el CHECK original de migrations 010/012 sobre tables.zone aún restringe
-- a valores hardcoded: 'interior','terraza','barra','privado'.
--
-- Al crear una mesa con una zona custom (como "fumador") la inserción falla con:
--   new row for relation "tables" violates check constraint "tables_zone_check"
--
-- Solución: soltar el CHECK. La fuente de verdad ahora es restaurant_zones.

ALTER TABLE tables DROP CONSTRAINT IF EXISTS tables_zone_check;

-- Nota: no se reemplaza por un FK contra restaurant_zones(name) porque los
-- nombres de zonas son editables y no existe UNIQUE(name) global. El enforcement
-- queda en la app (UI solo ofrece zonas existentes del restaurant actual).
