-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 019: Demo week seed — 7 days of realistic data for demo-restaurante
-- Restaurant ID: d2babcfe-b51b-454e-8117-f8489a24dc33
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  r_id    UUID := 'd2babcfe-b51b-454e-8117-f8489a24dc33';

  -- Table IDs
  t1 UUID; t2 UUID; t3 UUID; t4 UUID; t5 UUID; t6 UUID;

  -- Menu item IDs
  m1 UUID; m2 UUID; m3 UUID; m4 UUID; m5 UUID;
  m6 UUID; m7 UUID; m8 UUID;

  -- Working vars
  order_id  UUID;
  day_offset INT;
  base_date TIMESTAMPTZ;
  order_ts  TIMESTAMPTZ;

BEGIN

-- ── 1. Ensure tables exist ────────────────────────────────────────────────────

INSERT INTO public.tables (id, restaurant_id, label, seats, status, zone, qr_token)
VALUES
  (gen_random_uuid(), r_id, 'Mesa 1', 2, 'libre', 'interior', 'qr-mesa-1-demo01'),
  (gen_random_uuid(), r_id, 'Mesa 2', 4, 'libre', 'interior', 'qr-mesa-2-demo02'),
  (gen_random_uuid(), r_id, 'Mesa 3', 4, 'libre', 'interior', 'qr-mesa-3-demo03'),
  (gen_random_uuid(), r_id, 'Mesa 4', 6, 'libre', 'terraza',  'qr-mesa-4-demo04'),
  (gen_random_uuid(), r_id, 'Mesa 5', 2, 'libre', 'barra',    'qr-mesa-5-demo05'),
  (gen_random_uuid(), r_id, 'Mesa 6', 4, 'libre', 'interior', 'qr-mesa-6-demo06')
ON CONFLICT (qr_token) DO NOTHING;

SELECT id INTO t1 FROM public.tables WHERE qr_token = 'qr-mesa-1-demo01';
SELECT id INTO t2 FROM public.tables WHERE qr_token = 'qr-mesa-2-demo02';
SELECT id INTO t3 FROM public.tables WHERE qr_token = 'qr-mesa-3-demo03';
SELECT id INTO t4 FROM public.tables WHERE qr_token = 'qr-mesa-4-demo04';
SELECT id INTO t5 FROM public.tables WHERE qr_token = 'qr-mesa-5-demo05';
SELECT id INTO t6 FROM public.tables WHERE qr_token = 'qr-mesa-6-demo06';

-- ── 2. Ensure menu items exist ────────────────────────────────────────────────

INSERT INTO public.menu_items (id, restaurant_id, name, description, price, category, available, tags)
VALUES
  (gen_random_uuid(), r_id, 'Empanada de pino',    'Horneada, rellena de carne y cebolla',   2800,  'entradas',  true, '{}'),
  (gen_random_uuid(), r_id, 'Humitas al vapor',    'Masa de choclo con albahaca',             3200,  'entradas',  true, '{}'),
  (gen_random_uuid(), r_id, 'Lomo saltado',        'Lomo de res salteado, papas y arroz',     9900,  'fondos',    true, ARRAY['promovido']),
  (gen_random_uuid(), r_id, 'Pastel de choclo',    'Gratinado con carne, aceitunas y huevo',  8500,  'fondos',    true, '{}'),
  (gen_random_uuid(), r_id, 'Cazuela de vacuno',   'Caldo con porotos y papas',               7900,  'fondos',    true, '{}'),
  (gen_random_uuid(), r_id, 'Leche asada',         'Postre cremoso con caramelo',             3200,  'postres',   true, '{}'),
  (gen_random_uuid(), r_id, 'Pisco sour',          'Clásico chileno',                         4500,  'bebidas',   true, '{}'),
  (gen_random_uuid(), r_id, 'Jugo natural',        'Naranja, mango o maracuyá',               2500,  'bebidas',   true, ARRAY['vegano'])
ON CONFLICT DO NOTHING;

SELECT id INTO m1 FROM public.menu_items WHERE restaurant_id = r_id AND name = 'Empanada de pino'  LIMIT 1;
SELECT id INTO m2 FROM public.menu_items WHERE restaurant_id = r_id AND name = 'Humitas al vapor'  LIMIT 1;
SELECT id INTO m3 FROM public.menu_items WHERE restaurant_id = r_id AND name = 'Lomo saltado'      LIMIT 1;
SELECT id INTO m4 FROM public.menu_items WHERE restaurant_id = r_id AND name = 'Pastel de choclo'  LIMIT 1;
SELECT id INTO m5 FROM public.menu_items WHERE restaurant_id = r_id AND name = 'Cazuela de vacuno' LIMIT 1;
SELECT id INTO m6 FROM public.menu_items WHERE restaurant_id = r_id AND name = 'Leche asada'       LIMIT 1;
SELECT id INTO m7 FROM public.menu_items WHERE restaurant_id = r_id AND name = 'Pisco sour'        LIMIT 1;
SELECT id INTO m8 FROM public.menu_items WHERE restaurant_id = r_id AND name = 'Jugo natural'      LIMIT 1;

-- ── 3. Generate 7 days of orders ─────────────────────────────────────────────
-- Pattern: 8-12 lunch orders (12:00-15:30) + 12-18 dinner orders (19:00-23:00)
-- All status = 'paid' (historical), except today has some active ones

FOR day_offset IN 6 .. 0 LOOP
  base_date := (CURRENT_DATE - day_offset)::TIMESTAMPTZ;

  -- ── LUNCH ORDERS ──────────────────────────────────────────────────────────

  -- Order 1 (lunch)
  order_id := gen_random_uuid();
  order_ts := base_date + INTERVAL '12 hours 10 minutes' + (random() * INTERVAL '20 minutes');
  INSERT INTO public.orders (id, restaurant_id, table_id, status, total, created_at, updated_at)
    VALUES (order_id, r_id, t1, CASE WHEN day_offset = 0 THEN 'paying' ELSE 'paid' END, 15600, order_ts, order_ts + INTERVAL '45 minutes');
  INSERT INTO public.order_items (order_id, menu_item_id, name, quantity, unit_price, status)
    VALUES (order_id, m1, 'Empanada de pino', 2, 2800, 'ready'),
           (order_id, m3, 'Lomo saltado',     1, 9900, 'ready'),
           (order_id, m8, 'Jugo natural',      1, 2500, 'ready');

  -- Order 2 (lunch)
  order_id := gen_random_uuid();
  order_ts := base_date + INTERVAL '12 hours 30 minutes' + (random() * INTERVAL '30 minutes');
  INSERT INTO public.orders (id, restaurant_id, table_id, status, total, created_at, updated_at)
    VALUES (order_id, r_id, t2, 'paid', 22300, order_ts, order_ts + INTERVAL '50 minutes');
  INSERT INTO public.order_items (order_id, menu_item_id, name, quantity, unit_price, status)
    VALUES (order_id, m2, 'Humitas al vapor',  2, 3200, 'ready'),
           (order_id, m4, 'Pastel de choclo',  2, 8500, 'ready'),
           (order_id, m7, 'Pisco sour',         1, 4500, 'ready');

  -- Order 3 (lunch)
  order_id := gen_random_uuid();
  order_ts := base_date + INTERVAL '13 hours 0 minutes' + (random() * INTERVAL '20 minutes');
  INSERT INTO public.orders (id, restaurant_id, table_id, status, total, created_at, updated_at)
    VALUES (order_id, r_id, t3, 'paid', 17800, order_ts, order_ts + INTERVAL '40 minutes');
  INSERT INTO public.order_items (order_id, menu_item_id, name, quantity, unit_price, status)
    VALUES (order_id, m5, 'Cazuela de vacuno', 2, 7900, 'ready'),
           (order_id, m6, 'Leche asada',       2, 3200, 'ready');

  -- Order 4 (lunch)
  order_id := gen_random_uuid();
  order_ts := base_date + INTERVAL '13 hours 20 minutes' + (random() * INTERVAL '30 minutes');
  INSERT INTO public.orders (id, restaurant_id, table_id, status, total, created_at, updated_at)
    VALUES (order_id, r_id, t4, 'paid', 31200, order_ts, order_ts + INTERVAL '55 minutes');
  INSERT INTO public.order_items (order_id, menu_item_id, name, quantity, unit_price, status)
    VALUES (order_id, m1, 'Empanada de pino',  4, 2800, 'ready'),
           (order_id, m3, 'Lomo saltado',      2, 9900, 'ready'),
           (order_id, m7, 'Pisco sour',         2, 4500, 'ready');

  -- Order 5 (lunch)
  order_id := gen_random_uuid();
  order_ts := base_date + INTERVAL '14 hours 0 minutes' + (random() * INTERVAL '25 minutes');
  INSERT INTO public.orders (id, restaurant_id, table_id, status, total, created_at, updated_at)
    VALUES (order_id, r_id, t5, 'paid', 12400, order_ts, order_ts + INTERVAL '35 minutes');
  INSERT INTO public.order_items (order_id, menu_item_id, name, quantity, unit_price, status)
    VALUES (order_id, m4, 'Pastel de choclo', 1, 8500, 'ready'),
           (order_id, m8, 'Jugo natural',      1, 2500, 'ready'),
           (order_id, m6, 'Leche asada',       1, 3200, 'ready');

  -- Order 6 (lunch) - weekend bonus orders for Fri/Sat
  IF EXTRACT(DOW FROM base_date) IN (5, 6) THEN
    order_id := gen_random_uuid();
    order_ts := base_date + INTERVAL '14 hours 30 minutes' + (random() * INTERVAL '30 minutes');
    INSERT INTO public.orders (id, restaurant_id, table_id, status, total, created_at, updated_at)
      VALUES (order_id, r_id, t6, 'paid', 28900, order_ts, order_ts + INTERVAL '50 minutes');
    INSERT INTO public.order_items (order_id, menu_item_id, name, quantity, unit_price, status)
      VALUES (order_id, m2, 'Humitas al vapor',  3, 3200, 'ready'),
             (order_id, m3, 'Lomo saltado',      2, 9900, 'ready'),
             (order_id, m7, 'Pisco sour',         2, 4500, 'ready');
  END IF;

  -- ── DINNER ORDERS ─────────────────────────────────────────────────────────

  -- Dinner 1
  order_id := gen_random_uuid();
  order_ts := base_date + INTERVAL '19 hours 15 minutes' + (random() * INTERVAL '20 minutes');
  INSERT INTO public.orders (id, restaurant_id, table_id, status, total, created_at, updated_at)
    VALUES (order_id, r_id, t1, 'paid', 24900, order_ts, order_ts + INTERVAL '60 minutes');
  INSERT INTO public.order_items (order_id, menu_item_id, name, quantity, unit_price, status)
    VALUES (order_id, m1, 'Empanada de pino', 2, 2800, 'ready'),
           (order_id, m3, 'Lomo saltado',     2, 9900, 'ready'),
           (order_id, m7, 'Pisco sour',        2, 4500, 'ready');

  -- Dinner 2
  order_id := gen_random_uuid();
  order_ts := base_date + INTERVAL '19 hours 45 minutes' + (random() * INTERVAL '20 minutes');
  INSERT INTO public.orders (id, restaurant_id, table_id, status, total, created_at, updated_at)
    VALUES (order_id, r_id, t2, 'paid', 34100, order_ts, order_ts + INTERVAL '70 minutes');
  INSERT INTO public.order_items (order_id, menu_item_id, name, quantity, unit_price, status)
    VALUES (order_id, m2, 'Humitas al vapor',  2, 3200, 'ready'),
           (order_id, m4, 'Pastel de choclo',  2, 8500, 'ready'),
           (order_id, m6, 'Leche asada',        2, 3200, 'ready'),
           (order_id, m7, 'Pisco sour',          2, 4500, 'ready');

  -- Dinner 3
  order_id := gen_random_uuid();
  order_ts := base_date + INTERVAL '20 hours 0 minutes' + (random() * INTERVAL '30 minutes');
  INSERT INTO public.orders (id, restaurant_id, table_id, status, total, created_at, updated_at)
    VALUES (order_id, r_id, t3, 'paid', 19700, order_ts, order_ts + INTERVAL '55 minutes');
  INSERT INTO public.order_items (order_id, menu_item_id, name, quantity, unit_price, status)
    VALUES (order_id, m5, 'Cazuela de vacuno', 2, 7900, 'ready'),
           (order_id, m6, 'Leche asada',        1, 3200, 'ready'),
           (order_id, m8, 'Jugo natural',        1, 2500, 'ready');

  -- Dinner 4
  order_id := gen_random_uuid();
  order_ts := base_date + INTERVAL '20 hours 30 minutes' + (random() * INTERVAL '20 minutes');
  INSERT INTO public.orders (id, restaurant_id, table_id, status, total, created_at, updated_at)
    VALUES (order_id, r_id, t4, 'paid', 42600, order_ts, order_ts + INTERVAL '75 minutes');
  INSERT INTO public.order_items (order_id, menu_item_id, name, quantity, unit_price, status)
    VALUES (order_id, m1, 'Empanada de pino',  4, 2800, 'ready'),
           (order_id, m3, 'Lomo saltado',      2, 9900, 'ready'),
           (order_id, m4, 'Pastel de choclo',  1, 8500, 'ready'),
           (order_id, m7, 'Pisco sour',         3, 4500, 'ready');

  -- Dinner 5
  order_id := gen_random_uuid();
  order_ts := base_date + INTERVAL '21 hours 0 minutes' + (random() * INTERVAL '30 minutes');
  INSERT INTO public.orders (id, restaurant_id, table_id, status, total, created_at, updated_at)
    VALUES (order_id, r_id, t5, 'paid', 16400, order_ts, order_ts + INTERVAL '45 minutes');
  INSERT INTO public.order_items (order_id, menu_item_id, name, quantity, unit_price, status)
    VALUES (order_id, m3, 'Lomo saltado',  1, 9900, 'ready'),
           (order_id, m6, 'Leche asada',   2, 3200, 'ready');

  -- Dinner 6
  order_id := gen_random_uuid();
  order_ts := base_date + INTERVAL '21 hours 30 minutes' + (random() * INTERVAL '20 minutes');
  INSERT INTO public.orders (id, restaurant_id, table_id, status, total, created_at, updated_at)
    VALUES (order_id, r_id, t6, 'paid', 29300, order_ts, order_ts + INTERVAL '65 minutes');
  INSERT INTO public.order_items (order_id, menu_item_id, name, quantity, unit_price, status)
    VALUES (order_id, m2, 'Humitas al vapor',  2, 3200, 'ready'),
           (order_id, m5, 'Cazuela de vacuno', 2, 7900, 'ready'),
           (order_id, m7, 'Pisco sour',         2, 4500, 'ready');

  -- Dinner 7 (late)
  order_id := gen_random_uuid();
  order_ts := base_date + INTERVAL '22 hours 15 minutes' + (random() * INTERVAL '20 minutes');
  INSERT INTO public.orders (id, restaurant_id, table_id, status, total, created_at, updated_at)
    VALUES (order_id, r_id, t1, 'paid', 18700, order_ts, order_ts + INTERVAL '50 minutes');
  INSERT INTO public.order_items (order_id, menu_item_id, name, quantity, unit_price, status)
    VALUES (order_id, m4, 'Pastel de choclo',  1, 8500, 'ready'),
           (order_id, m6, 'Leche asada',        1, 3200, 'ready'),
           (order_id, m7, 'Pisco sour',          2, 4500, 'ready');

  -- Weekend extra orders
  IF EXTRACT(DOW FROM base_date) IN (5, 6) THEN
    order_id := gen_random_uuid();
    order_ts := base_date + INTERVAL '22 hours 45 minutes' + (random() * INTERVAL '15 minutes');
    INSERT INTO public.orders (id, restaurant_id, table_id, status, total, created_at, updated_at)
      VALUES (order_id, r_id, t2, 'paid', 36000, order_ts, order_ts + INTERVAL '60 minutes');
    INSERT INTO public.order_items (order_id, menu_item_id, name, quantity, unit_price, status)
      VALUES (order_id, m1, 'Empanada de pino',  4, 2800, 'ready'),
             (order_id, m3, 'Lomo saltado',      2, 9900, 'ready'),
             (order_id, m7, 'Pisco sour',         4, 4500, 'ready');
  END IF;

END LOOP;

-- ── 4. Today: add 2 active orders (pending/preparing) for live feel ───────────
order_id := gen_random_uuid();
order_ts := now() - INTERVAL '15 minutes';
INSERT INTO public.orders (id, restaurant_id, table_id, status, total, created_at, updated_at)
  VALUES (order_id, r_id, t2, 'preparing', 22300, order_ts, order_ts);
INSERT INTO public.order_items (order_id, menu_item_id, name, quantity, unit_price, status)
  VALUES (order_id, m3, 'Lomo saltado',     2, 9900, 'preparing'),
         (order_id, m8, 'Jugo natural',      2, 2500, 'preparing');

order_id := gen_random_uuid();
order_ts := now() - INTERVAL '5 minutes';
INSERT INTO public.orders (id, restaurant_id, table_id, status, total, created_at, updated_at)
  VALUES (order_id, r_id, t4, 'pending', 15600, order_ts, order_ts);
INSERT INTO public.order_items (order_id, menu_item_id, name, quantity, unit_price, status)
  VALUES (order_id, m1, 'Empanada de pino', 2, 2800, 'pending'),
         (order_id, m5, 'Cazuela de vacuno', 1, 7900, 'pending');

-- Update tables to ocupada for active orders
UPDATE public.tables SET status = 'ocupada' WHERE id IN (t2, t4) AND restaurant_id = r_id;

END $$;
