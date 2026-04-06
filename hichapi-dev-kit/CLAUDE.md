# HiChapi — Claude Code Config

## Stack
- Frontend: Next.js 15 App Router → Vercel (auto-deploy desde main)
- DB: Supabase PostgreSQL + PostGIS + pgvector · RLS en TODAS las tablas
- Auth: Supabase Auth · roles: cliente / garzon / supervisor / admin / super_admin
- AI: Haiku 4.5 (chat real-time) · Sonnet 4.6 (análisis, reportes batch)
- Pagos: Stripe · Email: Resend · Mapas: Mapbox

## Paths
- app/(public) → Discovery landing
- app/(restaurant) → panel restaurante
- app/(table)/[slug]/[tableId] → Chapi at Table QR
- app/api/chat · orders · restaurants · webhooks
- lib/supabase · lib/claude · lib/stripe
- supabase/migrations/ → SQL con timestamp

## Naming
- Variables: camelCase · Componentes: PascalCase · DB: snake_case
- Zod en todas las API routes · AppError para errores · strict TypeScript
- Comentarios de negocio en español, código en inglés

## Modelos IA
- Haiku 4.5: chat usuario, notificaciones geofencing
- Sonnet 4.6: normalización cartas, reportes diarios (batch), análisis
- Chat: stream: true siempre · System prompts repetidos: cache_control ephemeral

## Seguridad
- Auth server-side únicamente (supabase.auth.getUser())
- RLS por rol en cada tabla · nunca autorización solo en frontend

## Design tokens (cuando los necesites)
- Primary: #FF6B35 · Dark: #1A1A2E · Font: DM Sans / DM Mono

## Referencias — leer solo cuando necesites
- docs/schema.md → schema completo + RLS policies
- docs/agents.md → subagentes disponibles y cuándo usarlos
- docs/roadmap.md → fases, checklist pendiente
