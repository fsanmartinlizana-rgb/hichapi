-- Habilitar extensiones
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS vector;

-- Tabla restaurantes
CREATE TABLE restaurants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  address TEXT,
  neighborhood TEXT,
  lat NUMERIC(10, 7),
  lng NUMERIC(10, 7),
  location GEOGRAPHY(Point, 4326),
  photo_url TEXT,
  cuisine_type TEXT,
  price_range TEXT DEFAULT 'medio', -- economico | medio | premium
  rating NUMERIC(2, 1) DEFAULT 4.0,
  review_count INTEGER DEFAULT 0,
  active BOOLEAN DEFAULT true,
  plan TEXT DEFAULT 'free', -- free | discovery | at_table
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabla items del menú (con embeddings para búsqueda semántica)
CREATE TABLE menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price INTEGER NOT NULL, -- en CLP
  category TEXT,
  tags TEXT[] DEFAULT '{}', -- ['vegano', 'sin gluten', 'picante', etc]
  photo_url TEXT,
  embedding VECTOR(1536),
  available BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Índice geoespacial para búsquedas por distancia
CREATE INDEX restaurants_location_idx ON restaurants USING GIST (location);

-- Índice vectorial para búsqueda semántica
CREATE INDEX menu_items_embedding_idx ON menu_items
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- RLS
ALTER TABLE restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;

-- Políticas: lectura pública para Discovery
CREATE POLICY "public_read_restaurants" ON restaurants
  FOR SELECT USING (active = true);

CREATE POLICY "public_read_menu_items" ON menu_items
  FOR SELECT USING (available = true);

-- Función para búsqueda por radio
CREATE OR REPLACE FUNCTION restaurants_in_radius(
  lat FLOAT, lng FLOAT, radius_m FLOAT
)
RETURNS SETOF restaurants AS $$
  SELECT * FROM restaurants
  WHERE active = true
    AND ST_DWithin(
      location,
      ST_MakePoint(lng, lat)::GEOGRAPHY,
      radius_m
    )
$$ LANGUAGE sql STABLE;
