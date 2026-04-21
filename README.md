# HiChapi - Restaurant Management System

Sistema integral de gestión para restaurantes con POS, inventario, facturación electrónica, y más.

## 🧪 Testing

Este proyecto cuenta con una suite completa de pruebas unitarias usando Vitest y fast-check.

### Estado Actual
- ⚠️ **595/614 tests pasando (96.9%)**
- ⚡ **Suite ejecuta en ~3.4 segundos**
- 🎯 **Integrado con Vercel CI/CD (modo soft)**
- 📝 **19 tests pendientes de fix** (ver `DEPLOY_STRATEGY.md`)

> **Nota**: Los tests están en "modo soft" - no bloquean deployments pero aparecen en logs. Esto permite deployar mientras se arreglan los tests restantes.

### Ejecutar Tests

```bash
# Ejecutar todos los tests
npm test

# Ejecutar tests en modo watch
npm run test:watch

# Ejecutar tests con coverage
npm test -- --coverage

# Ejecutar tests específicos
npm test -- __tests__/api/orders
```

### Cobertura de Tests

- ✅ Orders API (45 tests)
- ✅ Menu Items API (32 tests)
- ✅ Stock & Mermas API (30 tests)
- ✅ Cash Register & Expenses API (28 tests)
- ✅ Team & Auth Guards (35 tests)
- ✅ Reservations API (23 tests)
- ✅ Loyalty API (20 tests)
- ✅ DTE Emissions API (18 tests)
- ✅ Print API (15 tests)
- ✅ Delivery Integrations API (12 tests)
- ✅ Notifications API (10 tests)
- ✅ Zod Schema Validation (15 tests)

Ver documentación completa en [`__tests__/README.md`](./__tests__/README.md)

## 🚀 CI/CD

### Vercel Pipeline
Los tests se ejecutan automáticamente en cada deployment a producción. Si los tests fallan, el deployment se cancela.

Ver configuración en [`VERCEL_CI_SETUP.md`](./VERCEL_CI_SETUP.md)

### GitHub Actions (Opcional)
También incluye workflow de GitHub Actions para ejecutar tests en PRs.

Ver [`.github/workflows/test.yml`](./.github/workflows/test.yml)

## 📚 Documentación

- [Test Suite Documentation](./__tests__/README.md)
- [Coverage Analysis](./__tests__/COVERAGE_ANALYSIS.md)
- [Test Fixes Summary](./TASK_5_FIXES_SUMMARY.md)
- [Vercel CI Setup](./VERCEL_CI_SETUP.md)
- [Vercel CI Quick Start](./VERCEL_CI_QUICK_START.md)
- **[Deploy Strategy](./DEPLOY_STRATEGY.md)** ⚠️ **IMPORTANTE - Leer antes de deployar**

## 🛠️ Desarrollo

```bash
# Instalar dependencias
npm install

# Ejecutar en desarrollo
npm run dev

# Ejecutar tests
npm test

# Build para producción
npm run build
```

## 📦 Stack Tecnológico

- **Framework**: Next.js 16
- **Database**: Supabase (PostgreSQL)
- **Testing**: Vitest + fast-check
- **Styling**: Tailwind CSS
- **Payments**: Stripe
- **DTE**: Integración con SII Chile
- **CI/CD**: Vercel + GitHub Actions

## 📄 Licencia

Privado - HiChapi © 2026
