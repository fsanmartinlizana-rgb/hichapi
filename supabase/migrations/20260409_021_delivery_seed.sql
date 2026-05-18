-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 021: Delivery Demo Seed Data
-- Creates 2 demo riders, delivery zone, fee tiers, and 3 demo delivery orders
-- for the existing demo restaurant.
-- Requirements: 8.10
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  v_restaurant_id  uuid;
  v_rider1_user_id uuid := gen_random_uuid();
  v_rider2_user_id uuid := gen_random_uuid();
  v_rider1_id      uuid;
  v_rider2_id      uuid;
  v_zone_id        uuid;
  v_order1_id      uuid;
  v_order2_id      uuid;
  v_order3_id      uuid;
BEGIN
  -- Get the demo restaurant ID
  SELECT id INTO v_restaurant_id
  FROM public.restaurants
  WHERE slug = 'demo-restaurante'
  LIMIT 1;

  -- Skip if demo restaurant doesn't exist
  IF v_restaurant_id IS NULL THEN
    RAISE NOTICE 'Demo restaurant not found, skipping delivery seed.';
    RETURN;
  END IF;

  -- ── 1. Create demo rider auth users ────────────────────────────────────────
  -- Note: In production, riders register via the app. These are demo-only users.
  INSERT INTO auth.users (
    id, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  ) VALUES
  (
    v_rider1_user_id,
    'rider1@demo.hichapi.cl',
    crypt('demo1234', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Carlos Mendoza"}',
    now(), now()
  ),
  (
    v_rider2_user_id,
    'rider2@demo.hichapi.cl',
    crypt('demo1234', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Ana Torres"}',
    now(), now()
  )
  ON CONFLICT (id) DO NOTHING;

  -- ── 2. Create rider profiles ────────────────────────────────────────────────
  INSERT INTO public.rider_profiles (
    user_id, full_name, phone, national_id,
    vehicle_type, license_plate, vehicle_model,
    status, document_status,
    avg_rating, total_ratings
  ) VALUES
  (
    v_rider1_user_id,
    'Carlos Mendoza',
    '+56912345678',
    '12.345.678-9',
    'motorcycle',
    'ABCD12',
    'Honda CB 190',
    'available',
    'approved',
    4.8, 24
  ),
  (
    v_rider2_user_id,
    'Ana Torres',
    '+56987654321',
    '98.765.432-1',
    'bicycle',
    NULL,
    'Trek FX3',
    'available',
    'approved',
    4.5, 12
  )
  ON CONFLICT (user_id) DO NOTHING
  RETURNING id INTO v_rider1_id;

  -- Get rider IDs
  SELECT id INTO v_rider1_id FROM public.rider_profiles WHERE user_id = v_rider1_user_id;
  SELECT id INTO v_rider2_id FROM public.rider_profiles WHERE user_id = v_rider2_user_id;

  -- ── 3. Create delivery zone ─────────────────────────────────────────────────
  INSERT INTO public.delivery_zones (
    restaurant_id, radius_km, center_lat, center_lng, active
  ) VALUES (
    v_restaurant_id,
    5.0,
    -33.4489,   -- Santiago centro
    -70.6693,
    true
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_zone_id;

  -- ── 4. Create fee tiers ─────────────────────────────────────────────────────
  INSERT INTO public.delivery_fee_tiers (
    restaurant_id, min_km, max_km, fee_clp, vehicle_types
  ) VALUES
  (v_restaurant_id, 0,   3,    2000, '{}'),
  (v_restaurant_id, 3,   7,    3500, '{}'),
  (v_restaurant_id, 7,   NULL, 5000, '{}')
  ON CONFLICT DO NOTHING;

  -- ── 5. Create demo delivery orders ─────────────────────────────────────────
  -- Order 1: delivered (with rating)
  INSERT INTO public.delivery_orders (
    restaurant_id, rider_id, status,
    pickup_address, delivery_address,
    client_name, client_phone,
    total_clp, delivery_fee_clp,
    picked_up_at, delivered_at
  ) VALUES (
    v_restaurant_id,
    v_rider1_id,
    'delivered',
    'Av. Providencia 1234, Santiago',
    'Av. Las Condes 5678, Santiago',
    'Juan Pérez',
    '+56911111111',
    18500,
    2000,
    now() - interval '2 hours',
    now() - interval '1 hour 30 minutes'
  )
  RETURNING id INTO v_order1_id;

  -- Order 2: in_transit
  INSERT INTO public.delivery_orders (
    restaurant_id, rider_id, status,
    pickup_address, delivery_address,
    client_name, client_phone,
    total_clp, delivery_fee_clp,
    picked_up_at
  ) VALUES (
    v_restaurant_id,
    v_rider2_id,
    'in_transit',
    'Av. Providencia 1234, Santiago',
    'Calle Merced 456, Santiago',
    'María González',
    '+56922222222',
    12000,
    2000,
    now() - interval '15 minutes'
  )
  RETURNING id INTO v_order2_id;

  -- Order 3: pending_assignment
  INSERT INTO public.delivery_orders (
    restaurant_id, status,
    pickup_address, delivery_address,
    client_name, client_phone,
    total_clp
  ) VALUES (
    v_restaurant_id,
    'pending_assignment',
    'Av. Providencia 1234, Santiago',
    'Av. Irarrázaval 789, Santiago',
    'Pedro Soto',
    '+56933333333',
    22000
  )
  RETURNING id INTO v_order3_id;

  -- ── 6. Create a rating for the delivered order ──────────────────────────────
  IF v_order1_id IS NOT NULL AND v_rider1_id IS NOT NULL THEN
    INSERT INTO public.rider_ratings (
      delivery_order_id, rider_id, restaurant_id,
      rated_by, stars, comment
    )
    SELECT
      v_order1_id,
      v_rider1_id,
      v_restaurant_id,
      owner_id,
      5,
      'Excelente servicio, muy puntual'
    FROM public.restaurants
    WHERE id = v_restaurant_id
    ON CONFLICT (delivery_order_id) DO NOTHING;
  END IF;

  RAISE NOTICE 'Delivery seed completed for restaurant %', v_restaurant_id;
END;
$$;
