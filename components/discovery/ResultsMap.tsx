'use client'

import { useEffect, useRef, memo } from 'react'
import 'mapbox-gl/dist/mapbox-gl.css'
import { RestaurantResult } from '@/lib/types'

const BRAND = '#FF6B35'
const DARK  = '#1A1A2E'

// ─── Rule 9: Simple in-memory load counter ────────────────────────────────────
let mapLoadCount = 0

interface ResultsMapProps {
  results: RestaurantResult[]
}

// ─── Rule 2: Wrapped in React.memo to prevent re-renders on parent updates ────
export const ResultsMap = memo(function ResultsMap({ results }: ResultsMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const mapRef       = useRef<any>(null)
  const token        = process.env.NEXT_PUBLIC_MAPBOX_TOKEN

  useEffect(() => {
    if (!token || !mapContainer.current || mapRef.current) return

    const validResults = results.filter(r => r.restaurant.lat && r.restaurant.lng)
    if (validResults.length === 0) return

    // ─── Rule 9: Track map loads ───────────────────────────────────────────
    mapLoadCount++
    if (typeof window !== 'undefined') {
      const prev = parseInt(sessionStorage.getItem('chapi_map_loads') ?? '0')
      sessionStorage.setItem('chapi_map_loads', String(prev + 1))
    }

    const avgLat = validResults.reduce((s, r) => s + r.restaurant.lat, 0) / validResults.length
    const avgLng = validResults.reduce((s, r) => s + r.restaurant.lng, 0) / validResults.length

    import('mapbox-gl').then(({ default: mapboxgl }) => {
      if (!mapContainer.current || mapRef.current) return

      mapboxgl.accessToken = token

      const map = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/light-v11',
        center: [avgLng, avgLat],
        zoom: 13,
        trackResize: false,
      })

      mapRef.current = map
      map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right')

      map.on('load', () => {
        map.resize()

        validResults.forEach((result, i) => {
          const { restaurant } = result

          // ── Card-style marker ──────────────────────────────────────────
          // Outer wrapper: flex column so the triangle is IN the normal flow.
          // anchor:'bottom' will then place the triangle tip exactly on the coordinate.
          const el = document.createElement('div')
          el.setAttribute('aria-label', restaurant.name)
          el.setAttribute('role', 'button')
          el.setAttribute('tabindex', '0')
          el.style.cssText = [
            'display:flex',
            'flex-direction:column',
            'align-items:center',
            'cursor:pointer',
            'user-select:none',
          ].join(';')

          // Truncate long names
          const shortName = restaurant.name.length > 17
            ? restaurant.name.slice(0, 15) + '…'
            : restaurant.name

          // Format price for popup
          const priceStr = result.suggested_dish
            ? new Intl.NumberFormat('es-CL', {
                style: 'currency', currency: 'CLP', minimumFractionDigits: 0,
              }).format(result.suggested_dish.price)
            : ''

          // Pill card (the visible label)
          const card = document.createElement('div')
          card.style.cssText = [
            'display:inline-flex',
            'align-items:center',
            'gap:6px',
            'background:white',
            'border-radius:999px',
            'padding:5px 11px 5px 5px',
            'box-shadow:0 3px 14px rgba(0,0,0,0.18)',
            'border:1.5px solid #f0f0ee',
            'white-space:nowrap',
            `font-family:DM Sans,system-ui,sans-serif`,
            'transition:transform 0.15s ease, box-shadow 0.15s ease',
          ].join(';')

          // Number badge (orange circle)
          const badge = document.createElement('span')
          badge.textContent = String(i + 1)
          badge.style.cssText = [
            'display:inline-flex',
            'align-items:center',
            'justify-content:center',
            'width:22px',
            'height:22px',
            'border-radius:50%',
            `background:${BRAND}`,
            'color:white',
            'font-size:11px',
            'font-weight:700',
            'flex-shrink:0',
            'line-height:1',
          ].join(';')

          // Restaurant name label
          const nameEl = document.createElement('span')
          nameEl.textContent = shortName
          nameEl.style.cssText = [
            'font-size:12px',
            'font-weight:600',
            `color:${DARK}`,
            'line-height:1',
          ].join(';')

          card.appendChild(badge)
          card.appendChild(nameEl)

          // Triangle pointer — IN the flow (flex child), so its bottom edge
          // becomes the true bottom of the element that Mapbox anchors to.
          const triangle = document.createElement('div')
          triangle.style.cssText = [
            'width:0',
            'height:0',
            'border-left:7px solid transparent',
            'border-right:7px solid transparent',
            'border-top:8px solid white',
            'filter:drop-shadow(0 2px 1px rgba(0,0,0,0.10))',
            'flex-shrink:0',
          ].join(';')

          el.appendChild(card)
          el.appendChild(triangle)

          // Hover animation on the card (not the wrapper, so triangle stays put)
          el.addEventListener('mouseenter', () => {
            card.style.transform  = 'scale(1.06) translateY(-2px)'
            card.style.boxShadow  = '0 6px 20px rgba(0,0,0,0.22)'
          })
          el.addEventListener('mouseleave', () => {
            card.style.transform  = 'scale(1)'
            card.style.boxShadow  = '0 3px 14px rgba(0,0,0,0.18)'
          })

          // Popup with dish details
          const popup = new mapboxgl.Popup({
            offset: [0, -10],   // offset from anchor point
            closeButton: false,
            maxWidth: '220px',
            className: 'chapi-popup',
          }).setHTML(`
            <div style="font-family:DM Sans,system-ui,sans-serif;padding:4px 2px">
              <p style="margin:0 0 2px;font-weight:700;font-size:13px;color:${DARK}">
                ${restaurant.name}
              </p>
              <p style="margin:0 0 6px;font-size:11px;color:#999">
                ${restaurant.neighborhood} · ⭐ ${restaurant.rating.toFixed(1)}
              </p>
              ${result.suggested_dish ? `
                <div style="background:#FAFAF8;border-radius:8px;padding:8px">
                  <p style="margin:0 0 2px;font-size:10px;color:#aaa;text-transform:uppercase;letter-spacing:0.04em;font-weight:600">
                    Chapi sugiere
                  </p>
                  <p style="margin:0 0 4px;font-size:12px;font-style:italic;color:#444">
                    ${result.suggested_dish.name}
                  </p>
                  <p style="margin:0;font-size:13px;font-weight:700;color:${BRAND}">
                    ${priceStr}
                  </p>
                </div>
              ` : ''}
            </div>
          `)

          // anchor:'bottom' — the triangle tip (bottom of the flex column) sits
          // exactly on the restaurant's coordinate. No offset needed.
          new mapboxgl.Marker({ element: el, anchor: 'bottom' })
            .setLngLat([restaurant.lng, restaurant.lat])
            .setPopup(popup)
            .addTo(map)
        })

        // Fit all markers with a small delay so DOM is ready
        setTimeout(() => {
          if (validResults.length === 1) {
            map.flyTo({
              center: [validResults[0].restaurant.lng, validResults[0].restaurant.lat],
              zoom: 15,
              duration: 800,
            })
          } else {
            const bounds = validResults.reduce(
              (b, r) => b.extend([r.restaurant.lng, r.restaurant.lat]),
              new mapboxgl.LngLatBounds(
                [validResults[0].restaurant.lng, validResults[0].restaurant.lat],
                [validResults[0].restaurant.lng, validResults[0].restaurant.lat],
              )
            )
            map.fitBounds(bounds, { padding: 80, maxZoom: 15, duration: 800 })
          }
        }, 120)
      })
    })

    return () => {
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!token) return null

  return (
    <>
      {/* Inline style to clean up default Mapbox popup chrome */}
      <style>{`
        .chapi-popup .mapboxgl-popup-content {
          border-radius: 14px;
          padding: 12px 14px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.13);
          border: 1px solid #f0f0ee;
        }
        .chapi-popup .mapboxgl-popup-tip { display: none; }
      `}</style>

      <div
        ref={mapContainer}
        className="rounded-2xl overflow-hidden border border-neutral-100 shadow-sm w-full"
        style={{ height: '320px' }}
        role="region"
        aria-label="Mapa de restaurantes"
      />
    </>
  )
})
