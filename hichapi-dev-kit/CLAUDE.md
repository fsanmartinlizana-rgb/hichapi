# CLAUDE.md — HiChapi Project Config

> Este archivo configura Claude Code para el proyecto HiChapi.
> Léelo siempre antes de escribir código o tomar decisiones arquitectónicas.

---

## 🏗️ Stack

| Capa | Tech | Notas |
|------|------|-------|
| Frontend + API | Next.js 15 (App Router) | `/app` dir, Server Components por defecto |
| Database | Supabase (PostgreSQL + PostGIS + pgvector) | RLS activo en TODAS las tablas |
| Auth | Supabase Auth | multi-rol: cliente / garzón / supervisor / admin / super_admin |
| IA | Claude API (Haiku 4.5 + Sonnet 4.6) | Ver regla de modelos abajo |
| Pagos | Stripe | Suscripciones + split de cuenta |
| Deploy | Vercel | Auto-deploy desde main |
| Email | Resend | Transaccional + reportes |
| Mapas | Mapbox | Geofencing + pins |

---

## 📁 Estructura de carpetas

```
hichapi/
├── app/
│   ├── (public)/          # Chapi Discovery landing
│   │   └── page.tsx       # Hero con chat IA
│   ├── (restaurant)/      # Panel restaurante
│   │   ├── dashboard/
│   │   ├── menu/
│   │   ├── orders/
│   │   └── reports/
│   ├── (table)/           # Chapi at Table (QR)
│   │   └── [restaurantSlug]/[tableId]/
│   ├── api/
│   │   ├── chat/          # Claude API routes
│   │   ├── orders/
│   │   ├── restaurants/
│   │   └── webhooks/      # Stripe webhooks
│   └── layout.tsx
├── components/
│   ├── ui/                # Design system base
│   ├── chat/              # Chat IA components
│   ├── restaurant/        # Panel restaurante
│   └── discovery/         # Cards, mapa, filtros
├── lib/
│   ├── supabase/          # client, server, admin
│   ├── claude/            # wrappers API Claude
│   ├── stripe/            # helpers Stripe
│   └── utils/
├── supabase/
│   ├── migrations/        # SQL migrations numeradas
│   └── seed/
└── .claude/
    └── agents/            # Subagentes de este proyecto
```

---

## 🎨 Design System

| Token | Valor |
|-------|-------|
| `--color-primary` | `#FF6B35` (naranja, apetito) |
| `--color-dark` | `#1A1A2E` (azul oscuro, sofisticación) |
| `--color-bg` | `#FAFAF8` |
| `--color-text` | `#1A1A2E` |
| `font-display` | DM Sans |
| `font-mono` | DM Mono (precios, números) |

---

## 🤖 Regla de modelos IA

| Tarea | Modelo | Razón |
|-------|--------|-------|
| Chat usuario (Discovery + at Table) | `claude-haiku-4-5` | Velocidad + costo mínimo |
| Normalizar carta restaurante | `claude-sonnet-4-6` | Razonamiento imagen/PDF |
| Reporte diario restaurante | `claude-sonnet-4-6` (batch) | 50% descuento, no urgente |
| Notificaciones geofencing | `claude-haiku-4-5` | Velocidad crítica |
| Análisis complejo | `claude-sonnet-4-6` | Razonamiento profundo |

**Regla de oro: Haiku para escala (usuarios en tiempo real), Sonnet para calidad (análisis, reportes).**

Usar siempre `stream: true` en el chat de usuario. Usar `prompt_caching` cuando el system prompt se repite.

---

## 🔒 Reglas de seguridad / RLS

- **NUNCA** escribir lógica de autorización solo en el frontend
- Todo acceso a datos va a través de RLS en PostgreSQL
- Cada tabla tiene políticas por rol:
  - `client`: solo sus propios datos
  - `waiter`: solo mesas de su restaurante asignado
  - `admin`: solo su restaurante
  - `super_admin`: lectura global (Frank)
- Usar `supabase.auth.getUser()` server-side, nunca confiar en el cliente

---

## 🧪 Convenciones de código

- **TypeScript estricto**: `strict: true` en tsconfig
- **Naming**: camelCase variables, PascalCase componentes, snake_case DB columns
- **API routes**: siempre validar input con Zod antes de tocar la DB
- **Errores**: never throw genérico, usar `AppError` con código y mensaje
- **Comentarios**: en español para lógica de negocio, inglés para código técnico
- **Testing**: escribir tests antes del componente cuando es lógica crítica (pagos, auth)

---

## 💰 Costos de infra — mantener bajo

- Claude Haiku: ~$0.003/conversación → máx 1000 tokens output por chat turn
- Claude Sonnet batch: ~$0.10/restaurante/noche → solo en cron nocturno
- Supabase Free tier hasta 500 usuarios activos → luego Pro $25/mes
- Vercel Free → ilimitado para este proyecto al inicio

---

## 🚀 Flujo de desarrollo

1. Todas las migraciones de DB van en `supabase/migrations/` con timestamp
2. Deploy: `git push origin main` → Vercel auto-deploys
3. Variables de entorno: `.env.local` para dev, Vercel dashboard para prod
4. No pushear nunca API keys al repo

---

## 📦 Subagentes disponibles (.claude/agents/)

| Agente | Cuándo usarlo |
|--------|---------------|
| `db-architect` | Diseñar o modificar schema, migraciones, RLS |
| `chapi-chat-builder` | Construir flujos de chat IA con Claude API |
| `restaurant-panel-dev` | Componentes del panel de restaurante |
| `discovery-builder` | Landing, búsqueda semántica, cards de resultado |
| `payment-integrator` | Stripe, split de cuenta, webhooks |
| `ops-analyst` | Revisar métricas, reportes diarios, crons |
| `security-auditor` | RLS, auth, validaciones, exposición de datos |
| `nextjs-architect` | Arquitectura de rutas, Server Components, performance |

---

*HiChapi v3.0 — Actualizado Abril 2025*
