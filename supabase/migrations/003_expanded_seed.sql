-- ─── 003_expanded_seed.sql ───────────────────────────────────────────────────
-- Expande la base de datos de prueba de 5 a 20 restaurantes
-- Cubre: 8 barrios × múltiples cocinas × todos los rangos de precio
-- Ejecutar en: Supabase Dashboard → SQL Editor → New Query → Run
-- ─────────────────────────────────────────────────────────────────────────────

-- Limpia seed anterior para evitar duplicados
DELETE FROM menu_items WHERE restaurant_id IN (
  SELECT id FROM restaurants WHERE plan = 'free'
);
DELETE FROM restaurants WHERE plan = 'free';

-- ─── RESTAURANTES ─────────────────────────────────────────────────────────────

INSERT INTO restaurants (name, slug, address, neighborhood, lat, lng, location, cuisine_type, price_range, rating, review_count, photo_url, active) VALUES

-- PROVIDENCIA (4 restaurantes)
(
  'Ramen Tokio',
  'ramen-tokio',
  'Loreto 123, Providencia',
  'Providencia',
  -33.4372, -70.6328,
  ST_MakePoint(-70.6328, -33.4372)::GEOGRAPHY,
  'japonesa', 'medio', 4.8, 512,
  'https://images.unsplash.com/photo-1569050467447-ce54b3bbc37d?w=800',
  true
),
(
  'Pani',
  'pani',
  'Nueva de Lyon 99, Providencia',
  'Providencia',
  -33.4355, -70.6298,
  ST_MakePoint(-70.6298, -33.4355)::GEOGRAPHY,
  'mediterránea', 'premium', 4.9, 891,
  'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800',
  true
),
(
  'El Otro Sitio',
  'el-otro-sitio',
  'Condell 88, Providencia',
  'Providencia',
  -33.4401, -70.6380,
  ST_MakePoint(-70.6380, -33.4401)::GEOGRAPHY,
  'chilena contemporánea', 'medio', 4.4, 189,
  'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800',
  true
),
(
  'Sukho Thai',
  'sukho-thai',
  'Nueva de Lyon 017, Providencia',
  'Providencia',
  -33.4348, -70.6305,
  ST_MakePoint(-70.6305, -33.4348)::GEOGRAPHY,
  'tailandesa', 'medio', 4.6, 344,
  'https://images.unsplash.com/photo-1562565652-a0d8f0c59eb4?w=800',
  true
),

-- BARRIO ITALIA (3 restaurantes)
(
  'La Verde Cocina',
  'la-verde-cocina',
  'Av. Italia 1234, Barrio Italia',
  'Barrio Italia',
  -33.4489, -70.6093,
  ST_MakePoint(-70.6093, -33.4489)::GEOGRAPHY,
  'vegetariana', 'medio', 4.6, 234,
  'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800',
  true
),
(
  'Pizzería Infierno',
  'pizzeria-infierno',
  'Condell 1300, Barrio Italia',
  'Barrio Italia',
  -33.4501, -70.6110,
  ST_MakePoint(-70.6110, -33.4501)::GEOGRAPHY,
  'italiana', 'medio', 4.5, 678,
  'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=800',
  true
),
(
  'Café Quínoa',
  'cafe-quinoa',
  'Ernesto Pinto Lagarrigue 362, Barrio Italia',
  'Barrio Italia',
  -33.4478, -70.6088,
  ST_MakePoint(-70.6088, -33.4478)::GEOGRAPHY,
  'vegana', 'economico', 4.7, 421,
  'https://images.unsplash.com/photo-1498579150354-977475b7ea0b?w=800',
  true
),

-- BELLAVISTA (3 restaurantes)
(
  'Galindo',
  'galindo',
  'Dardignac 098, Bellavista',
  'Bellavista',
  -33.4335, -70.6452,
  ST_MakePoint(-70.6452, -33.4335)::GEOGRAPHY,
  'chilena', 'medio', 4.3, 902,
  'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800',
  true
),
(
  'El Toro',
  'el-toro',
  'Loreto 33, Bellavista',
  'Bellavista',
  -33.4329, -70.6441,
  ST_MakePoint(-70.6441, -33.4329)::GEOGRAPHY,
  'hamburguesería', 'economico', 4.2, 1540,
  'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800',
  true
),
(
  'Azul Profundo',
  'azul-profundo',
  'Constitución 111, Bellavista',
  'Bellavista',
  -33.4340, -70.6460,
  ST_MakePoint(-70.6460, -33.4340)::GEOGRAPHY,
  'mariscos', 'premium', 4.7, 312,
  'https://images.unsplash.com/photo-1534482421-64566f976cfa?w=800',
  true
),

-- LASTARRIA (2 restaurantes)
(
  'Bocanariz',
  'bocanariz',
  'José Victorino Lastarria 276, Lastarria',
  'Lastarria',
  -33.4381, -70.6411,
  ST_MakePoint(-70.6411, -33.4381)::GEOGRAPHY,
  'chilena contemporánea', 'premium', 4.8, 567,
  'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800',
  true
),
(
  'Peluquería Francesa',
  'peluqueria-francesa',
  'París 813, Lastarria',
  'Lastarria',
  -33.4395, -70.6425,
  ST_MakePoint(-70.6425, -33.4395)::GEOGRAPHY,
  'francesa', 'premium', 4.6, 288,
  'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800',
  true
),

-- SANTIAGO CENTRO (2 restaurantes)
(
  'Fuente Suiza',
  'fuente-suiza',
  'Huérfanos 1936, Santiago Centro',
  'Santiago Centro',
  -33.4430, -70.6650,
  ST_MakePoint(-70.6650, -33.4430)::GEOGRAPHY,
  'sandwichería', 'economico', 4.3, 1203,
  'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800',
  true
),
(
  'Liguria Centro',
  'liguria-centro',
  'Luis Thayer Ojeda 019, Santiago Centro',
  'Santiago Centro',
  -33.4420, -70.6580,
  ST_MakePoint(-70.6580, -33.4420)::GEOGRAPHY,
  'chilena', 'medio', 4.4, 756,
  'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800',
  true
),

-- LAS CONDES (2 restaurantes)
(
  'Osaka',
  'osaka-las-condes',
  'Isidora Goyenechea 3000, Las Condes',
  'Las Condes',
  -33.4103, -70.5777,
  ST_MakePoint(-70.5777, -33.4103)::GEOGRAPHY,
  'nikkei', 'premium', 4.9, 1104,
  'https://images.unsplash.com/photo-1569050467447-ce54b3bbc37d?w=800',
  true
),
(
  'Mestizo',
  'mestizo',
  'Av. Bicentenario 4050, Las Condes',
  'Las Condes',
  -33.4118, -70.5802,
  ST_MakePoint(-70.5802, -33.4118)::GEOGRAPHY,
  'peruana', 'premium', 4.7, 632,
  'https://images.unsplash.com/photo-1534482421-64566f976cfa?w=800',
  true
),

-- VITACURA (2 restaurantes)
(
  'Zeal',
  'zeal-vitacura',
  'Nueva Costanera 3969, Vitacura',
  'Vitacura',
  -33.3925, -70.5869,
  ST_MakePoint(-70.5869, -33.3925)::GEOGRAPHY,
  'internacional', 'premium', 4.8, 445,
  'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800',
  true
),
(
  'Happening',
  'happening-vitacura',
  'Av. Apoquindo 3090, Vitacura',
  'Vitacura',
  -33.3940, -70.5880,
  ST_MakePoint(-70.5880, -33.3940)::GEOGRAPHY,
  'parrilla argentina', 'premium', 4.5, 890,
  'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=800',
  true
),

-- ÑUÑOA (2 restaurantes)
(
  'La Piojera Ñuñoa',
  'la-piojera-nunoa',
  'Av. Irarrázaval 1835, Ñuñoa',
  'Ñuñoa',
  -33.4558, -70.5973,
  ST_MakePoint(-70.5973, -33.4558)::GEOGRAPHY,
  'chilena', 'economico', 4.1, 2301,
  'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800',
  true
),
(
  'Shizen Ramen',
  'shizen-ramen',
  'Av. Ossa 1940, Ñuñoa',
  'Ñuñoa',
  -33.4570, -70.5960,
  ST_MakePoint(-70.5960, -33.4570)::GEOGRAPHY,
  'japonesa', 'medio', 4.6, 388,
  'https://images.unsplash.com/photo-1569050467447-ce54b3bbc37d?w=800',
  true
);

-- ─── MENÚ ITEMS ───────────────────────────────────────────────────────────────

-- Ramen Tokio
INSERT INTO menu_items (restaurant_id, name, description, price, category, tags) SELECT id, 'Ramen Tonkotsu', 'Caldo de cerdo 12 horas, fideos artesanales, chashu, huevo curado', 12900, 'ramen', ARRAY['sin lactosa', 'caldo profundo', 'japonesa'] FROM restaurants WHERE slug = 'ramen-tokio';
INSERT INTO menu_items (restaurant_id, name, description, price, category, tags) SELECT id, 'Ramen Vegano Shio', 'Caldo de kombu y shiitake, tofu ahumado, brotes, aceite de sésamo', 11900, 'ramen', ARRAY['vegano', 'sin lactosa', 'sin gluten'] FROM restaurants WHERE slug = 'ramen-tokio';
INSERT INTO menu_items (restaurant_id, name, description, price, category, tags) SELECT id, 'Gyoza Frita (6 un.)', 'Gyozas de cerdo y repollo, salsa ponzu casera', 7500, 'entradas', ARRAY['japonesa', 'frito'] FROM restaurants WHERE slug = 'ramen-tokio';

-- Pani
INSERT INTO menu_items (restaurant_id, name, description, price, category, tags) SELECT id, 'Tartare de Salmón', 'Salmón atlántico, aguacate, alcaparras, tostadas de trigo', 18900, 'entradas', ARRAY['sin gluten disponible', 'mariscos', 'fresco'] FROM restaurants WHERE slug = 'pani';
INSERT INTO menu_items (restaurant_id, name, description, price, category, tags) SELECT id, 'Pasta Fresca Trufa', 'Tagliatelle artesanal, crema de trufa negra, parmesano', 16900, 'pastas', ARRAY['vegetariano', 'pasta fresca', 'premium'] FROM restaurants WHERE slug = 'pani';
INSERT INTO menu_items (restaurant_id, name, description, price, category, tags) SELECT id, 'Burrata Caprese', 'Burrata fresca, tomates heirloom, albahaca, aceite de oliva extra virgen', 14900, 'entradas', ARRAY['vegetariano', 'sin gluten', 'fresco'] FROM restaurants WHERE slug = 'pani';

-- El Otro Sitio
INSERT INTO menu_items (restaurant_id, name, description, price, category, tags) SELECT id, 'Congrio al Vapor', 'Congrio fresco, papas nativas, pebre de cilantro', 14900, 'platos principales', ARRAY['sin gluten', 'pescado fresco', 'sin lactosa', 'chilena'] FROM restaurants WHERE slug = 'el-otro-sitio';
INSERT INTO menu_items (restaurant_id, name, description, price, category, tags) SELECT id, 'Cazuela de Vacuno', 'Vacuno de campo, zapallo, choclo, arroz blanco', 12900, 'platos principales', ARRAY['sin gluten', 'chilena', 'tradicional'] FROM restaurants WHERE slug = 'el-otro-sitio';

-- Sukho Thai
INSERT INTO menu_items (restaurant_id, name, description, price, category, tags) SELECT id, 'Pad Thai Camarones', 'Fideos de arroz, camarones, huevo, cacahuetes, lima', 13900, 'platos principales', ARRAY['sin gluten', 'mariscos', 'tailandesa'] FROM restaurants WHERE slug = 'sukho-thai';
INSERT INTO menu_items (restaurant_id, name, description, price, category, tags) SELECT id, 'Pad Thai Vegano', 'Fideos de arroz, tofu, verduras salteadas, salsa tamarindo', 11900, 'platos principales', ARRAY['vegano', 'sin gluten', 'tailandesa'] FROM restaurants WHERE slug = 'sukho-thai';
INSERT INTO menu_items (restaurant_id, name, description, price, category, tags) SELECT id, 'Green Curry', 'Curry verde con leche de coco, verduras, arroz jazmín', 12900, 'platos principales', ARRAY['vegano', 'sin gluten', 'picante', 'tailandesa'] FROM restaurants WHERE slug = 'sukho-thai';

-- La Verde Cocina
INSERT INTO menu_items (restaurant_id, name, description, price, category, tags) SELECT id, 'Bowl Primavera Sin Gluten', 'Quinoa, verduras asadas, aderezo de tahini, semillas tostadas', 9800, 'bowls', ARRAY['sin gluten', 'vegano', 'saludable', 'vegetariana'] FROM restaurants WHERE slug = 'la-verde-cocina';
INSERT INTO menu_items (restaurant_id, name, description, price, category, tags) SELECT id, 'Burger Vegana BBQ', 'Medallón de legumbres, cheddar vegano, cebolla caramelizada, papas fritas', 10900, 'burgers', ARRAY['vegano', 'vegetariana', 'sin lactosa'] FROM restaurants WHERE slug = 'la-verde-cocina';
INSERT INTO menu_items (restaurant_id, name, description, price, category, tags) SELECT id, 'Tarta de Espinaca', 'Masa de avena, relleno de espinaca, ricotta vegana, tomates cherry', 8900, 'tartas', ARRAY['vegano', 'sin gluten', 'vegetariana'] FROM restaurants WHERE slug = 'la-verde-cocina';

-- Pizzería Infierno
INSERT INTO menu_items (restaurant_id, name, description, price, category, tags) SELECT id, 'Pizza Diavola', 'Salami picante, mozzarella fior di latte, aceitunas negras, albahaca', 13900, 'pizzas', ARRAY['italiana', 'picante'] FROM restaurants WHERE slug = 'pizzeria-infierno';
INSERT INTO menu_items (restaurant_id, name, description, price, category, tags) SELECT id, 'Pizza Vegana Funghi', 'Base de tomate, champiñones mixtos, rúcula, queso vegano, nueces', 12900, 'pizzas', ARRAY['vegano', 'vegetariana', 'italiana'] FROM restaurants WHERE slug = 'pizzeria-infierno';
INSERT INTO menu_items (restaurant_id, name, description, price, category, tags) SELECT id, 'Pasta Amatriciana', 'Bucatini, panceta crujiente, salsa de tomate san marzano, pecorino', 11900, 'pastas', ARRAY['italiana', 'sin lactosa disponible'] FROM restaurants WHERE slug = 'pizzeria-infierno';

-- Café Quínoa
INSERT INTO menu_items (restaurant_id, name, description, price, category, tags) SELECT id, 'Desayuno Vegano Completo', 'Tostadas de masa madre, palta, tomate, queso de cajú, jugo verde', 8900, 'desayunos', ARRAY['vegano', 'sin lactosa', 'saludable'] FROM restaurants WHERE slug = 'cafe-quinoa';
INSERT INTO menu_items (restaurant_id, name, description, price, category, tags) SELECT id, 'Bowl Açaí Sin Gluten', 'Açaí, banana, granola de quinoa, frutas del bosque, miel de agave', 7900, 'bowls', ARRAY['vegano', 'sin gluten', 'saludable', 'sin lactosa'] FROM restaurants WHERE slug = 'cafe-quinoa';
INSERT INTO menu_items (restaurant_id, name, description, price, category, tags) SELECT id, 'Wrap de Falafel', 'Falafel casero, hummus, taboulé, pepino, salsa tahini', 8500, 'wraps', ARRAY['vegano', 'sin gluten', 'árabe', 'proteico'] FROM restaurants WHERE slug = 'cafe-quinoa';

-- Galindo
INSERT INTO menu_items (restaurant_id, name, description, price, category, tags) SELECT id, 'Pastel de Choclo', 'Pastel de choclo clásico, pollo, vacuno, cebolla, aceitunas, huevo duro', 11900, 'platos principales', ARRAY['sin gluten', 'chilena', 'tradicional'] FROM restaurants WHERE slug = 'galindo';
INSERT INTO menu_items (restaurant_id, name, description, price, category, tags) SELECT id, 'Empanada de Pino', 'Empanada de horno, pino de vacuno, cebolla, aceitunas, huevo, pasas', 3900, 'entradas', ARRAY['chilena', 'tradicional'] FROM restaurants WHERE slug = 'galindo';

-- El Toro
INSERT INTO menu_items (restaurant_id, name, description, price, category, tags) SELECT id, 'El Toro Burger', 'Carne 200g, cheddar, tocino, cebolla caramelizada, papas fritas', 9900, 'burgers', ARRAY['contundente', 'clasico'] FROM restaurants WHERE slug = 'el-toro';
INSERT INTO menu_items (restaurant_id, name, description, price, category, tags) SELECT id, 'Burger Vegana', 'Medallón de portobello y garbanzos, lechuga, tomate, mayo vegana', 9200, 'burgers', ARRAY['vegano', 'sin lactosa'] FROM restaurants WHERE slug = 'el-toro';

-- Azul Profundo
INSERT INTO menu_items (restaurant_id, name, description, price, category, tags) SELECT id, 'Ceviche de Reineta', 'Reineta fresca, limón de pica, cebolla morada, cilantro, leche de tigre', 14900, 'ceviches', ARRAY['sin gluten', 'mariscos', 'fresco', 'pescados'] FROM restaurants WHERE slug = 'azul-profundo';
INSERT INTO menu_items (restaurant_id, name, description, price, category, tags) SELECT id, 'Plateada de Mariscos', 'Mix de mariscos a la mantequilla, arroz negro, alioli de azafrán', 19900, 'platos principales', ARRAY['sin gluten', 'mariscos', 'premium'] FROM restaurants WHERE slug = 'azul-profundo';

-- Bocanariz
INSERT INTO menu_items (restaurant_id, name, description, price, category, tags) SELECT id, 'Tabla de Carnes y Quesos', 'Selección de embutidos y quesos chilenos artesanales, mermeladas, pan', 18900, 'tablas', ARRAY['sin gluten disponible', 'chilena', 'para compartir'] FROM restaurants WHERE slug = 'bocanariz';
INSERT INTO menu_items (restaurant_id, name, description, price, category, tags) SELECT id, 'Osobuco Braseado', 'Osobuco de vacuno 6 horas, gremolata, puré rústico', 19900, 'platos principales', ARRAY['sin gluten', 'chilena', 'slow food'] FROM restaurants WHERE slug = 'bocanariz';

-- Peluquería Francesa
INSERT INTO menu_items (restaurant_id, name, description, price, category, tags) SELECT id, 'Crêpe Ratatouille', 'Crêpe de sarraceno, ratatouille provenzal, queso de cabra, tomillo', 12900, 'crêpes', ARRAY['vegetariano', 'francesa', 'sin gluten'] FROM restaurants WHERE slug = 'peluqueria-francesa';
INSERT INTO menu_items (restaurant_id, name, description, price, category, tags) SELECT id, 'Confit de Pato', 'Muslo de pato confitado, lentejuelas verdes, salsa de cerezas', 22900, 'platos principales', ARRAY['sin gluten', 'francesa', 'premium'] FROM restaurants WHERE slug = 'peluqueria-francesa';

-- Fuente Suiza
INSERT INTO menu_items (restaurant_id, name, description, price, category, tags) SELECT id, 'Barros Luco', 'Filete de vacuno, queso fundido, pan francés tostado', 7500, 'sandwiches', ARRAY['chilena', 'contundente', 'clásico'] FROM restaurants WHERE slug = 'fuente-suiza';
INSERT INTO menu_items (restaurant_id, name, description, price, category, tags) SELECT id, 'Churrasco Italiano', 'Lomo liso, palta, tomate, mayo, pan francés', 7200, 'sandwiches', ARRAY['chilena', 'clásico', 'economico'] FROM restaurants WHERE slug = 'fuente-suiza';

-- Liguria Centro
INSERT INTO menu_items (restaurant_id, name, description, price, category, tags) SELECT id, 'Chupe de Mariscos', 'Gratinado de mariscos, miga de pan, crema, queso parmesano', 14900, 'platos principales', ARRAY['mariscos', 'gratinado', 'chilena'] FROM restaurants WHERE slug = 'liguria-centro';
INSERT INTO menu_items (restaurant_id, name, description, price, category, tags) SELECT id, 'Lomo a lo Pobre', 'Lomo liso, papas fritas, cebolla frita, dos huevos fritos', 12900, 'platos principales', ARRAY['chilena', 'contundente', 'sin gluten'] FROM restaurants WHERE slug = 'liguria-centro';

-- Osaka
INSERT INTO menu_items (restaurant_id, name, description, price, category, tags) SELECT id, 'Tiradito Nikkei', 'Láminas de lenguado, leche de tigre con ají amarillo, maíz canchita, cilantro', 18900, 'tiraditos', ARRAY['sin gluten', 'mariscos', 'nikkei', 'pescados', 'fresco'] FROM restaurants WHERE slug = 'osaka-las-condes';
INSERT INTO menu_items (restaurant_id, name, description, price, category, tags) SELECT id, 'Sushi Roll Osaka', 'Roll de langostino tempura, palta, pepino, salsa anticuchera', 16900, 'rolls', ARRAY['mariscos', 'nikkei', 'premium'] FROM restaurants WHERE slug = 'osaka-las-condes';

-- Mestizo
INSERT INTO menu_items (restaurant_id, name, description, price, category, tags) SELECT id, 'Ceviche Clásico Peruano', 'Corvina fresca, limón, ají limo, cebolla morada, cancha, leche de tigre', 15900, 'ceviches', ARRAY['sin gluten', 'mariscos', 'peruana', 'fresco'] FROM restaurants WHERE slug = 'mestizo';
INSERT INTO menu_items (restaurant_id, name, description, price, category, tags) SELECT id, 'Causa Limeña Vegana', 'Papa amarilla, palta, ají amarillo, tomates confitados', 12900, 'entradas', ARRAY['vegano', 'sin gluten', 'peruana'] FROM restaurants WHERE slug = 'mestizo';

-- Zeal
INSERT INTO menu_items (restaurant_id, name, description, price, category, tags) SELECT id, 'Risotto de Setas', 'Risotto cremoso, mix de setas silvestres, parmesano, trufa negra', 19900, 'arroces', ARRAY['vegetariano', 'sin gluten', 'premium', 'internacional'] FROM restaurants WHERE slug = 'zeal-vitacura';
INSERT INTO menu_items (restaurant_id, name, description, price, category, tags) SELECT id, 'Salmon Rostizado', 'Salmón, costra de hierbas, puré de coliflor, salsa de alcaparras', 22900, 'platos principales', ARRAY['sin gluten', 'pescados', 'sin lactosa', 'premium'] FROM restaurants WHERE slug = 'zeal-vitacura';

-- Happening
INSERT INTO menu_items (restaurant_id, name, description, price, category, tags) SELECT id, 'Bife de Chorizo 400g', 'Bife premium, papas rústicas, ensalada criolla, chimichurri casero', 28900, 'carnes', ARRAY['sin gluten', 'parrilla', 'premium', 'argentina'] FROM restaurants WHERE slug = 'happening-vitacura';
INSERT INTO menu_items (restaurant_id, name, description, price, category, tags) SELECT id, 'Entraña a la Parrilla', 'Entraña de novillo, papas fritas, pebre', 19900, 'carnes', ARRAY['sin gluten', 'parrilla', 'argentina'] FROM restaurants WHERE slug = 'happening-vitacura';

-- La Piojera Ñuñoa
INSERT INTO menu_items (restaurant_id, name, description, price, category, tags) SELECT id, 'Choripán Completo', 'Chorizo artesanal, mayonesa, palta, tomate, pan marraqueta', 4500, 'sandwiches', ARRAY['chilena', 'economico', 'clásico'] FROM restaurants WHERE slug = 'la-piojera-nunoa';
INSERT INTO menu_items (restaurant_id, name, description, price, category, tags) SELECT id, 'Cazuela de Vacuno', 'Cazuela tradicional, vacuno de campo, verduras de estación', 8900, 'platos principales', ARRAY['sin gluten', 'chilena', 'tradicional', 'economico'] FROM restaurants WHERE slug = 'la-piojera-nunoa';

-- Shizen Ramen
INSERT INTO menu_items (restaurant_id, name, description, price, category, tags) SELECT id, 'Ramen Miso', 'Caldo de pollo y miso, fideos artesanales, maíz, mantequilla, nori', 11900, 'ramen', ARRAY['japonesa', 'sin lactosa disponible'] FROM restaurants WHERE slug = 'shizen-ramen';
INSERT INTO menu_items (restaurant_id, name, description, price, category, tags) SELECT id, 'Ramen Vegano Shoyu', 'Caldo de verduras y shoyu, tofu, champiñones, cebollín, nori', 10900, 'ramen', ARRAY['vegano', 'sin lactosa', 'japonesa'] FROM restaurants WHERE slug = 'shizen-ramen';
