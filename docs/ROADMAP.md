# HiChapi — Roadmap de sprints

> Plan vivo para construir las features de Stock v2, Centro de mando del founder y Mobile responsiveness. Última actualización: 2026-04-26.

## Principios

- **Sprint = unidad commiteable y deployable**. Un sprint puede ser un PR o varios commits secuenciales en main, pero al cierre el sistema sigue funcionando.
- **Migrations manuales**: nuevos cambios de schema se agregan como migration timestamped en `supabase/migrations/`. El usuario las ejecuta manualmente en el SQL Editor de Supabase (Vercel no toca la DB).
- **Mobile-first donde corresponda**: para vistas de operación (garzón, cocina), el mobile NO es un nice-to-have, es bloqueante.
- **Feature flags con `feature_flags` JSONB** para rollouts graduales en producción.

---

## Sprint 1 — Bases para Stock v2 + Mobile crítico + Founder context (EN EJECUCIÓN)

**Objetivo**: dejar listo lo que más mueve la aguja con menor riesgo, sin construir features pesadas (esas vienen en sprints 2-3).

### 1.1 — Stock: agregar lot_number y alert_days_before
- **Migration nueva** `20260426_060_stock_batches_alerts.sql`:
  - `stock_items.lot_number TEXT NULL` (FIFO simple sin tabla de batches; futuro Sprint 2 agrega tabla aparte si se necesita más granular)
  - `stock_items.alert_days_before INTEGER NOT NULL DEFAULT 3`
- UI: form de nuevo/editar producto incluye los 2 campos.
- Helper `getDaysToExpiry(item)` reusa la columna `expiry_date` (ya existe en migration 038).

### 1.2 — Hook `useIsMobile` global
- `lib/hooks/useIsMobile.ts` con `window.matchMedia('(max-width: 767px)')` + listener.
- Reemplaza la lógica local en `HiChapiSolar.tsx` (refactor opcional).

### 1.3 — Bottom nav móvil para layout `(restaurant)`
- Sidebar desktop sigue igual (hidden en `md:`).
- En mobile (`<md`), renderea un bottom nav fixed con los 5 items más usados según el rol activo:
  - **Garzón / Anfitrión**: Garzón · Mesas · Comandas · Cuenta · Más
  - **Cocina**: Comandas · Más
  - **Owner / Admin**: Dashboard · Mesas · Comandas · Caja · Más
- "Más" abre el sidebar como drawer fullscreen.

### 1.4 — Comandas garzón responsive
- Migrar la página `app/(restaurant)/garzon/page.tsx` a:
  - Desktop: layout actual (lista de mesas con tablas).
  - Mobile (<768px): cada mesa = card vertical full-width, botones de acción min-h-44px.
- Mismo data flow, solo cambio de layout con `useIsMobile()` o clases tailwind responsive.

### 1.5 — Founder: funnel de activación
- Endpoint nuevo `GET /api/admin/funnel`:
  - `registered`: count de `restaurants` creados en período
  - `with_menu`: count que tiene ≥1 `menu_items.available=true`
  - `with_qr`: count que tiene ≥1 `tables`
  - `first_order_paid`: count que tiene ≥1 `orders.status='paid'`
  - Período configurable por query param: `?days=30`
- En `app/admin/dashboard/page.tsx`, sección nueva "Funnel de activación" con barras horizontales mostrando cada etapa + % drop-off.

### 1.6 — Founder: vista detalle de ticket con contexto
- Cuando se abre un ticket en `plataforma/tickets/page.tsx`:
  - Agregar columna lateral derecha con cards de contexto:
    - **Restaurant card**: nombre, plan, days_since_signup, last_login (de auth.users.last_sign_in_at), restaurant.active
    - **Activity card**: orders_total, orders_last_7d, menu_items_count
    - **Tickets previos**: lista compacta de tickets cerrados con título + fecha
  - Datos vienen de un endpoint nuevo `GET /api/admin/support/tickets/[id]/context`
- "Respuesta sugerida por Chapi" queda como **Sprint 4** (requiere integración LLM real).

### 1.7 — Migration manual a aplicar
Documentada en `docs/manual-deploys/SPRINT_01_stock_v2.sql` (auto-generada al final de este sprint).

---

## Sprint 2 — Stock: importación por foto + lotes FIFO

### 2.1 — Importación por foto/PDF con Claude Vision
- Endpoint `POST /api/stock/import-vision` que recibe imagen/PDF, llama Claude 4.6 con vision tool, extrae:
  - Productos: nombre, cantidad, unidad, costo, fecha vencimiento si aparece
  - Score de confianza por campo
- Resultado va a `stock_imports` (tabla nueva con status `draft|confirmed|cancelled`).
- UI de confirmación editable con campos amarillos donde la confianza es baja (`< 0.7`). Botón confirmar bloqueado hasta que todos los amarillos estén tocados.
- Tope mensual con `MENU_IMPORT_AI_LIMIT[plan]` (ya existe en `lib/plans.ts`). Se usa la columna `feature_flags.menu_imports_this_month` o se cuenta dinámico desde `stock_imports.created_at`.
- Cancelados cuentan al tope para evitar abuso.

### 2.2 — Tabla `stock_batches` para FIFO real
Migration nueva con tabla:
```sql
stock_batches (
  id uuid pk,
  stock_item_id uuid fk,
  lot_number text,
  qty numeric,
  cost_per_unit numeric,
  received_at timestamptz,
  expiry_date date,
  exhausted boolean default false
)
```
- Trigger: cuando `current_qty` sube por un movimiento positivo, crear batch nuevo.
- Cuando baja, descontar del batch más antiguo no exhausto (FIFO real).
- UI muestra batches por item (drawer en /stock).

### 2.3 — Chapi avisa productos por vencer
- Cron diario que recorre `stock_items` con `expiry_date <= now() + alert_days_before`:
  - Inserta notificación en `notifications`
  - Sugiere "usar como especial del día"
  - Muestra "Valor en riesgo" en CLP en el reporte nocturno.

---

## Sprint 3 — Transferencia de stock entre locales (Enterprise only)

### 3.1 — Schema
- Tabla nueva `stock_transfers`:
  - `id, from_restaurant_id, to_restaurant_id, requested_by_user_id, approved_by_user_id, stock_item_id, qty_requested, qty_approved, status (pending|partial|approved|rejected), reason, created_at, approved_at`
- Constraint: ambos restaurants deben estar en el mismo `brand_id` (holding).
- RLS: solo team_members del holding pueden ver/crear transfers.

### 3.2 — Flujo de UI
- Botón "Solicitar a otro local" en `/stock` solo visible si:
  - Plan = enterprise
  - El restaurant tiene `brand_id` y al menos otro restaurant en el mismo brand.
- Modal: elegir item, qty, restaurant destino → crea transfer con status `pending`.
- En `/stock` del local destino: notificación + drawer "Solicitudes recibidas" con botones aceptar total / aceptar parcial / rechazar.
- RPC `apply_transfer` que mueve el stock atómicamente con auditoría.

### 3.3 — Mobile flow
- Notificación en bottom nav del responsable del local destino.
- Tap abre drawer con un click → "Aprobar" (botón fullwidth min-h-56px).

---

## Sprint 4 — Founder Centro de mando v2

### 4.1 — Tabla de upgrades de plan por semana
- Endpoint `GET /api/admin/upgrades?weeks=8` lee `restaurants` con `feature_flags.plan_history` o auditoría (a crear: trigger que loguea cambios de `restaurants.plan` en `restaurant_audit`).
- UI: bar chart de upgrades por semana últimas 8 semanas + tabla de quiénes upgradearon.

### 4.2 — Restaurantes en riesgo
- Endpoint `GET /api/admin/risks` con flags computados:
  - `no_login_7d`: last_sign_in_at < now - 7d
  - `no_orders_3d`: max(orders.created_at) < now - 3d
  - `incomplete_menu`: count(menu_items) < 5
- UI: tabla filtrable por flag, ordenada por urgencia.

### 4.3 — Gráfico nuevos restaurantes/día
- Reusa endpoint funnel pero por día.
- Recharts AreaChart de últimos 30 días.

### 4.4 — Tickets v2 (Chapi sugiere respuesta)
- Endpoint `POST /api/admin/support/tickets/[id]/suggest-reply` llama Claude con:
  - Texto del ticket
  - Contexto del restaurant (cards del Sprint 1.6)
  - Plantilla de respuestas pasadas similares (RAG simple)
- UI: card "Respuesta sugerida" con botones "Copiar" y "Enviar y cerrar".
- Clasificación 3-buckets: `resolvable_now | needs_code_change | needs_call`.
- Banner "Ticket crítico sin respuesta hace > 24h" en top del dashboard.
- Métrica "Tiempo medio de respuesta" calculado de timestamps en `conversation` JSONB.

---

## Sprint 5 — Mobile responsiveness completo

### 5.1 — Patrón Table → Cards reutilizable
- Componente `<ResponsiveTable>` que recibe columnas + `mobileCardRender` y decide automáticamente.

### 5.2 — Mesas mobile
- Plano de mesas en grid 3-cols mobile / 4-cols desktop. Cada mesa = bloque mín 80x80, color por status.
- Sin pinch-zoom. Tap abre drawer detalle.

### 5.3 — KDS Cocina mobile
- Single-column scroll vertical en mobile.
- Botón "Listo" sticky bottom en cada card.

### 5.4 — Caja mobile
- Apertura/cierre con teclado numérico nativo (`inputMode="numeric"`).
- Total destacado, breakdown por medio de pago colapsado.

### 5.5 — Stock mobile
- Lista de items: nombre + qty + alerta. Detalle en drawer.
- Form de nuevo producto fullscreen modal.

### 5.6 — Centro de mando mobile
- Métricas en 2 columnas mobile.
- Tickets como cards apiladas con respuesta sugerida fullscreen al tap.

### 5.7 — Modo simplificado garzón/cocina
- Si rol = `garzon|cocina|anfitrion` y viewport < 768px:
  - Oculta sidebar completo
  - Bottom nav simplificado
  - Sin acceso a Configuración/Equipo/Plan

---

## Estado por sprint

| Sprint | Estado | Fecha | PR/commit |
|---|---|---|---|
| 1 | EN CURSO | 2026-04-26 | — |
| 2 | TODO | — | — |
| 3 | TODO | — | — |
| 4 | TODO | — | — |
| 5 | TODO | — | — |

## Migraciones manuales a aplicar (resumen)

| Sprint | Archivo | Qué hace |
|---|---|---|
| 1 | `20260426_060_stock_batches_alerts.sql` | Agrega `lot_number` + `alert_days_before` a `stock_items` |
| 2 | `20260426_061_stock_imports.sql` | Tabla `stock_imports` para flujo de importación por foto |
| 2 | `20260426_062_stock_batches_table.sql` | Tabla `stock_batches` + trigger FIFO |
| 3 | `20260426_063_stock_transfers.sql` | Tabla `stock_transfers` + RLS + RPC `apply_transfer` |
| 4 | `20260426_064_restaurant_audit.sql` | Tabla `restaurant_audit` para tracking de upgrades |
