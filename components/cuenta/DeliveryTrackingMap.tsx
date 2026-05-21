'use client'

import { useEffect, useRef } from 'react'
import 'mapbox-gl/dist/mapbox-gl.css'

interface Props {
  lat: number
  lng: number
  label?: string
}

export function DeliveryTrackingMap({ lat, lng, label }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<import('mapbox-gl').Map | null>(null)
  const markerRef = useRef<import('mapbox-gl').Marker | null>(null)
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN

  useEffect(() => {
    if (!token || !containerRef.current) return

    let cancelled = false

    import('mapbox-gl').then(({ default: mapboxgl }) => {
      if (cancelled || !containerRef.current) return

      if (!mapRef.current) {
        mapboxgl.accessToken = token
        mapRef.current = new mapboxgl.Map({
          container: containerRef.current,
          style: 'mapbox://styles/mapbox/dark-v11',
          center: [lng, lat],
          zoom: 14,
          attributionControl: false,
        })
        markerRef.current = new mapboxgl.Marker({ color: '#FF6B35' })
          .setLngLat([lng, lat])
          .addTo(mapRef.current)
      } else {
        mapRef.current.easeTo({ center: [lng, lat], duration: 800 })
        markerRef.current?.setLngLat([lng, lat])
      }
    })

    return () => {
      cancelled = true
    }
  }, [lat, lng, token])

  useEffect(() => {
    return () => {
      mapRef.current?.remove()
      mapRef.current = null
      markerRef.current = null
    }
  }, [])

  if (!token) {
    return (
      <div className="h-48 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white/40 text-sm">
        Mapa no disponible (falta token Mapbox)
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div ref={containerRef} className="h-52 w-full rounded-xl overflow-hidden border border-white/10" />
      {label && <p className="text-white/40 text-xs text-center">{label}</p>}
    </div>
  )
}
