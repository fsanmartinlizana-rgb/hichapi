# Análisis de Cobertura de Tests

**Fecha:** 2026-04-21  
**Cobertura Global:** 4.68% (352/7511 líneas)

## Resumen Ejecutivo

La cobertura actual es del **4.68%**, muy por debajo del objetivo del 60%. Se han implementado tests para los módulos críticos del negocio, pero faltan muchos módulos importantes.

## Módulos con Cobertura

### ✅ Alta Cobertura (>70%)
- **app/api/stock** - 100% (30 tests)
- **app/api/team/invite** - 77.14%

### ✅ Cobertura Media (40-70%)
- **app/api/menu-items** - Tests implementados
- **app/api/orders** - Tests implementados

### ⚠️ Cobertura Baja (<40%)
- **lib/email/templates** - 29.09%
- **lib/app-url** - 33.33%

## Módulos Sin Cobertura (0%)

### 🔴 Prioridad Alta - Módulos de Negocio Críticos

#### Analytics & Reporting
- `app/api/analytics/route.ts` - Dashboard de métricas
- `app/api/reports/route.ts` - Generación de reportes

#### Dashboard
- `app/api/dashboard/route.ts` - Vista principal del restaurante

#### Gestión de Mesas
- `app/api/tables/route.ts` - CRUD de mesas
- `app/api/tables/split/route.ts` - División de cuentas

#### Pagos
- `app/api/stripe/payment-intent/route.ts` - Intención de pago
- `app/api/stripe/webhook/route.ts` - Webhooks de Stripe

#### Reservas (Parcial)
- `app/api/reservations/availability/route.ts` - Disponibilidad
- Tests existentes tienen fallos

#### Caja (Parcial)
- `app/api/cash/register/route.ts` - Registro de caja
- Tests existentes tienen fallos (7 de 16 fallando)

#### Loyalty (Parcial)
- `app/api/loyalty/earn/route.ts`
- `app/api/loyalty/redeem/route.ts`
- Tests existentes tienen fallos (5 de 20 fallando)

#### DTE (Parcial)
- `app/api/dte/emit/route.ts`
- `app/api/dte/emissions/route.ts`
- Tests existentes tienen fallos (2 de 18 fallando)

### 🟡 Prioridad Media - Funcionalidades Importantes

#### Movimientos de Stock
- `app/api/stock/movements/route.ts` - Historial de movimientos
- `app/api/stock/recipes/route.ts` - Recetas y consumo

#### Notificaciones
- `app/api/notifications/route.ts` - Sistema de notificaciones
- `lib/notifications/server.ts` - Lógica de servidor
- `lib/notifications/whatsapp.ts` - Integración WhatsApp

#### Integraciones de Delivery
- `app/api/delivery-integrations/route.ts` - Integraciones
- Tests existentes tienen fallos (4 de 14 fallando)

#### Waitlist
- `app/api/waitlist/join/route.ts` - Unirse a lista de espera
- `app/api/waitlist/status/route.ts` - Estado de espera
- `app/api/waitlist/notify/route.ts` - Notificaciones
- `lib/waitlist/eta.ts` - Cálculo de tiempo estimado

#### Soporte
- `app/api/support/route.ts` - Sistema de tickets

#### Upload
- `app/api/upload/route.ts` - Subida de archivos
- `app/api/upload/signed/route.ts` - URLs firmadas
- `lib/upload-image.ts` - Procesamiento de imágenes

### 🟢 Prioridad Baja - Utilidades y Helpers

#### Autenticación
- `lib/supabase/auth-guard.ts` - Guards de autenticación
- Tests existentes tienen 1 fallo

#### Seguridad
- `lib/crypto/aes.ts` - Encriptación
- `lib/api-keys.ts` - Gestión de API keys
- `lib/rate-limit.ts` - Rate limiting

#### Utilidades
- `lib/cache.ts` - Sistema de caché
- `lib/logger.ts` - Logging
- `lib/geofence.ts` - Geofencing
- `lib/landmarks.ts` - Puntos de referencia
- `lib/invite-token.ts` - Tokens de invitación
- `lib/permissions.ts` - Sistema de permisos
- `lib/plans.ts` - Planes de suscripción
- `lib/promotions.ts` - Sistema de promociones

#### DTE (Librería)
- `lib/dte/engine.ts` - Motor principal
- `lib/dte/signer.ts` - Firma digital
- `lib/dte/sii-client.ts` - Cliente SII (8 tests fallando)
- `lib/dte/caf.ts` - Gestión de CAF
- `lib/dte/folio.ts` - Gestión de folios
- `lib/dte/pdf-generator.ts` - Generación de PDFs
- `lib/dte/certification-engine.ts` - Motor de certificación
- Y otros módulos DTE...

#### Stock (Librería)
- `lib/stock/stockAlerts.ts` - Alertas de stock
- `lib/stock/stockRealtime.ts` - Actualizaciones en tiempo real

#### Tags
- `lib/tags/catalog.ts` - Catálogo de etiquetas

#### AI
- `lib/ai/chat.ts` - Chat con IA

#### i18n
- `lib/i18n/index.ts` - Internacionalización

## Plan de Acción

### Fase 1: Corto Plazo (1-2 semanas)
1. ✅ Arreglar tests existentes que están fallando
2. 🔄 Implementar tests para Analytics
3. 🔄 Implementar tests para Dashboard
4. 🔄 Implementar tests para Reports

### Fase 2: Mediano Plazo (2-4 semanas)
1. Implementar tests para Mesas y División de Cuentas
2. Implementar tests para Pagos (Stripe)
3. Completar tests de Reservas
4. Completar tests de Caja

### Fase 3: Largo Plazo (1-2 meses)
1. Implementar tests para módulos de prioridad media
2. Implementar tests para utilidades y helpers
3. Alcanzar objetivo de 60% de cobertura global

## Métricas de Progreso

| Métrica | Actual | Objetivo | Estado |
|---------|--------|----------|--------|
| Cobertura Global | 4.68% | 60% | 🔴 |
| Tests Pasando | 585/614 | 614/614 | 🟡 |
| Tests Fallando | 29 | 0 | 🔴 |
| Módulos con Tests | 8 | 30+ | 🔴 |

## Notas

- Los tests de Stock están completos y pasando (100%)
- Hay 29 tests fallando que necesitan corrección inmediata
- La mayoría de los módulos críticos de negocio no tienen tests
- Se necesita priorizar Analytics, Dashboard y Reports para el corto plazo
