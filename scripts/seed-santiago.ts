/**
 * Seed Santiago restaurants for HiChapi Discovery
 * Run: npx tsx scripts/seed-santiago.ts
 *
 * Requires ADMIN_SEED_KEY in .env.local
 */

const RESTAURANTS = [
  // ── Providencia ──────────────────────────────────────────────────────────
  { name: 'Liguria',               neighborhood: 'Providencia',   cuisine_type: 'Chilena',      price_range: 'medio' as const,   address: 'Av. Providencia 1373' },
  { name: 'Baco',                  neighborhood: 'Providencia',   cuisine_type: 'Francesa',     price_range: 'premium' as const, address: 'Nueva de Lyon 113' },
  { name: 'Patio Bellavista',      neighborhood: 'Bellavista',    cuisine_type: 'Variada',      price_range: 'medio' as const,   address: 'Pío Nono 73' },
  { name: 'El Mesón Nerudiano',    neighborhood: 'Bellavista',    cuisine_type: 'Chilena',      price_range: 'medio' as const,   address: 'Dardignac 0100' },

  // ── Lastarria / Bellas Artes ─────────────────────────────────────────────
  { name: 'Chipe Libre',           neighborhood: 'Lastarria',     cuisine_type: 'Peruana',      price_range: 'medio' as const,   address: 'José Victorino Lastarria 282' },
  { name: 'Emporio La Rosa',       neighborhood: 'Lastarria',     cuisine_type: 'Heladería',    price_range: 'economico' as const, address: 'Merced 291' },
  { name: 'Bocanariz',             neighborhood: 'Lastarria',     cuisine_type: 'Vinos',        price_range: 'premium' as const, address: 'José Victorino Lastarria 276' },

  // ── Ñuñoa ────────────────────────────────────────────────────────────────
  { name: 'La Junta',              neighborhood: 'Ñuñoa',         cuisine_type: 'Bar',          price_range: 'economico' as const, address: 'Irarrázaval 3465' },
  { name: 'El Huerto',             neighborhood: 'Ñuñoa',         cuisine_type: 'Vegetariana',  price_range: 'medio' as const,   address: 'Orrego Luco 054' },
  { name: 'Fuente Mardoqueo',      neighborhood: 'Ñuñoa',        cuisine_type: 'Chilena',      price_range: 'economico' as const, address: 'Plaza Ñuñoa' },

  // ── Centro / Santiago ────────────────────────────────────────────────────
  { name: 'Bar Nacional',          neighborhood: 'Santiago Centro', cuisine_type: 'Chilena',    price_range: 'economico' as const, address: 'Huérfanos 1151' },
  { name: 'Ocean Pacific',         neighborhood: 'Santiago Centro', cuisine_type: 'Sushi',      price_range: 'medio' as const,   address: 'Av. Apoquindo 3502' },
  { name: 'El Rápido',             neighborhood: 'Santiago Centro', cuisine_type: 'Chilena',    price_range: 'economico' as const, address: 'Bandera 347' },

  // ── Las Condes / Vitacura ────────────────────────────────────────────────
  { name: 'Mestizo',               neighborhood: 'Vitacura',      cuisine_type: 'Chilena contemporánea', price_range: 'premium' as const, address: 'Bicentenario 4050' },
  { name: 'Osaka',                 neighborhood: 'Las Condes',    cuisine_type: 'Nikkei',       price_range: 'premium' as const, address: 'Isidora Goyenechea 3000' },
  { name: 'Happening',             neighborhood: 'Vitacura',      cuisine_type: 'Mediterránea', price_range: 'premium' as const, address: 'Av. Apoquindo 3090' },

  // ── Italia / Manuel Montt ────────────────────────────────────────────────
  { name: 'Uncle Fletch',          neighborhood: 'Italia',        cuisine_type: 'Hamburguesas', price_range: 'economico' as const, address: 'Av. Italia 1224' },
  { name: 'La Panchita',           neighborhood: 'Italia',        cuisine_type: 'Mexicana',     price_range: 'economico' as const, address: 'Av. Italia 1050' },
  { name: 'La Piccola Italia',     neighborhood: 'Italia',        cuisine_type: 'Italiana',     price_range: 'medio' as const,   address: 'Av. Italia 998' },

  // ── Recoleta / Patronato ─────────────────────────────────────────────────
  { name: 'Galindo',               neighborhood: 'Recoleta',      cuisine_type: 'Chilena',      price_range: 'economico' as const, address: 'Dardignac 098' },
  { name: 'Sukine',                neighborhood: 'Patronato',     cuisine_type: 'Coreana',      price_range: 'economico' as const, address: 'Patronato 571' },

  // ── Más barrios ──────────────────────────────────────────────────────────
  { name: 'La Mar',                neighborhood: 'Las Condes',    cuisine_type: 'Cebichería',   price_range: 'premium' as const, address: 'Av. Nueva Costanera 3909' },
  { name: 'De Patio',              neighborhood: 'Providencia',   cuisine_type: 'Brunch',       price_range: 'medio' as const,   address: 'Av. Providencia 1670' },
  { name: 'Wonderland',            neighborhood: 'Bellavista',    cuisine_type: 'Cocktails',    price_range: 'medio' as const,   address: 'Dardignac 0142' },
  { name: 'Sarita Colonia',        neighborhood: 'Bellavista',    cuisine_type: 'Peruana',      price_range: 'medio' as const,   address: 'Ernesto Pinto Lagarrigue 236' },
]

async function main() {
  // Load .env.local manually
  const fs = await import('fs')
  const envContent = fs.readFileSync('.env.local', 'utf-8')
  for (const line of envContent.split('\n')) {
    const match = line.match(/^([^#=]+)=(.*)$/)
    if (match) process.env[match[1].trim()] = match[2].trim()
  }

  const baseUrl = 'http://localhost:3000'  // Always seed against local dev
  const adminKey = process.env.ADMIN_SEED_KEY || process.env.ADMIN_SECRET

  if (!adminKey) {
    console.error('❌ ADMIN_SEED_KEY or ADMIN_SECRET not set in .env.local')
    process.exit(1)
  }

  console.log(`🌱 Seeding ${RESTAURANTS.length} restaurants to ${baseUrl}...`)

  const res = await fetch(`${baseUrl}/api/restaurants/seed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      restaurants: RESTAURANTS,
      admin_key: adminKey,
    }),
  })

  const data = await res.json()

  if (!res.ok) {
    console.error('❌ Seed failed:', data)
    process.exit(1)
  }

  console.log('\n📊 Resultado:')
  console.log(`   ✅ Creados:  ${data.summary.created}`)
  console.log(`   ⏭️  Existentes: ${data.summary.existing}`)
  console.log(`   ❌ Errores:  ${data.summary.errors}`)
  console.log(`   📦 Total:    ${data.summary.total}`)

  if (data.summary.errors > 0) {
    console.log('\n⚠️  Errores:')
    data.results
      .filter((r: { status: string }) => r.status === 'error')
      .forEach((r: { name: string; slug: string }) => console.log(`   - ${r.name} (${r.slug})`))
  }

  console.log('\n🎉 Seed completado!')
}

main().catch(console.error)
