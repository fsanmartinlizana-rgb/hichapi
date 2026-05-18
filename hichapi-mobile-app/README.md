# HiChapi Mobile App

Aplicación móvil nativa para la plataforma de gestión de restaurantes HiChapi, construida con Expo SDK ~54 y React Native 0.76.

## Requisitos

- Node.js 20+
- npm 10+
- Expo CLI: `npm install -g expo-cli`
- EAS CLI: `npm install -g eas-cli`
- iOS: Xcode 15+ (solo macOS)
- Android: Android Studio con SDK 34+

## Configuración inicial

```bash
# 1. Instalar dependencias
npm install

# 2. Copiar variables de entorno
cp .env.example .env.local

# 3. Editar .env.local con tus credenciales reales
#    EXPO_PUBLIC_SUPABASE_URL=...
#    EXPO_PUBLIC_SUPABASE_ANON_KEY=...
#    EXPO_PUBLIC_API_BASE_URL=...
#    EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=...
```

## Desarrollo

```bash
# Iniciar servidor de desarrollo
npm start

# iOS (requiere macOS + Xcode)
npm run ios

# Android
npm run android
```

## Tests

```bash
# Ejecutar todos los tests
npm test

# Tests con cobertura (modo CI)
npm run test:ci

# Tests de tipos y propiedades (ts-jest, sin React Native)
npx jest --config jest.types.config.js
```

## Estructura del proyecto

```
hichapi-mobile-app/
├── App.tsx                    # Punto de entrada
├── index.js                   # Registro de la app
├── app.json                   # Configuración Expo
├── eas.json                   # Perfiles de build EAS
├── components/                # Componentes reutilizables
│   ├── StatusBadge.tsx
│   ├── AlertBadge.tsx
│   ├── OrderCard.tsx
│   ├── KanbanColumn.tsx
│   ├── TableCard.tsx
│   ├── MenuItemCard.tsx
│   ├── CartItemCard.tsx
│   ├── ChapiChatModal.tsx
│   ├── ErrorBoundary.tsx
│   └── OfflineBanner.tsx
├── screens/
│   ├── auth/                  # Login, Register, PasswordRecovery
│   ├── garzon/                # GarzonScreen, OrderDetailScreen
│   ├── comandas/              # ComandasScreen
│   ├── mesas/                 # MesasScreen, TableDetailScreen, QRGeneratorScreen
│   ├── client/                # QRScannerScreen, ClientMenuScreen, CartScreen, SplitPaymentScreen
│   ├── admin/                 # MenuManagementScreen, StockManagementScreen, WasteLogScreen, ShiftManagementScreen
│   ├── onboarding/            # OnboardingScreen
│   └── ProfileScreen.tsx
├── services/
│   ├── api/                   # APIClient, endpoints
│   ├── auth/                  # AuthService, SessionManager
│   ├── realtime/              # RealtimeService
│   ├── orders/                # OrderService, OrderValidator
│   ├── notifications/         # NotificationService, PushTokenManager
│   ├── cart/                  # CartService, CartCalculator
│   ├── stock/                 # StockService
│   ├── chapi/                 # ChapiService, SSEClient
│   └── storage/               # OfflineQueue
├── hooks/                     # useAuth, useOrders, useRealtime, useCart, useNotifications, useOfflineQueue, useAppUpdates
├── contexts/                  # AuthContext, CartContext, RealtimeContext
├── navigation/                # AppNavigator, AuthNavigator, MainNavigator, GarzonNavigator, ComandasNavigator, MesasNavigator, OnboardingNavigator
├── types/                     # models.ts, api.ts, navigation.ts, ui.ts, guards.ts
├── utils/                     # formatters, validators, constants, errorLogger, realtimeReducer, kanbanUtils, qrParser
└── config/                    # supabase.ts, api.ts
```

## Build y Release

### Build de desarrollo (simulador)

```bash
eas build --profile development --platform ios
eas build --profile development --platform android
```

### Build de preview (distribución interna)

```bash
eas build --profile preview --platform all
```

### Build de producción

```bash
eas build --profile production --platform all
```

### OTA Update (sin pasar por App Store)

```bash
# Publicar actualización OTA al canal de producción
eas update --branch production --message "Fix: descripción del cambio"
```

### Submit a tiendas

```bash
# App Store (iOS)
eas submit --platform ios --latest

# Google Play (Android)
eas submit --platform android --latest
```

## CI/CD

El workflow de GitHub Actions (`.github/workflows/ci.yml`) ejecuta automáticamente:
- `npm run test:ci` en cada Pull Request hacia `main` o `develop`
- Genera reporte de cobertura como artefacto

## Variables de entorno

| Variable | Descripción |
|----------|-------------|
| `EXPO_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Clave anónima de Supabase |
| `EXPO_PUBLIC_API_BASE_URL` | URL base de la API Next.js |
| `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Clave pública de Stripe |

## Arquitectura

La app reutiliza el backend existente (Supabase + Next.js API Routes) sin modificaciones. Ver [ARCHITECTURE.md](../ARCHITECTURE.md) para más detalles.

## Cambios requeridos en el backend

Ver [BACKEND_CHANGES.md](./BACKEND_CHANGES.md) para los endpoints nuevos requeridos por la app móvil.
