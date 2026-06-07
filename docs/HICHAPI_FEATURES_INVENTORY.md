# HiChapi — Inventario completo de funcionalidades construidas

> Documento maestro de **qué hay construido y funcionando** en HiChapi. Para nutrir agentes de contenido, dar contexto a colaboradores nuevos, o auditar el alcance del producto.
>
> Última actualización: **2026-05-27** (post commit `5ecaca9` "mejoras app")
> Branch productiva: `main` · Producción: https://hichapi.com · Repo: https://github.com/fsanmartinlizana-rgb/hichapi

---

## Resumen ejecutivo

HiChapi es un SaaS completo de gestión gastronómica + plataforma de discovery + marketplace de delivery para Chile. Hoy tiene **15 dominios funcionales mayores** en producción, **2 clientes** (web + app mobile nativa), y **96 migrations** de base de datos. El backend sirve simultáneamente a:

- **Diners anónimos** que descubren restaurantes
- **Diners registrados** ("comensales") con perfil + dirección + historial + favoritos
- **Clientes en mesa** que escanean QR y piden con Chapi sin crear cuenta
- **Garzones y cocineros** que operan el local
- **Dueños y supervisores** que gestionan el negocio
- **Riders propios** del marketplace de delivery
- **Founder y super admin** que monitorean todo

---

## Audiencias → cómo entran al producto

| Audiencia | Entry point | Necesita cuenta |
|---|---|---|
| **Visitante general** | https://hichapi.com | No |
| **Diner buscando dónde comer** | https://hichapi.com/buscar | No (pero se enriquece si está logueado) |
| **Diner registrado (comensal)** | https://hichapi.com/login → `/(cuenta)` | Sí |
| **Cliente en mesa** | Escanea QR → `/[slug]/[tableId]` | No |
| **Cliente pedido público** | `/r/[slug]` (carta + carrito + pagar) | No |
| **Cliente tracking delivery** | `/r/[slug]/track/[id]` | No (token en URL) |
| **Dueño prospecto** | `/unete` o `/registro` | Sí (crea owner + restaurant) |
| **Dueño con restaurant OSM** | `/reclamar/[slug]` | Sí (claim flow) |
| **Owner / staff** | `/login` → `/dashboard` | Sí (con role) |
| **Founder** | `/admin/dashboard` | Sí (con `ADMIN_SECRET`) |
| **Rider** | App mobile → onboarding → verificación | Sí (rider role) |

---

## 1. Discovery — encontrar restaurantes con chat natural

**Estado:** ✅ Estable, con refactor de mayo 2026 (~3000 casos de QA cubiertos).

**Qué hace:** El diner abre `/buscar` y escribe en lenguaje natural lo que quiere ("ramen sin gluten en Ñuñoa por 20 lucas", "algo italiano cerca de Las Condes"). Chapi (Haiku 4.5 streaming) extrae intent (zona, cocina, presupuesto, restricciones dietarias), busca restaurantes que matcheen, y devuelve 3 opciones con plato sugerido + foto + ubicación.

**Highlights del refactor reciente:**
- **Contrato fidedigno**: si dice "Rancagua" (ciudad no activa), rechaza honestamente en vez de falsificar resultados de Santiago.
- **Opt-in alternativas**: el modelo pregunta antes de relajar la búsqueda.
- **Dietary AND no OR**: "vegano sin gluten" filtra ambos, no muestra ítems que solo cumplen uno.
- **Dish-only items**: si pides "pizza" en un restaurant italiano que también tiene pasta, el sugerido es pizza, no el plato más caro.
- **Mapa multi-pin con Mapbox**: ver los 3 resultados ubicados.
- **Multi-zona**: "Providencia o Lastarria" funciona.
- **Info de Google Places en ficha** (`/r/[slug]`): horarios reales, fotos, rating, link a Google Maps.
- **Fallback honesto en `match_reason`**: si tuvo que relajar la zona, lo dice.

**Stack:**
- Frontend: `app/buscar/page.tsx`, `components/discovery/*` (ResultCard, ResultsGrid, ResultsMap, OutOfScopeBanner, FallbackHint, CuisinePlaceholder)
- API: `app/api/chat/route.ts` (Haiku streaming), `app/api/search/route.ts`, `app/api/search-ondemand/route.ts` (OSM fallback), `app/api/enrich-zone/route.ts`
- Lib: `lib/discovery.ts`, `lib/landmarks.ts`, `lib/placeholders.ts`, `lib/cache.ts`
- DB: `restaurants` + `menu_items` con PostGIS para queries geoespaciales

---

## 2. Panel de operación del restaurante (28 secciones)

**Estado:** ✅ Completo. Mobile responsive con bottom nav y modo simplificado por rol.

**Cómo accede:** Owner/staff hace login en `/login` y entra a `/dashboard`. Sidebar muestra las secciones según el plan y rol.

| Sección | URL | Qué hace | Rol mínimo |
|---|---|---|---|
| **Dashboard** | `/dashboard` | KPIs del local: pedidos hoy, revenue, comandas activas, alertas | garzon |
| **Garzón** | `/garzon` | Vista operativa para meseros: mesas + comandas en vivo + estado | garzon |
| **Comandas** | `/comandas` | KDS de cocina: comandas por estación, mark ready, tiempos | cocina |
| **Mesas** | `/mesas` | Plano del salón, drag & drop, asignación de garzones, estado en vivo | supervisor |
| **Caja** | `/caja` | Apertura/cierre de turno, cierre de caja con cuadre, métodos de pago | supervisor |
| **Carta** | `/carta` | Editor visual de menú, categorías, fotos, tags, ingredientes con gramaje, **import IA desde PDF/foto** | admin |
| **Stock** | `/stock` | Inventario con lot_number + FIFO simple, alertas de vencimiento, **import por foto IA** | admin |
| **Mermas** | `/mermas` | Log de pérdidas con razón, fotos, costo recuperable | admin |
| **DTE** | `/dte` | Facturas, boletas, notas crédito/débito, exenta, emisión SII, PDF | admin |
| **Delivery** | `/delivery` | Pedidos delivery + asignación de riders + heatmap + analytics + calificaciones | admin |
| **Fidelización** | `/fidelizacion` | Programas de loyalty, stamps cards, tiers, multiplicadores, reward catalog | admin |
| **Reservas** | `/reservas` | Calendar de reservas, mesas asignadas, comunicación email | supervisor |
| **Clientes** | `/clientes` | Lista de comensales que han pedido en el local | supervisor |
| **Promociones** | `/promociones` | Happy hour, 2x1, combo, descuento por canal (mesa/espera/chapi) | admin |
| **Equipo** | `/equipo` | Staff, roles, invitaciones por email, permisos custom | admin |
| **Turnos** | `/turnos` | Shifts templates + shifts asignados | admin |
| **Impresoras** | `/impresoras` | Configurar impresoras térmicas por estación | admin |
| **Integraciones** | `/integraciones` | Rappi, PedidosYa, otros marketplaces | admin |
| **Analytics** | `/analytics` | Reportes operacionales agregados | admin |
| **Insights** | `/insights` | IA-generated insights (tendencias, recomendaciones) | admin |
| **Reporte** | `/reporte` | Reporte nocturno generado por Sonnet 4.6 | admin |
| **Configuración** | `/configuracion` | Settings del restaurant + **`/configuracion/comensales`** (config del programa de comensales del local) | admin |
| **Tono** | `/tono` | Personalidad de Chapi en chat de mesa (formal/cercano/chileno) | admin |
| **Módulos** | `/modulos` | Activar/desactivar features según plan + estado del trial | admin |
| **Restaurante** | `/restaurante` | Configuración pública (slug, fotos, descripción, horarios) | admin |
| **Agregar sucursal** | `/agregar-sucursal` | Multi-local Enterprise | super_admin del holding |
| **Plataforma → Tickets** | `/plataforma/tickets` | Crear tickets de soporte a HiChapi | admin |

**Patrones:**
- **Mobile responsive** con `<MobileBottomNav>` que muestra las 5 secciones más usadas según rol.
- **Modo simplificado**: garzón/cocina/anfitrión en mobile no ven Configuración/Equipo/Plan.
- **Restaurant context** en `lib/restaurant-context.tsx` provee restaurant + role + permissions a todos los componentes.

---

## 3. Cuenta de Comensal (diner registrado) — **NUEVO**

**Estado:** ✅ Construido en commits `6f0e7a7` (mayo 2026). En producción.

**Qué hace:** Un diner puede crearse cuenta, guardar direcciones, dejar ratings de pedidos delivery, acumular puntos de loyalty cross-restaurant, ver su historial de pedidos, y tracking en vivo de deliveries activos.

**Páginas (`app/(cuenta)/*`):**
| Página | URL | Qué hace |
|---|---|---|
| Home | `/cuenta` | Resumen del perfil + accesos directos |
| Perfil | `/cuenta/perfil` | Editar nombre, email, teléfono, foto |
| Pedidos | `/cuenta/pedidos` | Lista de todos los pedidos pasados (delivery + mesa) |
| Pedido detalle | `/cuenta/pedidos/[id]` | Detalle de un pedido + reordenar |
| Fidelidad | `/cuenta/fidelidad` | Puntos acumulados, tiers, cupones disponibles |
| Configuración | `/cuenta/configuracion` | Direcciones guardadas, métodos de pago, notificaciones push |
| Tracking delivery | `/cuenta/tracking/[delivery_order_id]` | Mapa en vivo del rider + ETA |

**API (`app/api/customer/*`):**
- `account/route.ts` — datos básicos
- `addresses/route.ts` + `[id]` — CRUD de direcciones
- `geofence/check/route.ts` — verifica si una dirección está en zona de cobertura
- `loyalty/route.ts` + `redeem` — puntos + canje
- `orders/route.ts` + `[id]` — historial
- `profile/route.ts` — perfil
- `push-token/route.ts` — registrar token de Expo para push
- `ratings/route.ts` — dejar rating de un pedido o restaurant
- `tracking/[delivery_order_id]/route.ts` — tracking en vivo

**Restaurant-side (`app/api/restaurant/customers/*`):**
- `route.ts` — lista de comensales del restaurant
- `active-by-table/route.ts` — qué comensales tienen pedido activo en cada mesa
- `config/route.ts` — config del programa
- `ratings/route.ts` — ratings recibidos

**Lib (`lib/customer/*`):** customer-service, geofence-service, loyalty-service, order-history-service, rating-service, restaurant-customers, tracking-service + schemas + types.

**DB:**
- Migration `20260410_020_usuario_comensal.sql` (394 líneas)
- Seed `supabase/seeds/usuario_comensal_demo.sql`
- Edge function: `supabase/functions/purge-geofence-events/index.ts` (cron)

**Mobile:**
- Pantallas `hichapi-mobile-app/screens/customer/`: CustomerSearch, CustomerRestaurantMenu, CustomerTrackingHub, CustomerTracking, CustomerRatingForm
- Component: `CustomerChatBox.tsx`
- Services: `services/customer/api.ts`, `geofence.ts`, `roleResolver.ts`

**Tests:** ~5 archivos de property-based tests con fast-check para customer/geofence/loyalty/rating/tracking services.

---

## 4. Chapi en mesa (cliente con QR) — chat IA con guardrails

**Estado:** ✅ + **3 capas defensivas** (mi fix + refuerzo de Jorge).

**Qué hace:** Cliente escanea QR de la mesa → entra a `/[slug]/[tableId]` → chat con Chapi (Haiku 4.5 streaming). Pide en lenguaje natural, ve carta, agrega al carrito, divide cuenta, paga, todo sin crear cuenta.

**Guardrails defensivos (críticos, no remover):**
1. **`sanitizeMessagePrices`** ([lib/chat/sanitize.ts](lib/chat/sanitize.ts)): strippea cualquier oración con `$X` que no esté en el menú. Defensa contra el LLM inventando totales mal calculados.
2. **`recoverMessageFromRawText`**: si `JSON.parse` falla (max_tokens cortado, JSON malformado), extrae el campo `message` del raw y degrada a `action: chat`. Antes era "Ups, no entendí bien".
3. **Plain-text fallback** (commit de Jorge): si Claude ignora el JSON y devuelve texto plano, lo trata como `message` y sigue funcionando.

**Reglas del prompt (16 reglas):**
- `1. AGREGAR vs RECOMENDAR`: agrega solo cuando es pedido explícito
- `3. CANTIDAD por defecto`: postre = 1, principal individual = N personas, bebida = N personas
- `13. PRECIOS INDIVIDUALES`: nunca escribir totales, el sistema los calcula
- `14. NUNCA inventar precios o platos`
- `15. PRESUPUESTO INVIOLABLE`: validar mentalmente cart + items_to_add ≤ budget
- `16. CARRITO SOBRE PRESUPUESTO`: si user dice "muy caro", action chat y sugerir item específico a quitar

**Stack:** `app/api/chat/table/route.ts` + `lib/chat/sanitize.ts` (con 28 unit tests) + `app/(table)/[slug]/[tableId]/page.tsx`.

---

## 5. App mobile nativa (React Native + Expo)

**Estado:** ✅ Crece commit a commit. Estado en stores: verificar con Jorge.

**Estructura (`hichapi-mobile-app/`):**
- **Roles soportados:** admin, garzón, cocina, cliente, rider, customer
- **OfflineQueue**: pedidos NO se pierden si el wifi cae — se sincronizan después
- **Tests:** Jest + property-based con fast-check (no es vitest)
- **CI propia:** `.github/workflows/ci.yml`
- **EAS Build** para iOS/Android

**Pantallas principales por rol:**

| Rol | Pantallas |
|---|---|
| **Auth** | Login, Register, PasswordRecovery |
| **Onboarding** | OnboardingScreen |
| **Cliente en mesa** | QRScanner, ClientMenu, ClientChat, Cart, SplitPayment |
| **Customer (diner registrado)** | CustomerSearch, CustomerRestaurantMenu, CustomerTrackingHub, CustomerTracking, CustomerChatBox |
| **Garzón** | Garzón (984 líneas, la más grande), OrderDetail |
| **Comandas/Cocina** | Comandas (KDS móvil) |
| **Mesas** | Mesas, TableDetail, QRGenerator |
| **Admin** | MenuManagement, ShiftManagement, StockManagement, WasteLog |
| **Rider** | Onboarding, Verification, ActiveOrder (mayo 2026) |
| **Perfil** | ProfileScreen |

**Servicios internos:** APIClient, AuthService, CartService, ChapiService (SSE streaming), NotificationService (push), OrderService, BillSplitService, OrderValidator, TicketService (impresión térmica), RealtimeService (Supabase realtime), StockService, OfflineQueue.

**Backend compartido:** mismos endpoints `app/api/*` que el web. **Regla:** APIs son contratos versionados — cambios deben ser backward-compatible porque mobile no se actualiza al toque (Apple/Google review = 24-72h).

---

## 6. Founder Dashboard (`/admin/dashboard`) — 5 tabs

**Estado:** ✅ Sprint 4 cerrado + tabs nuevos.

**Tabs:**
1. **Restaurantes** — top performers con orders + revenue + comisión
2. **Reviews** — feedback de clientes con sentimiento (positive/negative/neutral)
3. **Tickets** — bandeja de soporte con sugerencia automática de respuesta por Chapi (clasifica `resolvable_now` / `needs_code_change` / `needs_call`) y banner de tickets críticos sin respuesta >24h
4. **Analytics** — métricas agregadas
5. **Riders** — gestión del marketplace de riders

**Secciones siempre visibles:**
- **Funnel de activación** con drop-off por etapa (registered → with_menu → with_qr → first_order_paid)
- **Nuevos restaurantes por día** (area chart SVG inline)
- **Upgrades de plan por semana** (bar chart con audit log via migration 062)
- **Restaurantes en riesgo** con 5 flags (no_orders_3d, no_orders_7d, incomplete_menu, no_qr, inactive) + score de urgencia 0-100 con bonus por tier

**Auth:** header `x-admin-secret` con `ADMIN_SECRET` >= 20 chars (dual con cookie super_admin para `/plataforma/*`).

**Endpoints:** `/api/admin/dashboard`, `/api/admin/funnel`, `/api/admin/risks`, `/api/admin/upgrades`, `/api/admin/registrations-by-day`, `/api/admin/support/tickets`, `/api/admin/support/tickets/[id]/context`, `/api/admin/support/tickets/[id]/suggest-reply`, `/api/admin/riders`.

---

## 7. DTE Chile (Documentos Tributarios Electrónicos)

**Estado:** ✅ Robusto. Certificación SII pasada.

**Documentos soportados:**
- Boleta electrónica
- Factura electrónica
- Nota de crédito
- Nota de débito
- Boleta exenta de IVA

**Características:**
- Integración **directa con SII Chile** (no terceros tipo Bsale/Maximiliano)
- Manejo de CAFs (Códigos de Autorización de Folios)
- Firma digital con xml-crypto + node-forge
- Generación de PDF de boleta/factura con @react-pdf/renderer
- Envío de boleta por email con Resend (Sprint mayo 2026)
- **FAU rejection fix** (commit `5e729c8`) — separó `fecha_emision` de `emitted_at` (UTC vs local date) para evitar rechazos del SII por timezone
- Tax exempt items (boleta exenta) — migration `APPLY_MIGRATION_TAX_EXEMPT.sql`

**Stack:** `lib/dte/*` (engine, signer, sii-client, certification-engine, caf, folio, pdf-generator, pdf-renderer) + `app/api/dte/*` (emit, status, aec, emissions) + `app/(restaurant)/dte/page.tsx`.

---

## 8. Delivery con riders propios + integraciones

**Estado:** ✅ Robusto. Flow completo de rider lanzado mayo 2026.

**Marketplace de riders propios:**
- **Onboarding** del rider desde la app mobile (datos personales + foto)
- **Verificación documental** (migration `20260519_065`): cédula, licencia, foto del vehículo, validados por founder en `/admin/riders`
- **Asignación de pedidos**: el restaurante elige rider o se asigna por proximidad (PostGIS)
- **Tracking en vivo**: posición del rider + ETA al cliente
- **Push notifications**: rider recibe alerta de pedido nuevo (migration `20260520_066`)
- **Heatmap** de demanda por zona y hora
- **Analytics**: pedidos entregados, tiempo promedio, calificación, propinas
- **Route engine**: optimiza orden de entregas para rider con múltiples pedidos
- **Tiers de rider** (gold/silver/bronze por desempeño)
- **Ratings** bidireccionales (cliente ↔ rider)
- **Geofencing**: eventos cuando el rider entra/sale de zonas (migration `054` + edge function `purge-geofence-events`)

**Integraciones de marketplace:**
- Rappi, PedidosYa (no es nuestro rider, pero los pedidos entran al sistema)

**Stack:** `lib/delivery/*` (push-notifications, etc.), `app/api/delivery/*` (12+ endpoints), `app/(restaurant)/delivery/*` (pedidos, calificaciones, marketplace, heatmap, analytics, route engine, tiers), `app/admin/riders/*`.

---

## 9. Sistema de pagos Flow.cl + suscripciones — **NUEVO**

**Estado:** ✅ Construido mayo 2026.

**Qué hace:**
- **Suscripciones recurrentes** del restaurante a su plan (Starter/Pro/Enterprise) via Flow.cl
- **30-day free trial** para Starter y Pro
- **Comisión deferida del 1%** — los primeros 30 días son gratis, después se cobra 1% sobre transacciones digitales
- **Webhook handler** para confirmaciones de pago de Flow

**Cómo funciona:**
1. Owner elige plan en landing/registro → trial 30 días activado automáticamente
2. Día 31: cron diario (`/api/cron/billing`) calcula:
   - Suscripción mensual al plan
   - 1% de revenue digital del mes
3. Crea cobro en Flow.cl con `create-subscription`
4. Flow notifica al webhook con resultado
5. Si pago falla, downgrade a Free después de grace period

**Manual deploys SQL (aplicar a mano):**
- `ADD_DEFERRED_BILLING.sql` — campos de trial + deferred billing en restaurants
- `ADD_FLOW_SUBSCRIPTIONS.sql` — tabla de suscripciones Flow
- `ADD_PLAN_PAYMENTS.sql` — log de pagos

**Stack:** `lib/flow.ts`, `app/api/flow/*` (create-subscription, cancel-subscription, webhook), `app/api/cron/billing/route.ts`, `app/actions/billing.ts`.

---

## 10. Loyalty + cupones + mi-wallet

**Estado:** ✅ En uso.

**Programas soportados:**
- **Stamp cards** (5 cafés = 1 gratis)
- **Tiers** (bronze/silver/gold con beneficios escalonados)
- **Multiplicadores** (2x puntos los martes)
- **Trigger rules** (regalar postre en cumpleaños)
- **Reward catalog**: cupones canjeables por puntos

**Wallet del cliente:** `/mi-wallet` muestra cupones acumulados con QR code para canjear en el local.

**Stack:**
- DB: `loyalty_programs`, `loyalty_tiers`, `stamp_cards`, `customer_loyalty`, `points_ledger`, `multiplier_rules`, `trigger_rules`, `reward_catalog`, `loyalty_coupons`
- API: `app/api/loyalty/wallet/[userId]`, `loyalty/earn`, `loyalty/redeem`
- UI: `app/mi-wallet/page.tsx`, `app/(restaurant)/fidelizacion/page.tsx`

---

## 11. Pedido público sin cuenta (mayo 2026)

**Estado:** ✅ Lanzado.

**Qué hace:** Cliente entra a `/r/[slug]`, navega la carta, agrega al carrito, paga, sin crear cuenta. Ideal para pedidos delivery donde no quieren fricción de registro.

**Stack:** `app/r/[slug]/page.tsx` con `<CartPanel>` + `<PublicMenu>`, endpoint `/api/public/order/route.ts`.

**Tracking sin cuenta:** `/r/[slug]/track/[id]` — el cliente recibe un token único en email/SMS y puede tracking en vivo del rider sin login.

---

## 12. Soporte con Chapi suggest-reply

**Estado:** ✅ En uso por founder.

**Qué hace:**
- Owner crea ticket en `/plataforma/tickets`
- Ticket llega al founder en `/admin/dashboard` tab Tickets
- Founder ve el ticket + **contexto del restaurant** (plan, days_since_signup, last_login, activity, tickets previos)
- Botón "Generar respuesta sugerida" llama Chapi (Haiku 4.5) con:
  - Texto del ticket
  - Contexto completo
  - Plantillas de respuestas similares pasadas (RAG simple)
- Chapi devuelve **JSON estructurado**:
  - `reply`: texto listo para copiar
  - `category`: `resolvable_now` | `needs_code_change` | `needs_call`
  - `reasoning`: por qué clasificó así
- Founder copia o pulsa "Copiar y enviar"
- Banner "Ticket crítico sin respuesta hace >24h" al top del dashboard

**Stack:** `app/api/admin/support/tickets/route.ts` (CRUD), `tickets/[id]/context/route.ts` (contexto), `tickets/[id]/suggest-reply/route.ts` (LLM), `components/admin/AdminTicketsTab.tsx`, `components/admin/TicketContextPanel.tsx`.

---

## 13. Otras features menores pero relevantes

### Bills + split de cuenta
- División de cuenta en N partes iguales o por item
- Cada parte se puede pagar con Stripe o cash
- DTE separado por parte si es factura
- Stack: `app/api/bills/split/*`, `lib/bills/split-calculator.ts`, `components/bills/BillSplitModal.tsx`

### Reservas
- Calendar de mesas con disponibilidad
- Confirmación por email
- Stack: `reservations` table + `app/(restaurant)/reservas/page.tsx`

### Promociones
- Happy hour (rango horario)
- 2x1, combo, descuento porcentual
- Activables por canal: mesa / chat de espera / Chapi
- Activas/inactivas + valid_from/until
- Chapi en mesa las ofrece proactivamente al cliente cuando son relevantes
- Stack: `promotions` table + `app/(restaurant)/promociones/page.tsx` + `lib/promotions.ts`

### Geofencing
- Restaurantes definen su zona de cobertura delivery
- Cliente con cuenta tiene sus direcciones validadas contra geofences
- Eventos cuando rider entra/sale (auditoría + analytics)
- Stack: `lib/geofence.ts`, `geofence_events` table, edge function `purge-geofence-events`

### Notifications
- Email transaccional con Resend (boleta, confirmación reserva, push token, recovery)
- Push notifications mobile (riders + customers)
- In-app notifications via Supabase Realtime
- Stack: `lib/notifications/*`, `notifications` table

### Reclamación de restaurantes OSM
- Restaurantes ingestados desde OpenStreetMap aparecen en discovery sin owner
- Dueño puede reclamarlo en `/reclamar/[slug]`
- Verificación + traspaso de ownership
- Stack: `restaurant_claims` table + `app/reclamar/[slug]/page.tsx`

### Anfitrión / waitlist en restaurant
- Lista de espera del restaurant para clientes sin reserva
- Notificación al cliente cuando hay mesa
- Stack: `waitlist_entries` table

### Multi-location (Enterprise)
- Holding con N restaurantes, dashboard consolidado
- Transferencia de stock entre locales (Sprint 3, pendiente)
- Stack: `brand_id` en restaurants, multi-location stations

### Carta con extracción IA
- Owner sube PDF de su menú
- Sonnet 4.6 con vision tool extrae items, precios, descripciones, categorías
- Owner confirma/edita antes de publicar
- Tope mensual por plan (`MENU_IMPORT_AI_LIMIT` en `lib/plans.ts`)
- Stack: `app/api/extract-menu`, `app/api/menu-items/extract`, `components/carta/ImportMenuModal.tsx`

### Stock con import por foto
- Owner saca foto del recibo del proveedor / mercado
- Sonnet 4.6 con vision extrae productos, cantidades, costos, fecha vencimiento
- Confirmación editable
- Stack: `app/api/stock/import`, `app/api/inventory/import`, `app/(restaurant)/stock/page.tsx`

### Impresión de tickets térmicos
- Soporta impresoras Sunmi, Star, Epson via TicketService
- Comanda a cocina, pre-cuenta, boleta
- Stack: `lib/manual-print/*`, `app/api/print/*`, `print_servers` + `print_jobs` tables

---

## 14. Estado de migrations (DB)

- **96 archivos SQL** en `supabase/migrations/`
- **Migrations son manuales**: Vercel NO toca la DB. Hay que pegar SQL en Supabase SQL Editor.
- Numeración duplicada en algunos casos (ordenar por filename completo, no por número)

**Migrations pendientes de aplicar a mano (recientes):**
- `20260519_064_fix_heatmap_unique_orders.sql`
- `20260519_065_add_rider_verification_docs.sql`
- `20260520_066_rider_push_token.sql`
- `docs/manual-deploys/ADD_DEFERRED_BILLING.sql`
- `docs/manual-deploys/ADD_FLOW_SUBSCRIPTIONS.sql`
- `docs/manual-deploys/ADD_PLAN_PAYMENTS.sql`

---

## 15. Modelos IA usados

| Modelo | Uso |
|---|---|
| **Claude Haiku 4.5** (`claude-haiku-4-5-20251001`) | Chat de discovery (streaming), chat de mesa (streaming), suggest-reply de tickets |
| **Claude Sonnet 4.6** | Normalización de cartas (extract de PDF/foto con vision), reportes nocturnos batch, enriquecimiento de restaurants (Google Places + síntesis), insights |

**Patrones:**
- Prompts repetidos usan `cache_control: ephemeral`
- Chat siempre `stream: true` para latencia
- Sanitización defensiva en chat (`lib/chat/sanitize.ts`)

---

## 16. Lo que NO está construido (para honestidad)

- **`user_preferences` sigue siendo orphan** para diners anónimos — la nueva infra de comensales reemplaza esto.
- **Stock v2** (FIFO real con `stock_batches`): no construido. Sprint 2 pendiente.
- **Transferencia de stock entre locales** (Enterprise multi-brand): no construido. Sprint 3 pendiente.
- **CI/CD pipeline en GitHub Actions**: tests existen pero no hay workflow que bloquee push si rompen (al menos para el web; el mobile sí tiene CI propia).
- **Telemetría de fallback rates** del chat de mesa: no hay dashboard para ver cuántas veces se dispara el JSON recovery o el plain-text fallback.
- **App stores publicación de mobile**: el código está, pero verificar con Jorge si está submitted a Apple/Google.

---

## 17. Links rápidos

| Recurso | URL / Path |
|---|---|
| Repo | https://github.com/fsanmartinlizana-rgb/hichapi |
| Producción web | https://hichapi.com |
| Discovery | https://hichapi.com/buscar |
| Founder dashboard | https://hichapi.com/admin/dashboard |
| Submissions | https://hichapi.com/admin |
| Onboarding owner | https://hichapi.com/unete |
| Cuenta diner | https://hichapi.com/cuenta |
| Wallet diner | https://hichapi.com/mi-wallet |
| Brief de proyecto | [docs/HICHAPI_PROJECT_BRIEF.md](./HICHAPI_PROJECT_BRIEF.md) |
| Guía técnica Claude Code | [CLAUDE.md](../CLAUDE.md) |
| Roadmap sprints | [docs/ROADMAP.md](./ROADMAP.md) |
| Discovery deep-dive | [docs/DISCOVERY_PULIDO.md](./DISCOVERY_PULIDO.md) |
| Manual deploys | [docs/manual-deploys/](./manual-deploys/) |
