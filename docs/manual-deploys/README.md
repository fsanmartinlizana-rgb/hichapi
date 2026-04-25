# Manual deploys

Archivos SQL que **NO** son migrations regulares (no tienen timestamp ni se aplican
automáticamente por Supabase CLI). Son scripts puntuales que se corrieron a mano en
producción en algún sprint.

Se mantienen acá como referencia histórica y para deploys manuales en nuevos
ambientes.

| Archivo | Sprint / Fecha | Propósito |
|---|---|---|
| `APPLY_MIGRATIONS_NOW.sql` | Sprint inicial · 2026-04-15 | Bundle de migrations base aplicado al inicio. |
| `APPLY_MIGRATION_048.sql` | Sprint cocina · 2026-04-15 | Migration 048 unbundled para aplicar manualmente. |
| `DEPLOY_SPRINTS_26_30.sql` | Sprints 26–30 | Cambios de mesas (pos_x, pos_y) y layout. |

## Cómo aplicar uno

1. Abre Supabase SQL Editor del proyecto destino.
2. Pega el contenido del archivo.
3. Ejecuta.
4. Verifica que las tablas/columnas/funciones esperadas existan.

> **Importante**: Estos scripts pueden ser idempotentes o no. Antes de correr en
> prod, verifica con `git log <archivo>` cuándo se creó y si ya estuvo aplicado.
