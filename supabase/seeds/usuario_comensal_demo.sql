-- ─────────────────────────────────────────────────────────────────────────────
-- Seed: Usuario Comensal — datos demo para desarrollo
-- Requiere: migración 20260410_020_usuario_comensal.sql aplicada
-- Restaurante: el-rincon-de-don-jose (o demo-restaurante como fallback)
-- Safe to re-run (ON CONFLICT / IDs fijos)
--
-- Credenciales demo:
--   comensal1@demo.hichapi.cl / demo1234
--   comensal2@demo.hichapi.cl / demo1234
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  v_restaurant_id   uuid;
  v_table_id        uuid;
  v_rider_id        uuid;
  v_user1           uuid := 'c1000001-0000-4000-8000-000000000001';
  v_user2           uuid := 'c1000002-0000-4000-8000-000000000002';
  v_customer1_id    uuid := 'c2000001-0000-4000-8000-000000000001';
  v_customer2_id    uuid := 'c2000002-0000-4000-8000-000000000002';
  v_order_pres_id   uuid := 'c3000001-0000-4000-8000-000000000001';
  v_order_deliv1_id uuid := 'c3000002-0000-4000-8000-000000000002';
  v_order_deliv2_id uuid := 'c3000003-0000-4000-8000-000000000003';
BEGIN
  -- Restaurante demo (preferir El Rincón)
  SELECT id INTO v_restaurant_id
  FROM public.restaurants
  WHERE slug IN ('el-rincon-de-don-jose', 'demo-restaurante')
  ORDER BY CASE slug WHEN 'el-rincon-de-don-jose' THEN 0 ELSE 1 END
  LIMIT 1;

  IF v_restaurant_id IS NULL THEN
    RAISE NOTICE 'usuario_comensal_demo: restaurante demo no encontrado — omitiendo seed.';
    RETURN;
  END IF;

  SELECT id INTO v_table_id
  FROM public.tables
  WHERE restaurant_id = v_restaurant_id
  ORDER BY label
  LIMIT 1;

  IF v_table_id IS NULL THEN
    RAISE NOTICE 'usuario_comensal_demo: sin mesas en el restaurante — omitiendo seed.';
    RETURN;
  END IF;

  SELECT id INTO v_rider_id
  FROM public.rider_profiles
  WHERE status IN ('available', 'busy')
  ORDER BY created_at
  LIMIT 1;

  -- Geofence habilitado en demo (opcional, útil para probar móvil)
  UPDATE public.restaurants
  SET
    geofence_enabled  = true,
    geofence_lat      = COALESCE(geofence_lat, lat),
    geofence_lng      = COALESCE(geofence_lng, lng),
    geofence_radius_m = COALESCE(geofence_radius_m, 200),
    geofence_message  = COALESCE(geofence_message, '¡Pasa por El Rincón! 10% off con tu app HiChapi'),
    points_multiplier = 1.5
  WHERE id = v_restaurant_id;

  -- ── Auth users (comensales) ───────────────────────────────────────────────
  INSERT INTO auth.users (
    id, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  ) VALUES
  (
    v_user1,
    'comensal1@demo.hichapi.cl',
    crypt('demo1234', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Valentina Morales"}',
    now(), now()
  ),
  (
    v_user2,
    'comensal2@demo.hichapi.cl',
    crypt('demo1234', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Diego Fuentes"}',
    now(), now()
  )
  ON CONFLICT (id) DO NOTHING;

  -- ── customer_profiles ─────────────────────────────────────────────────────
  INSERT INTO public.customer_profiles (
    id, user_id, display_name, phone, loyalty_points
  ) VALUES
  (v_customer1_id, v_user1, 'Valentina Morales', '+56911110001', 1250),
  (v_customer2_id, v_user2, 'Diego Fuentes', '+56911110002', 480)
  ON CONFLICT (user_id) DO UPDATE SET
    display_name   = EXCLUDED.display_name,
    phone          = EXCLUDED.phone,
    loyalty_points = EXCLUDED.loyalty_points,
    updated_at     = now();

  -- Resolver IDs si ya existían por user_id
  SELECT id INTO v_customer1_id FROM public.customer_profiles WHERE user_id = v_user1;
  SELECT id INTO v_customer2_id FROM public.customer_profiles WHERE user_id = v_user2;

  -- ── saved_addresses ───────────────────────────────────────────────────────
  INSERT INTO public.saved_addresses (
    id, customer_id, label, street, city, notes, is_default
  ) VALUES
  (
    'c4000001-0000-4000-8000-000000000001',
    v_customer1_id,
    'Casa',
    'Av. Las Condes 4567, Depto 1202',
    'Las Condes',
    'Portería automática',
    true
  ),
  (
    'c4000002-0000-4000-8000-000000000002',
    v_customer1_id,
    'Trabajo',
    'Av. Apoquindo 3000, Oficina 502',
    'Las Condes',
    NULL,
    false
  ),
  (
    'c4000003-0000-4000-8000-000000000003',
    v_customer2_id,
    'Casa',
    'Calle Merced 890',
    'Santiago Centro',
    'Timbre 3B',
    true
  )
  ON CONFLICT (id) DO NOTHING;

  -- ── Pedido presencial (paid) — comensal 2 ─────────────────────────────────
  INSERT INTO public.orders (
    id, restaurant_id, table_id, status, total, client_name, customer_id, created_at
  ) VALUES (
    v_order_pres_id,
    v_restaurant_id,
    v_table_id,
    'paid',
    24700,
    'Diego Fuentes',
    v_customer2_id,
    now() - interval '3 days'
  )
  ON CONFLICT (id) DO UPDATE SET
    customer_id = EXCLUDED.customer_id,
    status      = EXCLUDED.status;

  IF NOT EXISTS (SELECT 1 FROM public.order_items WHERE order_id = v_order_pres_id) THEN
    INSERT INTO public.order_items (order_id, menu_item_id, name, quantity, unit_price, status)
    SELECT
      v_order_pres_id,
      m.id,
      m.name,
      1,
      m.price,
      'ready'
    FROM public.menu_items m
    WHERE m.restaurant_id = v_restaurant_id
    LIMIT 2;
  END IF;

  -- ── Delivery orders con customer_id ───────────────────────────────────────
  INSERT INTO public.delivery_orders (
    id, restaurant_id, rider_id, customer_id, status,
    pickup_address, delivery_address,
    client_name, client_phone,
    total_clp, delivery_fee_clp,
    picked_up_at, delivered_at, created_at
  ) VALUES
  (
    v_order_deliv1_id,
    v_restaurant_id,
    v_rider_id,
    v_customer1_id,
    'delivered',
    'Av. Providencia 2124, Providencia',
    'Av. Las Condes 4567, Depto 1202',
    'Valentina Morales',
    '+56911110001',
    18500,
    2000,
    now() - interval '2 days 3 hours',
    now() - interval '2 days 2 hours',
    now() - interval '2 days 4 hours'
  ),
  (
    v_order_deliv2_id,
    v_restaurant_id,
    v_rider_id,
    v_customer1_id,
    'in_transit',
    'Av. Providencia 2124, Providencia',
    'Av. Apoquindo 3000, Oficina 502',
    'Valentina Morales',
    '+56911110001',
    12900,
    2000,
    now() - interval '20 minutes',
    NULL,
    now() - interval '45 minutes'
  )
  ON CONFLICT (id) DO UPDATE SET
    customer_id = EXCLUDED.customer_id,
    status      = EXCLUDED.status,
    rider_id    = COALESCE(EXCLUDED.rider_id, delivery_orders.rider_id);

  -- ── loyalty_transactions ──────────────────────────────────────────────────
  INSERT INTO public.loyalty_transactions (
    id, customer_id, order_id, order_type, points_delta, balance_after, description, created_at
  ) VALUES
  (
    'c5000001-0000-4000-8000-000000000001',
    v_customer1_id,
    v_order_deliv1_id,
    'delivery',
    185,
    1250,
    'Puntos por pedido delivery entregado',
    now() - interval '2 days'
  ),
  (
    'c5000002-0000-4000-8000-000000000002',
    v_customer2_id,
    v_order_pres_id,
    'presencial',
    247,
    480,
    'Puntos por visita en local',
    now() - interval '3 days'
  ),
  (
    'c5000003-0000-4000-8000-000000000003',
    v_customer1_id,
    NULL,
    NULL,
    -500,
    750,
    'Canje de puntos (demo histórico)',
    now() - interval '10 days'
  )
  ON CONFLICT (id) DO NOTHING;

  -- ── customer_ratings ──────────────────────────────────────────────────────
  IF v_rider_id IS NOT NULL THEN
    INSERT INTO public.customer_ratings (
      id, customer_id, entity_type, entity_id, order_id, order_type, stars, comment
    ) VALUES
    (
      'c6000001-0000-4000-8000-000000000001',
      v_customer1_id,
      'rider',
      v_rider_id,
      v_order_deliv1_id,
      'delivery',
      5,
      'Muy rápido y amable'
    ),
    (
      'c6000002-0000-4000-8000-000000000002',
      v_customer1_id,
      'restaurant',
      v_restaurant_id,
      v_order_deliv1_id,
      'delivery',
      4,
      'Comida llegó caliente'
    )
    ON CONFLICT (customer_id, order_id, entity_type) DO NOTHING;
  END IF;

  INSERT INTO public.customer_ratings (
    id, customer_id, entity_type, entity_id, order_id, order_type, stars, comment
  ) VALUES (
    'c6000003-0000-4000-8000-000000000003',
    v_customer2_id,
    'restaurant',
    v_restaurant_id,
    v_order_pres_id,
    'presencial',
    5,
    'Excelente atención en mesa'
  )
  ON CONFLICT (customer_id, order_id, entity_type) DO NOTHING;

  -- ── Evento geofence demo (comensal autenticado) ───────────────────────────
  INSERT INTO public.customer_geofence_events (
    id, customer_id, restaurant_id, entered_at, notification_sent
  ) VALUES (
    'c7000001-0000-4000-8000-000000000001',
    v_customer1_id,
    v_restaurant_id,
    now() - interval '1 day',
    true
  )
  ON CONFLICT (id) DO NOTHING;

  RAISE NOTICE 'usuario_comensal_demo: seed OK — restaurant %, customers % / %',
    v_restaurant_id, v_customer1_id, v_customer2_id;
END;
$$;
