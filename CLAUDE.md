# HiChapi — guía para Claude

SaaS de gestión integral para restaurantes en Chile + plataforma de discovery
para diners. Backend único, **dos clientes** (web Next.js + app mobile React
Native), tres audiencias finales (diner, dueño/staff, cliente en mesa).

## Stack

| Capa | Tech |
|---|---|
| Web frontend | Next.js 16 (App Router) + React 19 + Tailwind CSS 4 |
| Mobile | React Native + Expo (en `hichapi-mobile-app/`) |
| Backend API | Next.js API routes (`app/api/`) — compartido entre web y mobile |
| DB | Supabase Postgres + PostGIS + pgvector · RLS en TODAS las tablas |
| Auth | Supabase Auth · roles: `cliente / garzon / cocina / supervisor / admin / super_admin` |
| AI | Anthropic Haiku 4.5 (streaming, chat) · Sonnet 4.6 (análisis/batch) |
| Pagos | Stripe · Email: Resend · Mapas: Mapbox |
| DTE | Integración SII Chile (facturas/boletas/notas crédito y débito) |
| Tests | Vitest + fast-check (web) · Jest (mobile, su propia config) |

## Repo layout

```
app/(public)         Landing + buscar (discovery para diners)
app/(auth)           Login / register / recuperar
app/(restaurant)     Panel del restaurante (garzón, comandas, mesas, caja, stock, carta, dte, delivery, fidelizacion, etc.)
app/(table)/[slug]/[tableId]  Chapi at Table — cliente escanea QR y pide
app/admin            Founder dashboard + submissions + candidates
app/api              Endpoints — consumidos por web Y mobile
components/          Componentes React (admin, chat, restaurant, bills, dte, etc.)
lib/                 Lógica reutilizable (supabase, claude, dte, chat/sanitize, etc.)
supabase/migrations/ ~90 archivos SQL timestamped — aplicarlos a mano en SQL Editor
hichapi-mobile-app/  Proyecto Expo independiente (su propio package.json y tests)
docs/                ROADMAP, manual-deploys, archivos históricos
__tests__/           Tests vitest del backend web
```

## Convenciones

- **TS strict**, camelCase variables / PascalCase componentes / snake_case DB.
- Comentarios de **negocio** en español, código en inglés.
- Zod en TODAS las API routes que reciben body.
- `AppError` para errores domain.
- Auth server-side: `supabase.auth.getUser()` — **nunca** autorización solo en frontend.
- Precios en **CLP enteros** (sin centavos). Format con punto de miles: `$18.500`.
- RLS por rol en cada tabla. Migration 062 + audit trigger para campos sensibles.
- Migrations son **manuales**: Vercel no toca DB. Pegar SQL en Supabase SQL Editor.
- Migrations idempotentes (`IF NOT EXISTS`, `DO $$ ... IF NOT EXISTS ... $$` para constraints).

## Deploy

| Cliente | Cómo deploya | Tiempo |
|---|---|---|
| Web | `git push origin main` → Vercel auto-build | 1-3 min |
| Mobile | `eas build` + submit a App Store / Google Play | Horas–días (review) |
| DB | Pegar SQL en Supabase SQL Editor a mano | Instantáneo |

**Regla**: cambios al backend deben ser **backward-compatible** porque mobile no se
actualiza al toque (versiones viejas siguen llamando APIs por días/semanas).

## Modelos IA

- **Haiku 4.5** (`claude-haiku-4-5-20251001`): chat usuario, chat de mesa, sugerencia
  respuesta soporte. Streaming, low-latency.
- **Sonnet 4.6**: normalización de cartas (extracción menú), reportes nocturnos,
  enriquecimiento de restaurants (Google Places + sintetizar info).
- Prompts repetidos usan `cache_control: ephemeral`.
- Chat siempre `stream: true`.

## Estado de features (a 2026-05-19)

| Dominio | Estado | Notas |
|---|---|---|
| **Discovery** (`/buscar`) | ✅ Estable + refactor reciente (mayo) | Contrato fidedigno, opt-in alternativas, normalización género, dish-only items, mapa multi-pin, dietary AND no OR, multi-zona, info Google en ficha, ~3000 casos QA |
| **Restaurant ops** (garzón, comandas, mesas, caja) | ✅ Completo | Mobile responsive, bottom nav, modo simplificado por rol |
| **Chat de mesa** (`(table)/[slug]/[tableId]`) | ✅ + 3 capas defensivas | Sanitización de precios inventados + JSON recovery + plain-text fallback. Ver `lib/chat/sanitize.ts` |
| **Carta + extract IA** (`/carta`) | ✅ | PDF importable via Claude vision tool, ingredientes con gramaje |
| **Stock v1** (`/stock`) | ✅ | Foto import, FIFO simple con `lot_number`, alertas vencimiento |
| **Stock v2** (FIFO real, transfers) | ⏳ Sprints 2 y 3 pendientes (ROADMAP) | Tabla `stock_batches` no creada |
| **DTE Chile** | ✅ Robusto | Boletas + facturas + notas crédito/débito + exenta. Certificación SII, FAU rejection fix |
| **Delivery con riders propios** | ✅ Robusto + flow rider (mayo) | `app/(restaurant)/delivery/*` + 12 endpoints `app/api/delivery/*` (orders, riders, marketplace, heatmap, analytics, route engine, ratings, tiers). Onboarding + verificación documental del rider (migration 065). Heatmap fix (migration 064) |
| **Admin de riders** (`/admin/riders`) | 🆕 May 19 | Panel propio + tab "riders" en founder dashboard. Endpoint `/api/admin/riders` |
| **Pedido público sin auth** | 🆕 May 19 | `/r/[slug]` refactor con `CartPanel` + `PublicMenu` + endpoint `/api/public/order` (cliente escanea, pide, paga, sin crear cuenta) |
| **Delivery integrations** (Rappi/PedidosYa) | ✅ | Aparte del rider propio |
| **Loyalty + cupones** | ✅ En uso | `customer_loyalty`, `loyalty_coupons`, `/mi-wallet` |
| **Founder dashboard** (`/admin/dashboard`) | ✅ + tab riders | 5 tabs: restaurantes / reviews / tickets / analytics / riders. Funnel, restaurantes en riesgo, upgrades de plan (migration 062), nuevos restaurantes/día, tickets con suggest-reply y banner >24h |
| **Tickets / Soporte** | ✅ Con Chapi suggest-reply | Endpoint `/api/admin/support/tickets/[id]/suggest-reply` clasifica resolvable_now / needs_code_change / needs_call |
| **App mobile** (React Native) | 🆕 Mayo (sigue creciendo) | Garzón, comandas, cliente, admin + ahora rider onboarding/verification/active-order. Tests Jest + property-based. OfflineQueue para wifi malo. **Estado en stores: verificar con Jorge** |
| **user_preferences** (diners) | ⚠️ Huérfano | Tabla existe (migration 009) con todo el schema (dietary, favorite_cuisines, search_history, etc.) pero ningún código TS la usa |

## Migrations pendientes de aplicar a mano

Estas migrations existen en `supabase/migrations/` pero hay que pegarlas a mano en Supabase SQL Editor para que apliquen en prod (Vercel no toca DB):

- `20260519_064_fix_heatmap_unique_orders.sql` — fix heatmap delivery
- `20260519_065_add_rider_verification_docs.sql` — documentos verificación rider
- (Pre-existentes) `20260426_add_subtotal_to_orders.sql`, `20260427_062_restaurant_audit.sql` — confirmar estado en prod

## Gotchas críticos

1. **`lib/chat/sanitize.ts` es defensa OBLIGATORIA.** Haiku inventa totales mal
   calculados aunque el prompt lo prohíba (ej: `$18.500 + $5.900 = $29.400` real
   en prod). Sanitiza oraciones con `$X` que no estén en menú. **No remover.**

2. **`.claude/settings.local.json` está gitignored** porque historial pasado tuvo
   `service_role` JWT hardcoded en allowlist. Si lo ven faltar, es a propósito.

3. **Numeración de migrations duplicada** (`019`, `020`, `021`, `056` aparecen 2-3
   veces con timestamps distintos). Ordena por filename completo, no por número.
   Algunas migrations viejas fueron **modificadas in-place** (ej: Jorge tocó
   `20260416_006_factura_electronica.sql`) — si Supabase trackea por filename,
   esos cambios podrían no aplicarse. Verificar con `\d` en SQL Editor.

4. **Mobile y web comparten APIs** en `app/api/`. Cualquier breaking change rompe
   mobile hasta que usuarios actualicen. Pensar APIs como contratos versionados.

5. **`lib/supabase/auth-guard.ts` soporta dual auth**: cookie (web) + bearer
   token (mobile). Cambios acá rompen los dos clientes si fallan.

6. **Commits "fix conflict" o mensajes vagos** (ej: `1c0de40 agrega app hichipi`
   = 32k líneas) son comunes. `git log -p` para entender qué pasó realmente.

## Tests

```bash
# Backend web (vitest)
npx vitest run                          # todo
npx vitest run lib/chat/sanitize.test.ts # archivo específico

# Mobile (Jest, OTRO framework)
cd hichapi-mobile-app && npm test

# Typecheck (estricto)
npx tsc --noEmit
```

Hay tests preexistentes con TS errors (`__tests__/`, `lib/dte/*.test.ts`) que no
son de cambios recientes — filtrar con `grep -v "\.test\."` al revisar errores
de producción.

## Antes de pushear a main

1. `npx tsc --noEmit` clean en `app/components/lib` (no en tests).
2. `npx vitest run` — si rompe algo nuevo, parar.
3. Si tocaste API consumida por mobile, verificar backward compat.
4. Si tocaste system prompt de chat, hacer QA real (no solo typecheck — los bugs
   de LLM se ven en runtime, no en compilación).
5. Si agregaste migration, anotarlo: hay que pegarla a mano en Supabase prod.

## Referencias

- `docs/ROADMAP.md` — sprints 1-5 (algunos cerrados, otros pendientes)
- `docs/manual-deploys/` — bundles SQL históricos
- `README.md` — testing + CI/CD setup
- `hichapi-mobile-app/README.md` — setup específico de mobile
- `hichapi-dev-kit/CLAUDE.md` — config vieja (obsoleta, no auto-cargada)
