---
name: hichapi-schema
description: Referencia rápida del schema de base de datos de HiChapi, relaciones entre entidades, y patrones de query más usados. Consultar siempre que necesites saber qué campos tiene una tabla, cómo se relacionan las entidades, o cómo construir una query específica del proyecto.
---

# HiChapi — Schema Reference

## Diagrama de relaciones

```
office_accounts ──── users ──── restaurants ──── tables
                       │              │               │
                  user_benefits  menu_items        orders
                       │              │               │
              user_loyalty_stamps  (embedding)    feedback
                                                      │
                                               daily_reports
                                          restaurant_campaigns
                                           notifications_log
```

## Tablas detalladas

### restaurants
```sql
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
name text NOT NULL
slug text UNIQUE NOT NULL          -- URL amigable: "el-otro-sitio"
address text
lat numeric(10,7)
lng numeric(10,7)
location geography(Point, 4326)    -- PostGIS para geo queries
config_chapi jsonb DEFAULT '{}'    -- tone, welcome_msg, daily_suggestion, upsell
plan text DEFAULT 'free'           -- free | discovery | at_table
active boolean DEFAULT true
stripe_customer_id text
created_at timestamptz DEFAULT now()
```

### users
```sql
id uuid PRIMARY KEY REFERENCES auth.users
email text UNIQUE
phone text
name text
role text NOT NULL                 -- client | waiter | supervisor | admin | super_admin
restaurant_id uuid REFERENCES restaurants  -- null para clientes
sector_id uuid                     -- sector del garzón dentro del restaurante
created_at timestamptz DEFAULT now()
```

### menu_items
```sql
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
restaurant_id uuid REFERENCES restaurants NOT NULL
name text NOT NULL
description text
price integer NOT NULL             -- en CLP (centavos no, pesos directos)
category text
tags text[] DEFAULT '{}'           -- ['vegano', 'sin gluten', 'picante']
photo_url text
embedding vector(1536)             -- para búsqueda semántica
available boolean DEFAULT true
created_at timestamptz DEFAULT now()
```

### orders
```sql
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
restaurant_id uuid REFERENCES restaurants NOT NULL
table_id uuid REFERENCES tables
user_id uuid REFERENCES users
items jsonb NOT NULL               -- [{item_id, name, quantity, price, modifications}]
status text DEFAULT 'pending'      -- pending | preparing | ready | paying | closed
total integer NOT NULL             -- en CLP
via_chapi boolean DEFAULT false    -- ¿pedido via app o manual?
notes text
created_at timestamptz DEFAULT now()
updated_at timestamptz DEFAULT now()
```

### tables
```sql
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
restaurant_id uuid REFERENCES restaurants NOT NULL
number integer NOT NULL
sector_id uuid
status text DEFAULT 'free'         -- free | occupied | paying | reserved
qr_code text                       -- URL del QR: /mesa/{slug}/{table_id}
current_order_id uuid REFERENCES orders
created_at timestamptz DEFAULT now()
```

### feedback
```sql
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
order_id uuid REFERENCES orders
restaurant_id uuid REFERENCES restaurants
score integer CHECK (score BETWEEN 1 AND 10)
comment text
sentiment text                     -- positive | neutral | negative (calculado)
target text                        -- app | local (¿feedback sobre la app o el restaurante?)
created_at timestamptz DEFAULT now()
```

### daily_reports
```sql
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
restaurant_id uuid REFERENCES restaurants NOT NULL
date date NOT NULL
metrics jsonb NOT NULL             -- sales_total, orders_count, avg_ticket, nps, etc.
chapi_analysis text                -- narrativa generada por Sonnet
created_at timestamptz DEFAULT now()
UNIQUE (restaurant_id, date)
```

### restaurant_campaigns (Chapi Plus)
```sql
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
restaurant_id uuid REFERENCES restaurants NOT NULL
type text NOT NULL                 -- valley_hour | happy_hour | special_offer
discount integer                   -- porcentaje 0-100
description text
radius_m integer DEFAULT 500       -- radio de geofencing en metros
active_from timestamptz NOT NULL
active_to timestamptz NOT NULL
active boolean DEFAULT true
created_at timestamptz DEFAULT now()
```

### user_loyalty_stamps
```sql
user_id uuid REFERENCES users
restaurant_id uuid REFERENCES restaurants
stamps integer DEFAULT 0
reward_threshold integer DEFAULT 5  -- cada 5 visitas, reward
PRIMARY KEY (user_id, restaurant_id)
```

### notifications_log
```sql
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
user_id uuid REFERENCES users
restaurant_id uuid REFERENCES restaurants
campaign_id uuid REFERENCES restaurant_campaigns
sent_at timestamptz DEFAULT now()
opened_at timestamptz
converted_at timestamptz           -- null si no convirtió
```

## Queries más usadas

### Búsqueda semántica con geo
```sql
SELECT mi.*, r.name, r.address,
  1 - (mi.embedding <=> $1::vector) AS similarity,
  ST_Distance(r.location, ST_MakePoint($3, $2)::geography) AS distance_m
FROM menu_items mi
JOIN restaurants r ON r.id = mi.restaurant_id
WHERE r.active = true
  AND mi.available = true
  AND ST_DWithin(r.location, ST_MakePoint($3, $2)::geography, $4)
  AND ($5::text[] IS NULL OR mi.tags && $5)
  AND ($6::integer IS NULL OR mi.price <= $6)
ORDER BY mi.embedding <=> $1::vector
LIMIT 5;
-- $1: query_embedding, $2: lat, $3: lng, $4: radius_m, $5: tags, $6: budget
```

### Estado de mesas de un restaurante
```sql
SELECT t.*, o.id as order_id, o.total, o.created_at as order_started
FROM tables t
LEFT JOIN orders o ON o.id = t.current_order_id
WHERE t.restaurant_id = $1
ORDER BY t.number;
```

### Métricas del día para el dashboard
```sql
SELECT
  COUNT(*) as orders_count,
  SUM(total) as sales_total,
  AVG(total)::integer as avg_ticket,
  COUNT(*) FILTER (WHERE via_chapi = true) * 100 / COUNT(*) as via_chapi_pct
FROM orders
WHERE restaurant_id = $1
  AND created_at::date = CURRENT_DATE
  AND status = 'closed';
```
