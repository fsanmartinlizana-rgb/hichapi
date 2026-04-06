# Schema HiChapi — Modelo de datos completo

## Diagrama de relaciones

```
restaurants ──< tables ──< orders ──< order_items >── menu_items
                                  └─< order_events
                                  └── payments
     └──< menu_items
     └──< nps_responses
     └──< chat_sessions
     └── daily_summaries
     └── hourly_stats
```

---

## Tablas core

### `restaurants`
```sql
id              uuid PK
slug            text UNIQUE          -- "el-rincon-de-don-jose"
name            text
address         text
neighborhood    text
lat / lng       float8
cuisine_type    text
price_range     text                 -- '$' '$$' '$$$'
active          bool DEFAULT true    -- aprobado por admin
photo_url       text
rating          float4
review_count    int
owner_id        uuid FK auth.users
created_at      timestamptz
```

### `tables`
```sql
id              uuid PK
restaurant_id   uuid FK restaurants
label           text                 -- "Mesa 4", "Barra 1"
seats           int
qr_code         text                 -- URL del QR
active          bool DEFAULT true
position_x/y    float4               -- para mapa del local (futuro)
```

### `menu_items`
```sql
id              uuid PK
restaurant_id   uuid FK restaurants
name            text
description     text
price           int                  -- CLP, sin decimales
tags            text[]               -- ['sin gluten','vegano','picante']
photo_url       text
available       bool DEFAULT true
category        text                 -- 'entrada','principal','postre','bebida'
cost_price      int                  -- costo real (margen de ganancia)
display_order   int
created_at      timestamptz
```

### `orders`
```sql
id              uuid PK
restaurant_id   uuid FK restaurants
table_id        uuid FK tables
session_token   text                 -- token anónimo del comensal
status          text                 -- 'recibida'|'preparando'|'lista'|'entregada'|'pagada'|'cancelada'
pax             int                  -- cantidad de personas
total_amount    int                  -- CLP
via_chapi       bool DEFAULT false   -- fue creado por Chapi at Table
split_count     int DEFAULT 1        -- cantidad de divisiones de cuenta
notes           text
created_at      timestamptz
updated_at      timestamptz
paid_at         timestamptz
```

### `order_items`
```sql
id              uuid PK
order_id        uuid FK orders
menu_item_id    uuid FK menu_items
quantity        int
unit_price      int                  -- precio al momento del pedido (snapshot)
note            text                 -- "sin ajo", "término medio"
status          text                 -- 'pendiente'|'preparando'|'listo'|'cancelado'
```

### `order_events`
```sql
id              uuid PK
order_id        uuid FK orders
event_type      text                 -- 'created'|'status_change'|'item_added'|'payment_requested'
from_status     text
to_status       text
triggered_by    text                 -- 'chapi'|'waiter'|'system'
metadata        jsonb                -- contexto extra (ej: split_amounts)
created_at      timestamptz
```

### `payments`
```sql
id              uuid PK
order_id        uuid FK orders
amount          int                  -- CLP
method          text                 -- 'efectivo'|'debito'|'credito'|'split'
stripe_id       text                 -- si aplica
split_index     int                  -- 1 de N en split
split_total     int                  -- N total
status          text                 -- 'pending'|'paid'|'refunded'
paid_at         timestamptz
```

### `nps_responses`
```sql
id              uuid PK
restaurant_id   uuid FK restaurants
order_id        uuid FK orders        -- nullable
table_id        uuid FK tables        -- nullable
score           int                   -- 0-10
comment         text
category        text                  -- 'promotor'|'neutro'|'detractor'
created_at      timestamptz
```

### `chat_sessions`
```sql
id              uuid PK
restaurant_id   uuid FK restaurants
table_id        uuid FK tables        -- nullable (discovery no tiene mesa)
session_type    text                  -- 'discovery'|'at_table'
messages        jsonb[]               -- [{role, content, intent, timestamp}]
intent_final    jsonb                 -- intent final resuelto
orders_created  uuid[]                -- órdenes generadas en la sesión
tokens_used     int
cost_usd        float4
created_at      timestamptz
```

---

## Tablas de analytics (pre-computadas por cron nocturno)

### `daily_summaries`
```sql
id                  uuid PK
restaurant_id       uuid FK restaurants
date                date UNIQUE per restaurant
-- Ventas
total_revenue       int              -- CLP
order_count         int
avg_ticket          int
-- Tráfico
covers              int              -- personas totales
table_turnover      float4           -- vueltas promedio por mesa
avg_table_duration  int              -- minutos
-- Chapi
chapi_orders_pct    float4           -- % órdenes vía Chapi
chapi_upsell_count  int              -- cross-sells aceptados
-- Top items (snapshot)
top_items           jsonb            -- [{item_id, name, count, revenue}]
-- NPS
nps_score           float4
nps_count           int
promotors_pct       float4
-- Horario
peak_hour           int              -- hora de mayor actividad (0-23)
revenue_by_hour     jsonb            -- {11: 45000, 12: 120000, ...}
-- Costos
food_cost_pct       float4           -- solo si ingresaron cost_price
created_at          timestamptz
```

### `weekly_summaries`
```sql
id                  uuid PK
restaurant_id       uuid FK restaurants
week_start          date             -- lunes
-- Igual estructura que daily_summaries pero agregado 7 días
total_revenue       int
order_count         int
avg_ticket          int
covers              int
top_items           jsonb
nps_score           float4
best_day            date
worst_day           date
wow_revenue_delta   float4           -- vs semana anterior (%)
created_at          timestamptz
```

### `menu_item_stats`
```sql
id                  uuid PK
menu_item_id        uuid FK menu_items
restaurant_id       uuid FK restaurants
period              text             -- 'day'|'week'|'month'
period_start        date
sold_count          int
revenue             int
avg_per_order       float4           -- unidades promedio cuando se pide
paired_with         jsonb            -- [{item_id, count}] — qué se pide junto
upsell_accepted     int              -- veces que Chapi lo ofreció y se aceptó
upsell_rejected     int
return_rate         float4           -- % clientes que lo piden de nuevo (por session_token)
created_at          timestamptz
```

---

## Qué recomendaciones puede generar Chapi con este schema

### Tiempo real (Haiku, en el panel)
- **Stock alert**: si `sold_count hoy` acerca al inventario declarado → "Quedan 4 porciones de lomo"
- **Cross-sell activo**: si `paired_with` muestra alta correlación → ofrecer postre al pedir principal
- **Peak predicción**: `revenue_by_hour` histórico → "Peak en 40 min, tienes 3 mesas libres"
- **Mesa lenta**: orden lleva >30min en `preparando` → alerta al garzón

### Diario (Sonnet batch, cron 02:00)
- **Reporte del día**: resumen narrativo de ventas, hits, misses vs semana anterior
- **Plato a pausar**: item con alto `food_cost_pct` y bajo `sold_count` → "Considera sacar el ceviche del menú activo"
- **Precio a revisar**: ticket promedio cayó → qué items bajaron en frecuencia

### Semanal/mensual (Sonnet batch, cron domingo)
- **Tendencia de temporada**: `wow_revenue_delta` de 4 semanas → "Llevas 3 semanas creciendo +8%"
- **Menú optimization**: `menu_item_stats` mensual → top/bottom performers con margen
- **NPS drill-down**: comentarios agrupados por tema (cocina, servicio, tiempo) vía análisis semántico
- **Comparativa de días**: qué día de la semana rinde más, para decidir turnos y promos

---

## RLS policies (resumen)

| Tabla | cliente | garzón | admin restaurante | super_admin |
|-------|---------|--------|-------------------|-------------|
| restaurants | SELECT activos | SELECT su rest. | ALL su rest. | ALL |
| tables | — | SELECT su rest. | ALL su rest. | ALL |
| orders | SELECT propias (session_token) | ALL su rest. | ALL su rest. | ALL |
| order_items | SELECT propias | ALL su rest. | ALL su rest. | ALL |
| menu_items | SELECT disponibles | SELECT su rest. | ALL su rest. | ALL |
| daily_summaries | — | SELECT su rest. | ALL su rest. | ALL |
| nps_responses | INSERT anónimo | SELECT su rest. | ALL su rest. | ALL |
| chat_sessions | INSERT/SELECT propias | — | ALL su rest. | ALL |

---

## Migraciones pendientes

```
supabase/migrations/
  20250406_001_tables.sql           -- tabla tables
  20250406_002_orders.sql           -- orders + order_items + order_events
  20250406_003_payments.sql         -- payments
  20250406_004_nps.sql              -- nps_responses
  20250406_005_chat_sessions.sql    -- chat_sessions
  20250406_006_analytics.sql        -- daily_summaries + weekly_summaries + menu_item_stats
  20250406_007_rls.sql              -- todas las policies
```
