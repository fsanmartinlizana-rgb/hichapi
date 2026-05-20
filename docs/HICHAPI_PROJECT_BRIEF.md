# HiChapi — Brief de proyecto para Claude

> Documento maestro para nutrir conversaciones de Claude (Projects, Code, chat).
> Última actualización: 2026-05-19.
> Subilo a tu carpeta de proyecto en claude.ai → Claude lo usa como contexto en todas las conversaciones.

---

## 1. Qué es HiChapi (en 60 segundos)

**Plataforma SaaS de gestión integral para restaurantes en Chile + motor de discovery gastronómica para diners.** Un solo backend, dos clientes (web + app mobile nativa), tres audiencias finales.

**Propuesta de valor:**
- **Para diners**: chat conversacional para encontrar dónde comer en Santiago según gustos, presupuesto, dieta, zona (`"ramen sin gluten en Ñuñoa por 20 lucas"`).
- **Para dueños de restaurante**: POS + comandas + caja + stock + carta + DTE (facturación electrónica SII) + delivery + loyalty + analytics, todo en una sola plataforma.
- **Para clientes en mesa**: escanean QR y piden directamente al asistente Chapi (chat IA con la carta), dividen cuenta, pagan, sin cuenta de usuario, sin descargar nada.

**Modelo de negocio:** suscripción mensual por restaurante (Free / Starter / Pro / Enterprise) + 1% de comisión sobre transacciones digitales.

---

## 2. URLs y cómo accede cada audiencia

### Producción (web)
| URL | Quién entra | Qué ve |
|---|---|---|
| https://hichapi.com/ | Cualquiera | Landing pública con value props, pricing, screenshots |
| https://hichapi.com/buscar | Diners | Chat de discovery con Chapi para encontrar restaurantes |
| https://hichapi.com/r/[slug] | Diners | Página pública de cada restaurante (menú + info + pedir online) |
| https://hichapi.com/reservar/[slug] | Diners | Reserva de mesa |
| https://hichapi.com/espera | Diners | Lista de espera para próximos restaurantes en otras ciudades |
| https://hichapi.com/mi-wallet | Clientes con cuenta | Cupones de loyalty acumulados |
| https://hichapi.com/unete | Dueños prospecto | Onboarding para registrar restaurante |
| https://hichapi.com/login | Owner / staff | Login |
| https://hichapi.com/registro | Owner | Crear cuenta + restaurante (Free/Starter/Pro/Enterprise con trial 30d) |
| https://hichapi.com/reclamar/[slug] | Dueño de restaurante OSM | Reclama un restaurante listado automáticamente |

### Panel restaurante (necesita login owner/staff)
Todo bajo `https://hichapi.com/[ruta]`:

| Ruta | Propósito |
|---|---|
| `dashboard` | KPIs del local |
| `garzon` | Vista de operación para meseros |
| `comandas` | KDS de cocina |
| `mesas` | Plano + estado de mesas |
| `caja` | Apertura / cierre / cuadre de caja |
| `carta` | Editor de menú + extracción IA desde PDF |
| `stock` | Inventario, alertas de vencimiento, import por foto |
| `mermas` | Registro de pérdidas |
| `dte` | Facturas/boletas/notas crédito/débito SII |
| `delivery` | Pedidos delivery + riders + heatmap + analítica |
| `fidelizacion` | Loyalty programs + cupones |
| `reservas` | Gestión de reservas |
| `equipo` | Staff + roles + invitaciones |
| `turnos` | Shifts |
| `impresoras` | Configuración de impresoras térmicas |
| `integraciones` | Conexión Rappi / PedidosYa |
| `agregar-sucursal` | Multi-local (Enterprise) |
| `analytics`, `insights`, `reporte` | Reportes de negocio |
| `promociones` | Happy hour, combos, 2x1, etc. |
| `tono` | Configuración de personalidad de Chapi en el chat de mesa |
| `modulos` | Activar/desactivar features según plan |
| `plataforma/tickets` | Soporte (creación de tickets) |
| `restaurante` | Configuración pública del restaurante |
| `configuracion` | Settings generales |

### Founder / super admin
| URL | Propósito |
|---|---|
| https://hichapi.com/admin/dashboard | Centro de mando: 5 tabs (restaurantes, reviews, tickets, analytics, riders), funnel de activación, restaurantes en riesgo, upgrades de plan, nuevos por día |
| https://hichapi.com/admin | Submissions de restaurantes (cola de aprobación) |
| https://hichapi.com/admin/riders | Verificación y gestión de riders del marketplace de delivery |

### Cliente en mesa (sin login, escanea QR)
| URL | Propósito |
|---|---|
| `https://hichapi.com/[slug]/[tableId]` | Chat con Chapi: ver carta, pedir, dividir cuenta, pagar |

### App mobile (React Native + Expo)
- En `hichapi-mobile-app/`
- **Estado de publicación en stores:** verificar con Jorge (autor del commit `1c0de40`)
- Soporta los mismos 4 roles: garzón, comandas/cocina, cliente, admin + onboarding de rider
- Tiene `OfflineQueue` — los pedidos se guardan local si el wifi cae y se sincronizan después

### Código fuente
**Repo público:** https://github.com/fsanmartinlizana-rgb/hichapi
- Branch productiva: `main`
- Auto-deploy: push a `main` → Vercel build → web en producción
- Mobile: build manual con `eas build` → submit a App Store / Google Play

---

## 3. Stack técnico

| Capa | Tecnología |
|---|---|
| Frontend web | Next.js 16 (App Router) + React 19 + TypeScript strict + Tailwind CSS 4 |
| Mobile | React Native + Expo |
| Backend | API Routes de Next.js (`app/api/`) — compartido web ↔ mobile |
| DB | Supabase Postgres + PostGIS (geoespacial) + pgvector (embeddings) |
| Auth | Supabase Auth (cookie web, bearer token mobile) |
| IA | Anthropic Claude Haiku 4.5 (chat streaming) + Sonnet 4.6 (análisis batch) |
| Pagos | Stripe |
| Email | Resend |
| Mapas | Mapbox |
| Facturación | Integración directa SII Chile (DTE: boletas, facturas, notas, exenta) |
| Storage | Supabase Storage |
| Hosting | Vercel (web) |
| Tests | Vitest + fast-check (web) · Jest (mobile) |

**Roles de usuario:** `cliente`, `garzon`, `cocina`, `supervisor`, `admin` (owner del restaurante), `super_admin` (founder de HiChapi).

**RLS habilitado en TODAS las tablas** — nunca se confía en autorización solo en frontend.

---

## 4. Features construidas (estado a hoy)

### Estables y en producción
- **Discovery** con chat natural-language, dietary filters, multi-zona, dish-only items, mapa con multi-pin, info de Google Places en ficha. ~3000 casos de QA cubiertos.
- **Operación de restaurante** completa: mesas, comandas, caja, garzón, KDS de cocina, mobile-responsive con bottom nav.
- **Chapi en mesa**: chat con sanitización defensiva de precios (el LLM no puede inventar totales o platos fuera del menú — el sistema los strippea).
- **Carta** con extracción IA desde PDF, ingredientes con gramaje, recipes, costos.
- **Stock v1**: import por foto con Claude vision, FIFO simple con lot_number, alertas de vencimiento.
- **DTE Chile**: boletas, facturas, notas de crédito/débito, exenta, certificación SII.
- **Delivery propio** con marketplace de riders, onboarding y verificación documental del rider, heatmap, analytics, route engine, ratings, tiers.
- **Delivery integraciones** con Rappi y PedidosYa (aparte del rider propio).
- **Loyalty + cupones** con `customer_loyalty` y `loyalty_coupons`.
- **Pedido público sin auth**: cliente escanea QR, pide y paga sin crear cuenta (lanzado May 19).
- **Centro de mando del founder**: 5 tabs (restaurantes, reviews, tickets, analytics, riders), funnel de activación con drop-off, lista de restaurantes en riesgo de churn, tracking de upgrades/downgrades de plan, gráfico de nuevos restaurantes/día, banner de tickets críticos sin respuesta >24h.
- **Tickets / Soporte** con sugerencia automática de respuesta por Chapi, clasificada en 3 buckets: `resolvable_now`, `needs_code_change`, `needs_call`.
- **App mobile** con todas las pantallas core (garzón, comandas, cliente, admin) + rider onboarding/verification/active-order.

### Pendientes
- **Stock v2** (FIFO real con tabla `stock_batches`) — Sprint 2 del ROADMAP, no iniciado.
- **Transferencia de stock entre locales** (Enterprise multi-brand) — Sprint 3.
- **user_preferences** (tabla existe desde abril, código nunca la usó) — tiene `dietary_restrictions`, `favorite_cuisines`, `favorite_zones`, `search_history`, `budget_min/max_clp`, `favorite_restaurants`. Implementarlo permitiría personalizar el chat de discovery por usuario logueado.

---

## 5. Modelo de precios

| Plan | Mensual por local | Comisión digital | Trial | Para quién |
|---|---|---|---|---|
| Free | $0 | 1% | — | Local que quiere presencia digital + aparecer en discovery |
| Starter | (ver landing) | 1% | 30 días | Local con operación de salón completa (mesas + QR + comandas + caja) |
| Pro | (ver landing) | 1% | 30 días | Stock + mermas + reportes IA + fidelización |
| Enterprise | Por tramos según N° de locales | Desde 1% hasta 0.5% según volumen | — | Holdings con 2+ locales que quieren dashboard consolidado y transferencia de stock |

Pricing actualizado vive en la landing — consultá `https://hichapi.com/` para los valores actuales.

---

## 6. Datos clave del producto

- **Moneda**: pesos chilenos (CLP), siempre enteros, sin centavos.
- **Formato de precio**: `$18.500` (punto como separador de miles, sin decimales).
- **Zonas activas**: Santiago (Providencia, Ñuñoa, Las Condes, Vitacura, Lastarria, Bellavista, Barrio Italia, Santiago Centro, Recoleta, San Miguel, etc.). Viña/Valpo/Concepción en lista de espera.
- **Modelo IA**:
  - Haiku 4.5 para chat real-time (cliente con Chapi, sugerencias de respuesta)
  - Sonnet 4.6 para análisis batch (normalización de cartas, enriquecimiento, reportes)
- **DTE**: integración directa con SII Chile, no terceros (Maximiliano, Bsale, etc.).

---

## 7. Equipo y workflow

- **Founder + tech lead**: Felipe (vos) — vive en código, decisiones de producto/negocio.
- **Dev colaborador**: Jorge — mayoritariamente DTE/bills/delivery/mobile.
- **Workflow**: push directo a `main` (sin PR review formal). Vercel deploya web automáticamente. Migrations de Supabase son **manuales** (pegar SQL en SQL Editor — Vercel no toca DB).
- **Tests**: Vitest para web, Jest para mobile. Modo soft en CI (no bloquean deploy).

---

## 8. Riesgos / cosas a saber

1. **Mobile y web comparten APIs**: cualquier breaking change en `app/api/` rompe la app mobile hasta que los usuarios actualicen. APIs deben ser **backward-compatible**.
2. **El LLM se equivoca con aritmética**: hay sanitización defensiva en chat de mesa para que el cliente final nunca vea totales mal calculados. No remover `lib/chat/sanitize.ts`.
3. **Numeración de migrations duplicada y migrations modificadas in-place**: hay que aplicar SQL a mano y verificar con `\d` en SQL Editor lo que está aplicado de verdad.
4. **Mobile no se actualiza al toque** (Apple/Google review 24-72h) → bugs en mobile tardan días en parchearse.
5. **Auth dual** (cookie web + bearer mobile) vive en `lib/supabase/auth-guard.ts` — cambios acá afectan los dos clientes.

---

## 9. Lo que un agente de contenido debería saber

Si el agente está generando contenido de marca, hooks, posts, landings o lead magnets sobre HiChapi:

**Lenguaje y tono:**
- Mercado chileno: lenguaje cercano, sin formalismo, OK usar chilenismos suaves (lucas, pega, onda) sin abusar.
- No tecnicismos cuando hablás con dueños de restaurante — son operadores, no técnicos.
- Honestidad sobre alcance: hoy Santiago + Chile. No prometer otras ciudades hasta que estén activas.

**Diferenciadores reales (no inventar):**
- Único POS chileno con chat IA integrado para clientes en mesa.
- Discovery + POS + DTE en una sola plataforma (la competencia obliga a integrar 3 productos distintos).
- App mobile nativa con OfflineQueue (los pedidos no se pierden con wifi malo, problema #1 de restaurantes chilenos).
- Comisión 1% (más barata que Rappi 25-30%).
- Trial 30 días sin tarjeta para Starter y Pro.

**Personas (audiencias) a las que se le habla:**
- **Owner pyme gastronómica** (1-3 locales) — quiere bajar costos operativos, no más fricciones de tecnología.
- **Owner holding** (4+ locales) — quiere consolidación y data agregada.
- **Garzón / mesera** — quiere herramientas que no se caigan en hora pico.
- **Diner foodie** — quiere descubrir lugares nuevos sin scrollear Instagram 40 minutos.
- **Cliente en mesa** — quiere pedir sin esperar al garzón, dividir cuenta sin pelearse con amigos.

**Casos de uso para hooks/contenido:**
- "Cómo Chapi le devolvió 4 horas/semana al dueño de [X]"
- "Por qué tu garzón odia tu POS actual"
- "Las 3 cosas que un restaurante chileno pierde cada noche y no se da cuenta"
- "Lo que pasa cuando un cliente escanea el QR en mesa por primera vez"
- "Por qué cobramos 1% y no 25% como Rappi"

**Lo que NO se debe prometer:**
- Soporte 24/7 (no lo tenemos)
- Disponibilidad en otras ciudades sin verificar `lib/cities.ts` activas
- Integración con sistemas que no están realmente integrados (Manychat, HubSpot, etc.)
- Funciones "premium" en plan Free

---

## 10. Links rápidos

| Recurso | URL |
|---|---|
| Repo | https://github.com/fsanmartinlizana-rgb/hichapi |
| Producción web | https://hichapi.com |
| Centro de mando founder | https://hichapi.com/admin/dashboard (requiere `ADMIN_SECRET`) |
| Submissions de restaurantes | https://hichapi.com/admin |
| Riders | https://hichapi.com/admin/riders |
| Discovery público | https://hichapi.com/buscar |
| Onboarding owner | https://hichapi.com/unete · https://hichapi.com/registro |
| Brief de proyecto (este doc) | `docs/HICHAPI_PROJECT_BRIEF.md` |
| Guía técnica para Claude Code | `CLAUDE.md` (raíz del repo) |
| Roadmap de sprints | `docs/ROADMAP.md` |
