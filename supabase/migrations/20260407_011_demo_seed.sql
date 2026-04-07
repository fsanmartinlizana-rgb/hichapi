-- ─────────────────────────────────────────────────────────────────────────────
-- Demo seed: El Rincón de Don José — restaurante de demostración HiChapi
-- Run this in Supabase SQL editor to set up the demo restaurant
-- Safe to re-run (ON CONFLICT DO NOTHING)
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Restaurant
INSERT INTO restaurants (
  id, name, slug, address, neighborhood,
  lat, lng,
  location,
  cuisine_type, price_range, rating, review_count,
  active, plan,
  photo_url
) VALUES (
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'El Rincón de Don José',
  'el-rincon-de-don-jose',
  'Av. Providencia 2124, Providencia',
  'Providencia',
  -33.4308, -70.6108,
  ST_MakePoint(-70.6108, -33.4308)::GEOGRAPHY,
  'Chilena / Italiana', '$$', 4.7, 142,
  true, 'at_table',
  null
) ON CONFLICT (slug) DO UPDATE SET
  active = true,
  plan = 'at_table';

-- 2. Tables (mesas)
INSERT INTO tables (id, restaurant_id, label, seats, status) VALUES
  ('t1000001-0000-0000-0000-000000000001', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', '01', 4, 'libre'),
  ('t1000001-0000-0000-0000-000000000002', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', '02', 2, 'libre'),
  ('t1000001-0000-0000-0000-000000000003', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', '03', 4, 'libre'),
  ('t1000001-0000-0000-0000-000000000004', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', '04', 6, 'libre'),
  ('t1000001-0000-0000-0000-000000000005', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', '05', 2, 'libre'),
  ('t1000001-0000-0000-0000-000000000006', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', '06', 4, 'libre'),
  ('t1000001-0000-0000-0000-000000000007', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', '07', 4, 'libre'),
  ('t1000001-0000-0000-0000-000000000008', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', '08', 6, 'libre'),
  ('t1000001-0000-0000-0000-000000000009', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', '09', 4, 'libre'),
  ('t1000001-0000-0000-0000-000000000010', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', '10', 2, 'libre'),
  ('t1000001-0000-0000-0000-000000000011', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', '11', 4, 'libre'),
  ('t1000001-0000-0000-0000-000000000012', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', '12', 4, 'libre')
ON CONFLICT (id) DO NOTHING;

-- 3. Menu items
INSERT INTO menu_items (id, restaurant_id, name, description, price, category, tags, available) VALUES
  -- Entradas
  ('m1000001-0000-0000-0000-000000000001', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
   'Ensalada César', 'Lechuga romana, crutones artesanales, parmesano y aderezo César', 8900, 'entrada', '{}', true),
  ('m1000001-0000-0000-0000-000000000002', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
   'Gazpacho', 'Sopa fría de tomate andaluza con pepino y pimiento', 7500, 'entrada', '{vegano,sin gluten}', true),
  ('m1000001-0000-0000-0000-000000000003', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
   'Tabla de quesos', 'Selección de quesos con frutos secos, mermelada y crostinis', 13900, 'para compartir', '{vegetariano}', true),
  -- Principales
  ('m1000001-0000-0000-0000-000000000004', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
   'Lomo vetado', 'Corte premium a la parrilla con papas fritas y ensalada de temporada', 15900, 'principal', '{}', true),
  ('m1000001-0000-0000-0000-000000000005', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
   'Pasta arrabiata', 'Pasta con salsa de tomate picante, albahaca fresca y aceitunas', 12900, 'principal', '{vegano}', true),
  ('m1000001-0000-0000-0000-000000000006', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
   'Salmón grillado', 'Salmón fresco con puré de papas y salsa de limón y alcaparras', 16900, 'principal', '{sin gluten}', true),
  ('m1000001-0000-0000-0000-000000000007', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
   'Risotto de champiñones', 'Risotto cremoso con mezcla de champiñones y parmesano', 13900, 'principal', '{vegetariano}', true),
  ('m1000001-0000-0000-0000-000000000008', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
   'Pizza napolitana', 'Masa delgada con tomate san marzano, mozzarella fresca y albahaca', 12900, 'principal', '{vegetariano}', true),
  -- Postres
  ('m1000001-0000-0000-0000-000000000009', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
   'Tiramisú', 'Receta italiana tradicional con mascarpone y café espresso', 6900, 'postre', '{vegetariano}', true),
  ('m1000001-0000-0000-0000-000000000010', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
   'Panna cotta', 'Con coulis de frutos rojos y menta fresca', 5900, 'postre', '{vegetariano,sin gluten}', true),
  -- Bebidas
  ('m1000001-0000-0000-0000-000000000011', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
   'Pisco sour', 'Clásico chileno con pisco 35°, limón de pica y clara de huevo', 5900, 'bebida', '{}', true),
  ('m1000001-0000-0000-0000-000000000012', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
   'Copa de vino tinto', 'Selección del sommelier — carmenère o cabernet sauvignon', 5500, 'bebida', '{}', true),
  ('m1000001-0000-0000-0000-000000000013', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
   'Agua con gas', 'Agua mineral con gas 500ml', 2900, 'bebida', '{vegano,sin gluten}', true)
ON CONFLICT (id) DO NOTHING;

-- 4. owner_id column — add if missing (from migration 009 may not have it)
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id);

-- NOTE: After running this seed, go to /api/admin/demo-setup to link your
-- user account as owner of this restaurant.
