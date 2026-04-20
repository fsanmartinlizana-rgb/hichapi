// ── Geofencing helper ───────────────────────────────────────────────────────
// Sprint 6 (2026-04-19).
//
// Haversine distance — suficientemente preciso para distancias <10km en la
// tierra; no hace falta usar una lib externa.

/** Devuelve la distancia en metros entre dos puntos (lat, lng) en grados. */
export function haversineMeters(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const R = 6_371_000 // radio medio de la tierra en metros
  const toRad = (d: number) => (d * Math.PI) / 180
  const φ1 = toRad(lat1)
  const φ2 = toRad(lat2)
  const Δφ = toRad(lat2 - lat1)
  const Δλ = toRad(lng2 - lng1)

  const a = Math.sin(Δφ / 2) ** 2
          + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}
