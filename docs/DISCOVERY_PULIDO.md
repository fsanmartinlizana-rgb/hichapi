# Chapi Discovery — Estado actual y plan de pulido

_Última actualización: 2026-04-22_

> ⚠️ **AVISO 2026-04-27**: Auditoría posterior reveló que partes marcadas como
> "✅" en este doc **no existen en `main`**. Faltan en el branch:
> - Migration `20260422_058_restaurant_candidates.sql` (el slot `058` lo ocupó después
>   `20260423_058_restaurant_print_settings.sql`).
> - Archivos `lib/cities.ts`, `lib/candidates.ts`, `app/admin/candidates/`,
>   `scripts/smoke-sprint1.ts`.
>
> Sólo `lib/landmarks.ts` y `app/api/chat/route.ts` existen. Antes de tomar este
> doc como referencia, revisar `git log` para ver si el sprint candidates fue
> revertido o quedó en otro branch perdido.

Documento operativo para mejorar la sección Discovery (`/buscar`, `/`, `/r/[slug]`)
sin agregar costos. Léelo de arriba abajo: el orden refleja prioridad por impacto.

---

## 1. Estado actual (qué está vivo)

### Backend
| Capa | Archivo | Estado |
|---|---|---|
| Fuente de verdad de ciudades/barrios | `lib/cities.ts` | ✅ Santiago activo. Viña / Concón / Valpo / Concepción registradas como `active:false`. |
| Resolución de zonas + guardrail de alcance | `lib/landmarks.ts` | ✅ `resolveZoneContext()` clasifica `out_of_scope` / `city_inactive` / etc. |
| Chat API con guardrail anti-Rancagua | `app/api/chat/route.ts` | ✅ `SYSTEM_PROMPT` dinámico, no fallback mentiroso, payload con `scope_status` + `fallback_used`. |
| Pipeline de candidatos | `lib/candidates.ts` + `app/api/admin/candidates/*` | ✅ Código listo. ⚠️ Requiere migration `20260422_058_restaurant_candidates.sql`. |
| Panel admin de candidatos | `app/admin/candidates/page.tsx` | ✅ Login + tabs + ingest OSM + enrich Haiku. |
| Search OSM público (NoResultsBanner) | `app/api/search-ondemand/route.ts` | ⚠️ Comportamiento legacy: inserta directo a `restaurants` con `rating=4.0` y "Plato del día / $9.900". No escribe a candidates. |

### Frontend
- Hero + chat + zone chips: ✅
- `OutOfScopeBanner` + `FallbackHint`: ✅ (no rompen diseño)
- `ResultsGrid` + `ResultCard` + `ResultsMap` (con feature flag Mapbox): ✅
- Persistencia en `sessionStorage` para volver atrás sin perder resultados: ✅

### Smoke tests
- `scripts/smoke-sprint1.ts` — 25/25 PASS sobre `resolveZoneContext`.

---

## 2. Lo que se ve raro hoy en producción (deuda visible al usuario)

Cosas que un visitante puede notar y dañan confianza:

1. **"CHAPI SUGIERE: Centolla del sur $24.000"** — el "platillo sugerido" es el ítem **más caro dentro de presupuesto**, no el más relacionado con el query. Para "sin gluten" muestra cualquier ítem con tag `sin gluten`, no necesariamente el mejor match.
2. **Restaurantes con menú placeholder** — los insertados por search-ondemand muestran solo "Plato del día / $9.900". Una card con eso al lado de Osaka (con menú real) se ve incoherente.
3. **`rating: 4.0` fabricado en los OSM** — todos los restaurants nuevos arrancan con 4.0, mismo número repetido.
4. **`cuisine_type` heurístico** — "internacional" cuando OSM no trae nada útil. Genérico.
5. **Sin fotos en muchos restaurants** — `photo_url: null` → la card cae a un placeholder.
6. **`match_reason` poco honesto** — dice "Cocina X en {neighborhood}" usando el barrio del restaurant, no la zona pedida (pre-FallbackHint mostraba esto incluso con fallback de zona).
7. **El mapa requiere `NEXT_PUBLIC_MAPBOX_TOKEN`** — si no está seteado, el botón "Ver en el mapa" no aparece en absoluto.
8. **Hero ocupa 100vh hasta primer search** — en mobile chico (iPhone SE), los chips quedan debajo del fold sin scroll obvio.

---

## 3. Quick wins (1-2 horas c/u, alto impacto visual)

Estos no requieren backend nuevo ni migrations.

### 3.1. `match_reason` con fallback honesto
**Dónde:** `app/api/chat/route.ts` línea ~180.
**Cambio:** cuando `fallback_used === 'dropped_zone'`, el `match_reason` debe decir "{cuisine} en {neighborhood real}" en vez de implicar que es donde el user pidió. (Ya está parcialmente cubierto por `FallbackHint`, pero el texto del card sigue genérico.)

### 3.2. Selección de "Chapi sugiere" más relevante
**Dónde:** `app/api/chat/route.ts` línea ~157-174 (`fetchAndFilter`).
**Cambio:** en vez de `sort by price desc` (más caro primero), priorizar:
1. Items que matchean tags dietarios pedidos (ya pasa por filtro pero el sort no lo usa).
2. Items con foto (`photo_url IS NOT NULL`).
3. Items con descripción no vacía.
4. Recién ahí, ordenar por precio descendente dentro de los empates.

```ts
const score = (item) =>
  (intent.dietary_restrictions?.some(r => item.tags?.includes(r)) ? 100 : 0)
  + (item.photo_url ? 30 : 0)
  + (item.description?.length > 10 ? 10 : 0)
  + (item.price / 1000)  // tiebreaker
```

### 3.3. Esconder badge `4.0` cuando es el rating placeholder
**Dónde:** `components/discovery/ResultCard.tsx`.
**Cambio:** mostrar la estrella + número solo si `restaurant.review_count > 0`. Si es 0, mostrar un chip discreto "Recién agregado" o nada.

### 3.4. Esconder "Plato del día / $9.900" como sugerido
**Dónde:** `app/api/chat/route.ts` `fetchAndFilter`.
**Cambio:** filtrar items con `name === 'Plato del día'` AND `price === 9900` (placeholder firmado) cuando hay otros items disponibles. Si todos los items son placeholder, esconder el bloque "CHAPI SUGIERE" en el card y mostrar solo "Ver menú →".

### 3.5. Skeleton de la primera carga sin parpadeo
**Dónde:** `app/buscar/page.tsx` el rehidratado de `sessionStorage` corre dentro de `useEffect` post-mount → hay un flash de "vacío" antes de pintar resultados persistidos. Mover la lectura inicial al `useState(initial)` con guarda SSR.

### 3.6. Mobile fold del hero
**Dónde:** `app/buscar/page.tsx` línea ~223 — `minHeight: '100vh'` en el hero.
**Cambio:** `min-h-[85vh] sm:min-h-screen` para que en mobile siempre se vean los chips bajo el input sin requerir scroll.

---

## 4. Mediano plazo (necesita migration aplicada)

Una vez aplicada `20260422_058_restaurant_candidates.sql`:

### 4.1. Backfill de enrichment sobre restaurants existentes
- Crear script `scripts/backfill-restaurants-enrichment.ts` que:
  - Trae los ~25 restaurants seed + los OSM-inserted.
  - Genera un candidate sintético con `source='manual'` para cada uno que no esté.
  - Corre el endpoint `/api/admin/candidates/enrich` sobre ellos.
  - Sincroniza `cuisine_type` + `tags` + `description` desde el candidate enriquecido al restaurant.
- Costo estimado: ~25 candidates × USD 0.0003 = **USD 0.0075** total.

### 4.2. Reactivar el dual-write en search-ondemand
El refactor a dual-write quedó como código en `lib/candidates.ts` pero el endpoint público está en versión legacy. Si quieres preservar UX inmediata pero ganar trazabilidad, reaplicar el refactor con `NEXT_PUBLIC_ONDEMAND_AUTOPUBLISH=true` (default) — agrega trazabilidad sin cambiar la experiencia del visitante.

### 4.3. Reemplazar el menú placeholder
Cuando se aprueba un candidate desde el panel:
- Si tiene `description` enriquecida, usarla en el ítem placeholder en vez de "Consultar al restaurante...".
- Idealmente, dejar el restaurant SIN menú hasta que un humano cargue uno → la UI debe manejar "sin menú aún" elegantemente.

---

## 5. Performance

| Área | Estado | Plan |
|---|---|---|
| Chat streaming | OK (Claude Haiku) | Sin cambios. |
| Caché de Claude | `claudeCache` 60min in-memory | Sirve para mismo input. Considerar Redis/KV si se escala a varios serverless instances. |
| Caché de queries | `queryCache` 30min in-memory | Igual que arriba. |
| Map lazy load | Ya con `dynamic(...ssr:false)` | OK. |
| Imágenes restaurants | `<img>` plain | Migrar a `next/image` con `loader` de Supabase Storage cuando haya fotos reales. |

---

## 6. SEO + share

Casi sin trabajo:

- **`/r/[slug]`**: revisar si tiene `generateMetadata` con `title`, `description`, `openGraph.images`. Cada restaurant es una landing potencial.
- **Sitemap**: `app/sitemap.ts` que liste los slugs de restaurants `active:true`. Ayuda al indexing inicial.
- **`robots.txt`**: confirmar que `/admin/*` está bloqueado.

---

## 7. Cosas que NO hacer (anti-patterns que ya descartamos)

- **No agregar Google Places API ahora** — costo USD 17/1000 calls + ToS de cacheo. OSM + enrichment Haiku es el camino bajo costo.
- **No cambiar el copy "todos los restaurantes de Santiago"** — es la promesa de marca. Cuando se active otra ciudad, el copy debe ser dinámico (`getActiveCities()[0]`) en vez de un literal.
- **No exponer `restaurant_candidates` al cliente** — es data interna. RLS ya lo bloquea, mantener así.
- **No mostrar candidates pending al user** — el panel admin es la única UI legítima.

---

## 8. Orden recomendado para los próximos pulidos

1. **Día 1 (sin tocar DB):** quick wins 3.1 → 3.6.
2. **Día 1 tarde:** aplicar migration 058 + verificar panel `/admin/candidates`.
3. **Día 2:** correr ingest OSM en Santiago (ya hay ~25 restaurants seed, agregar ~150 desde OSM).
4. **Día 2 tarde:** correr enrich + aprobar batch desde panel.
5. **Día 3:** backfill enrichment sobre los seed (4.1).
6. **Día 4:** SEO + share (sección 6).
7. **Cuando haya volumen:** activar Viña del Mar (`active: true`) y repetir 2-5.

---

## 9. Checklist antes de mandar tráfico

- [ ] Migration 058 aplicada en producción.
- [ ] `ADMIN_SECRET` con al menos 20 caracteres en `.env.local` de prod.
- [ ] `NEXT_PUBLIC_MAPBOX_TOKEN` seteado o aceptar que el botón mapa no aparezca.
- [ ] Quick win 3.4 aplicado (sin "Plato del día $9.900" como sugerido).
- [ ] Smoke test `/buscar` con: "ramen en Ñuñoa", "vegano en Providencia", "sin gluten en Rancagua" (debe rechazar Rancagua).
- [ ] Verificar que `/admin/candidates` requiera login.
- [ ] `robots.txt` excluye `/admin/*`.
