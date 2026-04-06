# Arquitectura de carpetas — HiChapi

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
│   ├── migrations/        # SQL migrations con timestamp
│   └── seed/
└── hichapi-dev-kit/
    ├── CLAUDE.md
    ├── docs/              # Referencias extendidas
    └── skills/            # Claude Code skills
```
