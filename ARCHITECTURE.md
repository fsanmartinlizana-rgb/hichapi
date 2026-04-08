# HiChapi — Arquitectura & Estado del Producto
> Última actualización: 2026-04-08

---

## Stack técnico

| Capa | Tecnología |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) |
| Lenguaje | TypeScript |
| Estilos | Tailwind CSS v4 |
| Base de datos | Supabase (PostgreSQL + Realtime + Auth) |
| AI | Anthropic Claude Haiku 4.5 (via SDK streaming) |
| Deploy | Vercel (auto-deploy desde main) |
| QR codes | qrcode.react |
| Validación | Zod v4 |
| Pagos | Stripe (PaymentIntents, webhooks) |

---

## Esquema de base de datos (Supabase)

### `restaurants`
```
id uuid PK
owner_id uuid FK auth.users
name text
slug text UNIQUE
address text
neighborhood text
cuisine_type text
price_range text ('$' | '$$' | '$$$')
active boolean
created_at timestamptz
```

### `tables`
```
id uuid PK
restaurant_id uuid FK restaurants
label text            -- "Mesa 1", "Mesa 2", etc.
seats int
status text           -- libre | ocupada | reservada | bloqueada
zone text             -- interior | terraza | barra
smoking boolean
min_pax int
max_pax int
qr_token text UNIQUE  -- "qr-mesa-01-a1b2c3d4" — usado en la URL del cliente
```

### `menu_items`
```
id uuid PK
restaurant_id uuid FK restaurants
name text
description text
price int (CLP)
category text
tags text[]           -- ['sin-gluten', 'vegano', 'promovido', ...]
available boolean
ingredients jsonb     -- [{ "stock_item_id": "uuid", "qty": 0.1 }, ...]
```
> **`promovido`** es la tag usada por el cross-selling. Al marcarla en Tono → Platos a destacar,
> Chapi incluye esos platos en una sección "PLATOS ESPECIALES HOY" de su system prompt.
> **`ingredients`** permite deducción automática de stock cuando la orden pasa a `preparing`.

### `orders`
```
id uuid PK
restaurant_id uuid FK restaurants
table_id uuid FK tables
status text   -- pending | confirmed | preparing | ready | paying | paid | cancelled
total int (CLP)
client_name text
notes text
created_at timestamptz
updated_at timestamptz
```

### `order_items`
```
id uuid PK
order_id uuid FK orders
menu_item_id uuid FK menu_items
name text              -- snapshot del nombre al momento del pedido
quantity int
unit_price int (CLP)   -- snapshot del precio
notes text
status text
```

### `waitlist`
```
id uuid PK
restaurant_id uuid FK restaurants
name text
phone text
party_size int
token text
status text   -- waiting | notified | seated | cancelled
position int
joined_at timestamptz
notified_at timestamptz
seated_at timestamptz
estimated_wait_min int
notes text
```

### `team_members` (roles del equipo)
```
id uuid PK
restaurant_id uuid FK restaurants
user_id uuid FK auth.users
role text    -- owner | admin | supervisor | garzon | waiter | super_admin
invited_by uuid FK auth.users
joined_at timestamptz
active boolean
```

### `stock_items`
```
id uuid PK
restaurant_id uuid FK restaurants
name text
unit text       -- kg | g | l | ml | unidad | porcion | caja
current_qty numeric
min_qty numeric
cost_per_unit int (CLP)
supplier text
category text
active boolean
updated_at timestamptz
```

### `waste_log`
```
id uuid PK
restaurant_id uuid FK restaurants
stock_item_id uuid FK stock_items
qty_lost numeric
reason text   -- vencimiento | deterioro | rotura | error_prep | sobras | otro
notes text
logged_by uuid FK auth.users
cost_lost int (CLP)   -- computed on insert by trigger
logged_at timestamptz
```

### `stock_movements`
```
id uuid PK
restaurant_id uuid FK restaurants
stock_item_id uuid FK stock_items
delta numeric        -- positive = add, negative = deduct
reason text          -- compra | ajuste_manual | orden | devolucion | merma
order_id uuid FK orders
logged_by uuid FK auth.users
logged_at timestamptz
```

### `payment_transactions`
```
id uuid PK
order_id uuid FK orders
stripe_payment_intent_id text UNIQUE
amount int (CLP)
currency text
status text   -- pending | succeeded | failed | refunded
split_index int
split_total int
created_at timestamptz
```

### `shifts`
```
id uuid PK
restaurant_id uuid FK restaurants
template_id uuid FK shift_templates
staff_id uuid FK team_members
shift_date date
start_time time
end_time time
tables_assigned uuid[]
status text   -- scheduled | open | closed | no_show
opened_at timestamptz
closed_at timestamptz
notes text
```

### `shift_templates`
```
id uuid PK
restaurant_id uuid FK restaurants
name text
day_of_week int   -- 0=Domingo
start_time time
end_time time
```

---

## Migraciones SQL

| Archivo | Contenido |
|---|---|
| `001_initial_schema.sql` | Schema inicial |
| `002_seed_data.sql` | Datos de prueba |
| `003_expanded_seed.sql` | Más datos |
| `004_restaurant_submissions.sql` | Waitlist restaurantes |
| `20260406_008_waitlist.sql` | Tabla waitlist |
| `20260406_009_auth_security.sql` | team_members, audit_log, user_preferences |
| `20260406_010_table_attributes.sql` | Atributos de mesa |
| `20260407_011_demo_seed.sql` | Seed restaurante demo |
| `20260407_012_tables_and_owner.sql` | Tabla tables + owner_id |
| `20260407_013_orders.sql` | orders + order_items + RLS básico |
| `20260408_014_rls_staff_roles.sql` | RLS staff-aware + garzon/super_admin + helpers SQL |
| `20260408_015_stock_and_waste.sql` | stock_items + waste_log + stock_movements + trigger |
| `20260408_016_payments.sql` | payment_transactions |
| `20260408_017_stock_rpc.sql` | RPC adjust_stock() atómica |
| `20260408_018_shifts.sql` | shifts + shift_templates |

---

## Rutas de la aplicación

### Público (discovery)
| Ruta | Descripción | Estado |
|---|---|---|
| `/` | Landing page HiChapi | ✅ Real |
| `/r/[slug]` | Perfil público del restaurante | ✅ Real |
| `/unete` | Waitlist restaurantes | ✅ Real |
| `/espera/[slug]` | Lista de espera pública (QR entrada) | ✅ Real |

### Cliente en mesa
| Ruta | Descripción | Estado datos |
|---|---|---|
| `/[slug]/[tableId]` | Experiencia de mesa completa | ✅ Supabase |

El `tableId` en la URL es el `qr_token` de la mesa (no UUID). Flujo:
1. Cliente escanea QR → abre `/demo-restaurante/qr-mesa-01-...`
2. Chapi carga el menú real del restaurante
3. Cliente pide → POST `/api/orders` crea la orden en DB
4. Carrito → confirmar → split (por igual o por plato) → pedir cuenta
5. Pedir cuenta → PATCH `/api/orders` → status `paying` → Realtime dispara alerta en garzón

### Panel restaurante (autenticado)
| Ruta | Datos | Estado | Rol mínimo |
|---|---|---|---|
| `/dashboard` | KPIs del día, pedidos activos, estado mesas | ❌ Mock hardcodeado | garzon |
| `/garzon` | Vista en tiempo real por mesa, avanzar estados | ✅ Supabase Realtime | garzon |
| `/comandas` | Kanban kitchen display (recibida→cocina→lista→entregada) | ✅ Supabase Realtime | garzon |
| `/mesas` | Grilla de mesas, alertas de pedidos/cuenta, waitlist | ✅ Supabase Realtime | garzon |
| `/carta` | Gestión del menú (CRUD items) | ⚠️ Parcial | admin |
| `/tono` | Personalidad de Chapi + cross-selling | ✅ Supabase (platos) | admin |
| `/restaurante` | Configuración del restaurante | ❌ Mock | admin |
| `/reporte` | Reporte del día | ❌ Mock | admin |
| `/analytics` | Métricas y tendencias | ❌ Mock | admin |
| `/insights` | Insights de Chapi | ❌ Mock | admin |
| `/stock` | Inventario + alertas bajo mínimo + ajustes | ✅ Supabase | admin |
| `/mermas` | Registro de pérdidas + resumen semanal | ✅ Supabase | admin |
| `/turnos` | Calendario semanal de garzones | ✅ Supabase | admin |

### API Routes
| Endpoint | Método | Auth | Descripción |
|---|---|---|---|
| `/api/orders` | POST | Service role | Crear orden desde mesa del cliente |
| `/api/orders` | PATCH | Service role | Actualizar estado (+ deducción stock en 'preparing') |
| `/api/tables` | POST | Service role | Crear nueva mesa (evita RLS anon) |
| `/api/menu-features` | GET/POST | Service role | Leer/actualizar platos destacados |
| `/api/chat/table` | POST | Anon | Streaming chat Chapi en mesa (SSE) |
| `/api/chat` | POST | Anon | Chat general Chapi discovery |
| `/api/waitlist/join` | POST | Anon | Unirse a la espera |
| `/api/waitlist/status` | GET | Anon | Estado de posición en espera |
| `/api/waitlist/notify` | POST | Service role | Notificar al cliente |
| `/api/search-ondemand` | POST | Anon | Búsqueda de restaurantes |
| `/api/stock` | GET/POST/PATCH/DELETE | Service role | CRUD inventario |
| `/api/stripe/create-payment-intent` | POST | Service role | Crear PaymentIntent(s) para una orden |
| `/api/stripe/webhook` | POST | Stripe sig | Webhook → actualizar status orden a paid |

---

## Seguridad — RLS

Todas las tablas con `restaurant_id` tienen RLS habilitado con las siguientes capas:

| Rol | Acceso |
|---|---|
| `anon` | Puede INSERT orders/order_items (QR scan), SELECT menu_items, SELECT tables (qr resolve), INSERT waitlist |
| `garzon` / `waiter` | Lee/escribe orders + tables de su restaurant_id (vía team_members) |
| `admin` / `supervisor` | Acceso completo a su restaurant_id |
| `owner` | Acceso completo + puede modificar restaurants y team_members |
| `super_admin` | Acceso global (solo Frank) |

Funciones SQL helper en uso: `my_restaurant_id()`, `is_super_admin()`, `my_role_for()`, `is_admin_for()`, `adjust_stock()`.

### Middleware (middleware.ts)
- Valida JWT con `supabase.auth.getUser()` en cada request
- Consulta `team_members` → obtiene `role` + `restaurant_id`
- Propaga `x-user-role`, `x-restaurant-id`, `x-user-id` como headers a Server Components
- Redirige `/garzon`/`/supervisor` a `/garzon` si intentan acceder a rutas admin-only
- Redirige no-autenticados a `/login?redirect=...`

---

## Flujo de datos principal (cliente → cocina)

```
Cliente escanea QR
       ↓
/[slug]/qr-mesa-01-xxx
       ↓
GET /api/chat/table  ←→  Claude Haiku (streaming SSE)
       ↓                 [system prompt: menú real + carrito actual + platos destacados]
Usuario confirma pedido
       ↓
POST /api/orders  →  Supabase orders + order_items
       ↓
Supabase Realtime  →  Panel Garzón  (alerta "Nuevo pedido")
                   →  Panel Comandas (columna "Recibida")
                   →  Panel Mesas   (badge azul en tarjeta)
       ↓
Garzón avanza a 'preparing'
       ↓
PATCH /api/orders { status: 'preparing' }
  → Deducción automática de stock (si menu_items.ingredients configurado)
  → stock_movements registra el consumo
       ↓
Cliente toca "Pedir cuenta"
       ↓
PATCH /api/orders { status: 'paying' }
       ↓
Supabase Realtime  →  Panel Garzón  (alerta ámbar + badge Banknote)
                   →  Panel Mesas   (badge ámbar en tarjeta)
       ↓ (opcional si Stripe habilitado)
POST /api/stripe/create-payment-intent
       ↓
Stripe webhook → /api/stripe/webhook
  → payment_transactions registra el pago
  → orders.status = 'paid' cuando todos los splits completan
```

---

## Mapeo de estados de orden

| DB status | Garzón | Comandas | Mesas |
|---|---|---|---|
| `pending` | "Nuevo pedido" (azul) | "Recibida" | badge Bell azul |
| `confirmed` | "Confirmado" | "Recibida" | badge Bell azul |
| `preparing` | "En cocina" | "En cocina" | — |
| `ready` | "¡Listo!" | "Lista" | — |
| `paying` | "Cobrando" (ámbar, alerta) | "Entregada" | badge Banknote ámbar |
| `paid` | oculto | oculto | — |
| `cancelled` | oculto | oculto | — |

---

## Escalabilidad — evaluación honesta

### ✅ Lo que escala bien
- **Supabase Realtime**: canales por tabla, no por fila → escala horizontal sin cambios
- **Next.js App Router + Vercel**: serverless por defecto, auto-scaling
- **Claude Haiku streaming**: SSE stateless, cada request es independiente
- **Multi-tenant ready**: todas las tablas tienen `restaurant_id`; RLS aplica per-tenant automáticamente
- **qr_token en URL**: desacopla el UUID interno del token público; se puede rotar sin romper links
- **RLS staff-aware**: policies usan `my_restaurant_id()` SECURITY DEFINER → una sola función cacheable

### ⚠️ Deuda técnica actual
- **Dashboard, Reporte, Analytics, Insights**: todos mock hardcodeados → no muestran datos reales
- **Tono de Chapi**: el preset/frases/idioma se guardan en estado local solamente; no persisten en DB
- **`seatedAt` y `pax` en mesas**: no se guardan en DB; se pierden al recargar
- **NPS / satisfacción**: KPI en dashboard es mock; no hay sistema de feedback real
- **Waitlist**: funciona en DB pero las acciones del panel de mesas (notificar, sentar) son mock local
- **Stock + ingredients**: el campo `ingredients` en menu_items requiere configuración manual por plato
- **Stripe**: integrado pero requiere configurar claves en .env.local y registrar webhook en Stripe Dashboard

### 🚨 Bloqueantes para producción real (multi-restaurante)
1. **Dashboard real**: conectar a Supabase para KPIs reales del día
2. **Tono persistido**: guardar config de Chapi en DB (tabla `restaurant_settings`)
3. **Variables de entorno Stripe**: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
4. **`NEXT_PUBLIC_DEMO_RESTAURANT_ID`**: reemplazar por lectura dinámica del restaurant_id del usuario autenticado

---

## Features construidas (producción)

| Feature | Descripción |
|---|---|
| QR por mesa | Genera QR, descarga PNG, copia link |
| Chapi en mesa | Chat AI streaming, agrega items al carrito |
| Carrito completo | Agregar/quitar, vaciar, confirmar pedido |
| Split de cuenta | Por igual (N personas) o por plato (A/B) |
| Pedir la cuenta | Señal al garzón vía PATCH + Realtime |
| Panel Garzón | Vista tiempo real, avanzar estados, CLP format |
| Panel Comandas | Kanban kitchen, roles (cocina/garzón/admin), stock/breaks |
| Panel Mesas | Alertas tiempo real, agregar mesas, QR auto-generado |
| Cross-selling | Selector de platos a destacar → Chapi los menciona |
| Tono de Chapi | Personalidad, frases, idioma (local solamente) |
| Lista de espera | QR entrada, posición en cola, ETA |
| RLS staff-aware | Policies por rol (garzon/admin/super_admin) con helpers SQL |
| Auth middleware | JWT + role routing + headers downstream |
| Panel Stock | CRUD inventario, alertas bajo mínimo, ajuste manual |
| Panel Mermas | Registro de pérdidas, resumen semanal, costo estimado |
| Panel Turnos | Calendario semanal, asignación garzones, estados open/closed |
| Stripe pagos | PaymentIntents por mesa, split payments, webhook→paid |
| Deducción stock | Automática al pasar orden a 'preparing' (si ingredients config) |
| Seed onboarding | `scripts/seed-restaurant.ts` provisiona mesas + menú + admin |

## Features pendientes (backlog)

| Feature | Impacto | Complejidad |
|---|---|---|
| Dashboard con datos reales | Alto | Media |
| Reporte del día real | Alto | Media |
| Tono de Chapi persistido en DB | Medio | Baja |
| `seatedAt` / `pax` desde órdenes | Medio | Baja |
| Analytics reales (ventas, NPS) | Alto | Alta |
| WhatsApp integration (waitlist) | Alto | Alta |
| Tabla `restaurant_settings` | Medio | Baja |
| Configurar Stripe en Vercel | Alto | Baja |
| Facturación electrónica (SII) | Medio | Alta |
| Multi-restaurante onboarding UI | Alto | Alta |
| Configurar `ingredients` por plato en /carta | Medio | Media |

---

## Estructura de carpetas clave

```
app/
├── (auth)/          — login, register, recuperar, update-password
├── (restaurant)/    — todos los paneles del restaurante (layout con sidebar)
│   ├── dashboard/
│   ├── garzon/      ✅ Supabase Realtime
│   ├── comandas/    ✅ Supabase Realtime
│   ├── mesas/       ✅ Supabase Realtime
│   ├── carta/
│   ├── tono/        ✅ platos desde Supabase
│   ├── stock/       ✅ CRUD inventario
│   ├── mermas/      ✅ registro pérdidas
│   ├── turnos/      ✅ calendario turnos
│   ├── analytics/
│   ├── reporte/
│   ├── insights/
│   └── restaurante/
├── (table)/
│   └── [slug]/[tableId]/  ✅ experiencia completa del cliente
├── api/
│   ├── orders/      ✅ POST + PATCH (service role, + stock deduction)
│   ├── tables/      ✅ POST (service role)
│   ├── menu-features/ ✅ GET + POST (service role)
│   ├── stock/       ✅ GET + POST + PATCH + DELETE (service role)
│   ├── stripe/
│   │   ├── create-payment-intent/  ✅ POST
│   │   └── webhook/               ✅ POST (Stripe signature)
│   ├── chat/table/  ✅ SSE streaming Chapi
│   └── waitlist/    ✅ join + status + notify
├── r/[slug]/        — perfil público restaurante
├── espera/[slug]/   — waitlist pública
└── page.tsx         — landing HiChapi discovery

lib/
├── supabase/
│   ├── client.ts    — createBrowserClient (singleton @supabase/ssr)
│   └── server.ts    — createAdminClient (service role, server only)
└── waitlist/
    ├── types.ts
    └── eta.ts

scripts/
└── seed-restaurant.ts  — onboarding: mesas + menú + admin user

supabase/migrations/
├── ... (001–013 anteriores)
├── 20260408_014_rls_staff_roles.sql
├── 20260408_015_stock_and_waste.sql
├── 20260408_016_payments.sql
├── 20260408_017_stock_rpc.sql
└── 20260408_018_shifts.sql

middleware.ts    — JWT auth + role routing + restaurant_id headers
```
