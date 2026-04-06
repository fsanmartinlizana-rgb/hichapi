-- 5 restaurantes de ejemplo en Santiago
INSERT INTO restaurants (name, slug, address, neighborhood, lat, lng, location, cuisine_type, price_range, rating, review_count, photo_url) VALUES
(
  'La Verde Cocina',
  'la-verde-cocina',
  'Av. Italia 1234, Barrio Italia',
  'Barrio Italia',
  -33.4489,
  -70.6093,
  ST_MakePoint(-70.6093, -33.4489)::GEOGRAPHY,
  'vegetariana',
  'medio',
  4.6,
  234,
  'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800'
),
(
  'Ramen Tokio',
  'ramen-tokio',
  'Loreto 123, Providencia',
  'Providencia',
  -33.4372,
  -70.6328,
  ST_MakePoint(-70.6328, -33.4372)::GEOGRAPHY,
  'japonesa',
  'medio',
  4.8,
  512,
  'https://images.unsplash.com/photo-1569050467447-ce54b3bbc37d?w=800'
),
(
  'El Otro Sitio',
  'el-otro-sitio',
  'Condell 88, Providencia',
  'Providencia',
  -33.4401,
  -70.6380,
  ST_MakePoint(-70.6380, -33.4401)::GEOGRAPHY,
  'chilena contemporánea',
  'medio',
  4.4,
  189,
  'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800'
),
(
  'Pani',
  'pani',
  'Nueva de Lyon 99, Providencia',
  'Providencia',
  -33.4355,
  -70.6298,
  ST_MakePoint(-70.6298, -33.4355)::GEOGRAPHY,
  'mediterránea',
  'premium',
  4.9,
  891,
  'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800'
),
(
  'Fuente Suiza',
  'fuente-suiza',
  'Huérfanos 1936, Santiago Centro',
  'Santiago Centro',
  -33.4430,
  -70.6650,
  ST_MakePoint(-70.6650, -33.4430)::GEOGRAPHY,
  'sandwichería clásica',
  'economico',
  4.3,
  1203,
  'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800'
);

-- Items de menú
INSERT INTO menu_items (restaurant_id, name, description, price, category, tags)
SELECT
  id,
  'Bowl Primavera Sin Gluten',
  'Quinoa, verduras asadas, aderezo de tahini, semillas tostadas',
  9800,
  'bowls',
  ARRAY['sin gluten', 'vegano', 'saludable']
FROM restaurants WHERE slug = 'la-verde-cocina';

INSERT INTO menu_items (restaurant_id, name, description, price, category, tags)
SELECT
  id,
  'Ramen Tonkotsu',
  'Caldo de cerdo 12 horas, fideos artesanales, chashu, huevo curado',
  12900,
  'platos principales',
  ARRAY['sin lactosa', 'caldo profundo']
FROM restaurants WHERE slug = 'ramen-tokio';

INSERT INTO menu_items (restaurant_id, name, description, price, category, tags)
SELECT
  id,
  'Congrio al vapor',
  'Congrio fresco, papas nativas, pebre de cilantro',
  14900,
  'platos principales',
  ARRAY['sin gluten', 'pescado fresco', 'sin lactosa']
FROM restaurants WHERE slug = 'el-otro-sitio';

INSERT INTO menu_items (restaurant_id, name, description, price, category, tags)
SELECT
  id,
  'Tartare de salmón',
  'Salmón atlántico, aguacate, alcaparras, pan de trigo',
  18900,
  'entradas',
  ARRAY['sin gluten disponible', 'mariscos', 'fresco']
FROM restaurants WHERE slug = 'pani';

INSERT INTO menu_items (restaurant_id, name, description, price, category, tags)
SELECT
  id,
  'Barros Luco',
  'Filete de vacuno, queso fundido, pan francés tostado',
  7500,
  'sandwiches',
  ARRAY['chileno', 'contundente', 'clásico']
FROM restaurants WHERE slug = 'fuente-suiza';
