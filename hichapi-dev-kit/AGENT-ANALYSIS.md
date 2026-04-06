---
name: hichapi-agent-analysis
description: Análisis de agentes del repo VoltAgent/awesome-claude-code-subagents relevantes para HiChapi, y mapeo con el sistema de subagentes personalizado del proyecto.
---

# HiChapi — Análisis de Agentes VoltAgent + Sistema Propio

## Resumen ejecutivo

El repo VoltAgent contiene 100+ subagentes organizados en 10 categorías. Para HiChapi, son relevantes ~15 agentes del repositorio público que se pueden instalar directamente, más 7 agentes custom ya creados específicamente para el proyecto.

---

## Agentes VoltAgent directamente útiles para HiChapi

### 🏗️ Core Development (usar desde Fase 0)

| Agente | URL instalación | Por qué lo necesitas |
|--------|-----------------|---------------------|
| `fullstack-developer` | categories/01-core-development/ | Arquitectura general Next.js 15 + Supabase |
| `backend-architect` | categories/01-core-development/ | API routes, Edge Functions, lógica de servidor |
| `code-reviewer` | categories/01-core-development/ | Review de PRs antes de mergear a main |
| `git-workflow` | categories/01-core-development/ | Convenciones de commits, branches, releases |

### 🔒 Quality & Security (usar en cada PR crítico)

| Agente | Por qué lo necesitas |
|--------|---------------------|
| `security-auditor` (VoltAgent) | Detecta vulnerabilidades generales (complementa el custom) |
| `code-quality-reviewer` | Mantiene calidad del código cuando codeas rápido |
| `test-engineer` | Genera tests para lógica crítica (pagos, auth, pedidos) |

### 📊 Data & AI (usar en Fase 1-2)

| Agente | Por qué lo necesitas |
|--------|---------------------|
| `ai-engineer` | Diseño del sistema de agentes Chapi, prompt engineering |
| `data-analyst` | Análisis de métricas de la plataforma (MRR, retención) |
| `database-architect` (VoltAgent) | Complementa el custom para optimización de queries |

### 🔍 Research & Analysis (usar para go-to-market)

| Agente | Por qué lo necesitas |
|--------|---------------------|
| `competitive-analyst` | Monitorear Rappi, Edenred, nuevos competidores |
| `market-researcher` | Validar pricing, estudiar comportamiento de restaurantes |
| `project-idea-validator` | Validar features antes de construirlas |

### 🛠️ Developer Experience

| Agente | Por qué lo necesitas |
|--------|---------------------|
| `documentation-writer` | README del proyecto, docs de la API para restaurantes |
| `api-designer` | Diseño de la API pública (Fase 3: Data Intelligence) |

---

## Agentes VoltAgent a IGNORAR para HiChapi

| Categoría | Por qué ignorar |
|-----------|-----------------|
| `blockchain-*` | No aplica |
| `ios-developer`, `android-developer` | Stack web primero |
| `ml-engineer` | Usar Claude API directamente, no entrenar modelos propios |
| `devops-*` (Kubernetes, AWS) | Vercel + Supabase manejan infra |
| `azure-*`, `gcp-*` | Stack es Vercel + Supabase |

---

## Sistema de agentes CUSTOM HiChapi (ya creados)

Estos agentes viven en `.claude/agents/` del repo de HiChapi y son específicos del negocio:

```
.claude/agents/
├── db-architect.md          ← Schema HiChapi, RLS, pgvector, PostGIS
├── chapi-chat-builder.md    ← Claude API, streaming, intent extraction
├── discovery-builder.md     ← Landing, búsqueda semántica, design system
├── restaurant-panel-dev.md  ← Panel restaurante, roles, comandas realtime
├── payment-integrator.md    ← Stripe, split de cuenta, webhooks
├── security-auditor.md      ← RLS, Ley 19.628, multi-tenant isolation
├── ops-analyst.md           ← Reportes diarios, geofencing, crons
└── nextjs-architect.md      ← App Router, SSR/SSG, performance, SEO
```

---

## Cómo instalar agentes VoltAgent en el proyecto

```bash
# Opción 1: Script interactivo (recomendado)
curl -sO https://raw.githubusercontent.com/VoltAgent/awesome-claude-code-subagents/main/install-agents.sh
chmod +x install-agents.sh
./install-agents.sh
# Seleccionar: Core Development, Quality Security, Data AI

# Opción 2: Manual (agente específico)
curl -s https://raw.githubusercontent.com/VoltAgent/awesome-claude-code-subagents/main/categories/04-quality-security/security-auditor.md \
  -o .claude/agents/voltagent-security-auditor.md

# Opción 3: Agent installer desde Claude Code
# En Claude Code: "Use the agent-installer to install code-reviewer and test-engineer"
```

---

## Estrategia de uso — cuándo activar cada agente

### Fase 0 (Setup) — Semanas 1-2
- `nextjs-architect` → scaffold del proyecto
- `db-architect` → schema inicial + RLS
- `fullstack-developer` (VoltAgent) → configuración de Vercel, variables de entorno

### Fase 1 (Discovery) — Semanas 3-8
- `chapi-chat-builder` → flujo de chat principal
- `discovery-builder` → landing + cards + mapa
- `security-auditor` (custom) → antes de ir live
- `test-engineer` (VoltAgent) → tests de la búsqueda semántica

### Fase 2A (Chapi Plus) — Semanas 7-14
- `ops-analyst` → geofencing + crons + notificaciones
- `payment-integrator` → cuando se integre billing de campañas

### Fase 2B (at Table) — Semanas 9-16
- `restaurant-panel-dev` → panel completo
- `payment-integrator` → split de cuenta con Stripe

### Ongoing (todas las fases)
- `code-reviewer` (VoltAgent) → en cada PR
- `competitive-analyst` (VoltAgent) → mensual
- `ops-analyst` → cuando ajustes reportes o crons

---

## Skills nuevas identificadas para el proyecto

Además de los agentes, se crearon estas skills específicas de HiChapi:

| Skill | Archivo | Para qué |
|-------|---------|----------|
| `restaurant-onboarding` | `skills/restaurant-onboarding/SKILL.md` | Scripts de ventas, emails, kit de bienvenida |
| `hichapi-schema` | `skills/hichapi-schema/SKILL.md` | Referencia rápida del schema de DB |

---

## Principio rector del sistema de agentes

> "Cada agente debe existir para mover una métrica."

| Agente | Métrica que mueve |
|--------|------------------|
| `chapi-chat-builder` | Conversión búsqueda → reserva |
| `discovery-builder` | Tráfico orgánico (SEO) + retención |
| `restaurant-panel-dev` | Retención de restaurantes (churn) |
| `payment-integrator` | MRR |
| `ops-analyst` | NPS restaurantes + costo de infra |
| `security-auditor` | Confianza + compliance legal |
| `db-architect` | Performance + escalabilidad |
| `nextjs-architect` | Velocidad de desarrollo + UX |
