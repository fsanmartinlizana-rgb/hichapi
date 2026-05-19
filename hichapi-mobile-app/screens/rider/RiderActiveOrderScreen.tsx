/**
 * screens/rider/RiderActiveOrderScreen.tsx
 *
 * Active order screen — map, route, GPS tracking, status transitions.
 * Requirements: 3.2, 3.4, 3.5, 3.6, 3.7, 3.8, 5.2, 5.3, 5.4
 */
import React, { useState, useEffect, useRef } from 'react'
import {
  View, Text, TouchableOpacity, ScrollView,
  StyleSheet, Alert, ActivityIndicator, SafeAreaView, Linking, Platform,
} from 'react-native'
import MapView, { Marker, Polyline } from 'react-native-maps'
import { DARK_MAP_STYLE } from '../../utils/theme'
import { updateDeliveryOrderStatus, calculateRoute } from '../../services/rider/api'
import { startGpsTracking, stopGpsTracking, getCurrentPosition } from '../../services/rider/geolocation'
import type { DeliveryOrder, PlannedRoute, FailureReason, VehicleType } from '../../../lib/delivery/types'

const FAILURE_REASONS: { value: FailureReason; label: string }[] = [
  { value: 'customer_not_found',  label: 'Cliente no encontrado' },
  { value: 'address_incorrect',   label: 'Dirección incorrecta' },
  { value: 'refused_delivery',    label: 'Cliente rechazó el pedido' },
  { value: 'vehicle_breakdown',   label: 'Falla del vehículo' },
  { value: 'other',               label: 'Otro motivo' },
]

interface Props {
  order: DeliveryOrder
  token: string
  vehicleType: VehicleType
  onOrderCompleted: () => void
  onStatusChanged?: (updated: DeliveryOrder) => void
  onBack?: () => void
}

export default function RiderActiveOrderScreen({ order, token, vehicleType, onOrderCompleted, onStatusChanged, onBack }: Props) {
  const [currentOrder, setCurrentOrder] = useState<DeliveryOrder>(order)
  const [route, setRoute] = useState<PlannedRoute | null>(null)
  const [routeFallback, setRouteFallback] = useState(false)
  const [briefing, setBriefing] = useState<string>('')
  const [loadingRoute, setLoadingRoute] = useState(true)
  const [showFailurePicker, setShowFailurePicker] = useState(false)
  const [transitioning, setTransitioning] = useState(false)
  const routeRefreshRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const mapRef = useRef<MapView | null>(null)

  // Load initial route on mount
  useEffect(() => {
    loadRoute()
    return () => {
      stopGpsTracking()
      if (routeRefreshRef.current) clearInterval(routeRefreshRef.current)
    }
  }, [])

  useEffect(() => {
    if (route?.waypoints && mapRef.current) {
      const coords = [
        { latitude: route.waypoints.origin.lat, longitude: route.waypoints.origin.lng },
        { latitude: route.waypoints.pickup.lat, longitude: route.waypoints.pickup.lng },
        { latitude: route.waypoints.delivery.lat, longitude: route.waypoints.delivery.lng },
      ]
      const timer = setTimeout(() => {
        mapRef.current?.fitToCoordinates(coords, {
          edgePadding: { top: 40, right: 40, bottom: 40, left: 40 },
          animated: true,
        })
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [route])

  const getPolylineCoords = () => {
    if (!route) return []
    if (route.polyline && route.polyline !== 'mock_polyline') {
      try {
        const decoded = decodePolyline(route.polyline)
        if (decoded.length > 0) return decoded
      } catch (err) {
        console.warn('Polyline decoding failed:', err)
      }
    }
    if (route.waypoints) {
      return [
        { latitude: route.waypoints.origin.lat, longitude: route.waypoints.origin.lng },
        { latitude: route.waypoints.pickup.lat, longitude: route.waypoints.pickup.lng },
        { latitude: route.waypoints.delivery.lat, longitude: route.waypoints.delivery.lng },
      ]
    }
    return []
  }

  // Strip apartment/sector/floor suffixes that confuse navigation apps
  // e.g. "Rodolfo Walter 668 Mirador 2" → "Rodolfo Walter 668"
  function cleanAddress(address: string): string {
    return address
      .replace(/\s+(mirador|depto|dpto|block|bloque|villa|piso|piso|local|of\.|apto|apto\.|apart|apart\.)\s+\S+.*/i, '')
      .trim()
  }

  // Open navigation in Waze, Google Maps, or Apple Maps (routes TO the address)
  function openInApp(app: 'waze' | 'google' | 'apple', address: string) {
    const dest = encodeURIComponent(`${cleanAddress(address)}, Ovalle, Chile`)
    const urls: Record<string, [string, string]> = {
      // daddr = destination address → opens navigation mode, not just a pin
      waze:   [`waze://?q=${dest}&navigate=yes`,                                        `https://waze.com/ul?q=${dest}&navigate=yes`],
      google: [`comgooglemaps://?daddr=${dest}&directionsmode=driving`,                 `https://maps.google.com/?daddr=${dest}&directionsmode=driving`],
      apple:  [`maps://?daddr=${dest}`,                                                 `https://maps.apple.com/?daddr=${dest}`],
    }
    const [native, web] = urls[app]
    Linking.canOpenURL(native).then(can => Linking.openURL(can ? native : web))
  }

  useEffect(() => {
    if (currentOrder.status === 'picked_up' || currentOrder.status === 'in_transit') {
      startGpsTracking(currentOrder.id, token).catch(console.warn)
      // Recalculate route every 2 minutes while in_transit
      routeRefreshRef.current = setInterval(loadRoute, 2 * 60 * 1000)
    } else {
      stopGpsTracking()
      if (routeRefreshRef.current) {
        clearInterval(routeRefreshRef.current)
        routeRefreshRef.current = null
      }
    }
  }, [currentOrder.status])

  async function loadRoute() {
    setLoadingRoute(true)
    try {
      const pos = await getCurrentPosition()
      if (!pos) return
      const result = await calculateRoute(
        token,
        pos,
        currentOrder.pickup_address,
        currentOrder.delivery_address,
        vehicleType,
        true,
      )
      setRoute(result.route)
      setRouteFallback(result.fallback)
      if (result.briefing) setBriefing(result.briefing)
    } catch (err: any) {
      console.warn('[loadRoute] error:', err.message || err)
      setRouteFallback(true)
    } finally {
      setLoadingRoute(false)
    }
  }

  async function transition(newStatus: string, failureReason?: string) {
    setTransitioning(true)
    try {
      const updated = await updateDeliveryOrderStatus(token, currentOrder.id, newStatus, failureReason)
      setCurrentOrder(updated)
      onStatusChanged?.(updated)
      if (newStatus === 'delivered' || newStatus === 'failed' || newStatus === 'cancelled') {
        onOrderCompleted()
      }
    } catch (err: any) {
      Alert.alert('Error', err.message)
    } finally {
      setTransitioning(false)
    }
  }

  function handleFail(reason: FailureReason) {
    setShowFailurePicker(false)
    transition('failed', reason)
  }

  const etaPickup   = route?.eta_pickup   ? new Date(route.eta_pickup).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }) : '—'
  const etaDelivery = route?.eta_delivery ? new Date(route.eta_delivery).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }) : '—'

  // Which address to navigate to based on current status
  const navAddress = (currentOrder.status === 'picked_up' || currentOrder.status === 'in_transit')
    ? currentOrder.delivery_address
    : currentOrder.pickup_address
  const navLabel = (currentOrder.status === 'picked_up' || currentOrder.status === 'in_transit')
    ? '🏠 Entrega'
    : '📍 Recogida'

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* ── Fixed header ── */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          {onBack && (
            <TouchableOpacity style={styles.backBtn} onPress={onBack}>
              <Text style={styles.backBtnText}>←</Text>
            </TouchableOpacity>
          )}
          <Text style={styles.title}>Pedido activo</Text>
        </View>
        <View style={styles.statusBadge}>
          <Text style={styles.statusText}>{currentOrder.status.replace('_', ' ')}</Text>
        </View>
      </View>

      {/* Map Section (Fixed height) */}
      {route?.waypoints && (
        <View style={styles.mapContainer}>
          <MapView
            ref={mapRef}
            style={styles.map}
            initialRegion={{
              latitude: route.waypoints.pickup.lat,
              longitude: route.waypoints.pickup.lng,
              latitudeDelta: 0.02,
              longitudeDelta: 0.02,
            }}
            showsUserLocation={true}
            userInterfaceStyle="dark"
            customMapStyle={DARK_MAP_STYLE}
          >
            {getPolylineCoords().length > 0 && (
              <Polyline
                coordinates={getPolylineCoords()}
                strokeColor="#FF6B35"
                strokeWidth={4}
              />
            )}

            {/* Rider Position */}
            <Marker
              coordinate={{ latitude: route.waypoints.origin.lat, longitude: route.waypoints.origin.lng }}
              title="Tú"
              description="Tu ubicación de inicio"
            >
              <View style={styles.riderMarker}>
                <Text style={styles.markerEmoji}>🛵</Text>
              </View>
            </Marker>

            {/* Pickup */}
            <Marker
              coordinate={{ latitude: route.waypoints.pickup.lat, longitude: route.waypoints.pickup.lng }}
              title="Recogida"
              description={currentOrder.pickup_address}
            >
              <View style={styles.pickupMarker}>
                <Text style={styles.markerEmoji}>🍔</Text>
              </View>
            </Marker>

            {/* Delivery */}
            <Marker
              coordinate={{ latitude: route.waypoints.delivery.lat, longitude: route.waypoints.delivery.lng }}
              title="Entrega"
              description={currentOrder.delivery_address}
            >
              <View style={styles.deliveryMarker}>
                <Text style={styles.markerEmoji}>🏠</Text>
              </View>
            </Marker>
          </MapView>
        </View>
      )}

      {/* ── Scrollable content ── */}
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>

        {/* Navigation card */}
        <View style={styles.navCard}>
          <Text style={styles.navCardTitle}>🧭 Navegar</Text>

          {/* Row: Pickup */}
          <View style={styles.navRow}>
            <View style={styles.navRowHeader}>
              <View style={[styles.navRowDot, { backgroundColor: '#22C55E' }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.navRowLabel}>Recogida</Text>
                <Text style={styles.navRowAddr} numberOfLines={1}>{currentOrder.pickup_address}</Text>
              </View>
            </View>
            <View style={styles.navAppRow}>
              <TouchableOpacity style={styles.navAppBtn} onPress={() => openInApp('waze', currentOrder.pickup_address)}>
                <Text style={styles.navAppIcon}>🚗</Text>
                <View style={[styles.navAppPill, { backgroundColor: '#00BFFF' }]}>
                  <Text style={styles.navAppPillText}>Waze</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity style={styles.navAppBtn} onPress={() => openInApp('google', currentOrder.pickup_address)}>
                <Text style={styles.navAppIcon}>🗺️</Text>
                <View style={[styles.navAppPill, { backgroundColor: '#4285F4' }]}>
                  <Text style={styles.navAppPillText}>GMaps</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity style={styles.navAppBtn} onPress={() => openInApp('apple', currentOrder.pickup_address)}>
                <Text style={styles.navAppIcon}>🍏</Text>
                <View style={[styles.navAppPill, { backgroundColor: '#444' }]}>
                  <Text style={styles.navAppPillText}>Maps</Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.navDivider} />

          {/* Row: Delivery */}
          <View style={styles.navRow}>
            <View style={styles.navRowHeader}>
              <View style={[styles.navRowDot, { backgroundColor: '#FF6B35' }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.navRowLabel}>Entrega al cliente</Text>
                <Text style={styles.navRowAddr} numberOfLines={1}>{currentOrder.delivery_address}</Text>
              </View>
              {route && (
                <View style={[styles.navCardStats, routeFallback && styles.navCardStatsFallback]}>
                  {routeFallback && <Text style={styles.navStatApprox}>~</Text>}
                  <Text style={[styles.navStatValue, routeFallback && styles.navStatValueFallback]}>{route.distance_km.toFixed(1)}</Text>
                  <Text style={styles.navStatUnit}>km</Text>
                  <View style={styles.navStatDiv} />
                  <Text style={[styles.navStatValue, routeFallback && styles.navStatValueFallback]}>{route.duration_minutes}</Text>
                  <Text style={styles.navStatUnit}>min</Text>
                </View>
              )}
            </View>
            <View style={styles.navAppRow}>
              <TouchableOpacity style={styles.navAppBtn} onPress={() => openInApp('waze', currentOrder.delivery_address)}>
                <Text style={styles.navAppIcon}>🚗</Text>
                <View style={[styles.navAppPill, { backgroundColor: '#00BFFF' }]}>
                  <Text style={styles.navAppPillText}>Waze</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity style={styles.navAppBtn} onPress={() => openInApp('google', currentOrder.delivery_address)}>
                <Text style={styles.navAppIcon}>🗺️</Text>
                <View style={[styles.navAppPill, { backgroundColor: '#4285F4' }]}>
                  <Text style={styles.navAppPillText}>GMaps</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity style={styles.navAppBtn} onPress={() => openInApp('apple', currentOrder.delivery_address)}>
                <Text style={styles.navAppIcon}>🍏</Text>
                <View style={[styles.navAppPill, { backgroundColor: '#444' }]}>
                  <Text style={styles.navAppPillText}>Maps</Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Client */}
        <View style={styles.card}>
          <Text style={styles.label}>Cliente</Text>
          <Text style={styles.value}>{currentOrder.client_name}</Text>
          <Text style={styles.subValue}>{currentOrder.client_phone}</Text>
        </View>

        {/* Addresses */}
        <View style={styles.card}>
          <Text style={styles.label}>📍 Recogida</Text>
          <Text style={styles.value}>{currentOrder.pickup_address}</Text>
          <Text style={[styles.label, { marginTop: 12 }]}>🏠 Entrega</Text>
          <Text style={styles.value}>{currentOrder.delivery_address}</Text>
        </View>

        {/* ETA row */}
        {route && (
          <View style={styles.card}>
            <View style={styles.etaRow}>
              <View style={styles.etaItem}>
                <Text style={styles.label}>ETA recogida</Text>
                <Text style={styles.etaValue}>{etaPickup}</Text>
              </View>
              <View style={styles.etaItem}>
                <Text style={styles.label}>ETA entrega</Text>
                <Text style={styles.etaValue}>{etaDelivery}</Text>
              </View>
              <View style={styles.etaItem}>
                <Text style={styles.label}>Distancia</Text>
                <Text style={styles.etaValue}>{route.distance_km.toFixed(1)} km</Text>
              </View>
            </View>
            {briefing ? <Text style={styles.briefing}>{briefing}</Text> : null}
            {route.steps.slice(0, 5).map((step, i) => (
              <Text key={i} style={styles.step}>→ {step.instruction}</Text>
            ))}
            {route.steps.length > 5 && (
              <Text style={styles.subValue}>+{route.steps.length - 5} pasos más</Text>
            )}
          </View>
        )}

        {/* Fee */}
        <View style={styles.card}>
          <Text style={styles.label}>Tu ganancia</Text>
          <Text style={styles.feeValue}>
            ${(currentOrder.delivery_fee_clp ?? 0).toLocaleString('es-CL')} CLP
          </Text>
        </View>

        {/* Action buttons */}
        <View style={styles.actions}>
          {currentOrder.status === 'assigned' && (
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={() => transition('picked_up')}
              disabled={transitioning}
            >
              <Text style={styles.primaryBtnText}>
                {transitioning ? 'Procesando…' : '✓ Pedido recogido'}
              </Text>
            </TouchableOpacity>
          )}
          {(currentOrder.status === 'picked_up' || currentOrder.status === 'in_transit') && (
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={() => transition('delivered')}
              disabled={transitioning}
            >
              <Text style={styles.primaryBtnText}>
                {transitioning ? 'Procesando…' : '✓ Pedido entregado'}
              </Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.dangerBtn}
            onPress={() => setShowFailurePicker(true)}
            disabled={transitioning}
          >
            <Text style={styles.dangerBtnText}>Reportar problema</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Failure reason picker — absolute overlay over the whole screen */}
      {showFailurePicker && (
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerCard}>
            <Text style={styles.pickerTitle}>¿Por qué no pudiste entregar?</Text>
            {FAILURE_REASONS.map(({ value, label }) => (
              <TouchableOpacity
                key={value}
                style={styles.pickerOption}
                onPress={() => handleFail(value)}
              >
                <Text style={styles.pickerOptionText}>{label}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={styles.pickerCancel}
              onPress={() => setShowFailurePicker(false)}
            >
              <Text style={styles.pickerCancelText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
  )
}

function decodePolyline(encoded: string): { latitude: number; longitude: number }[] {
  if (encoded === 'mock_polyline') return []
  const points: { latitude: number; longitude: number }[] = []
  let index = 0, len = encoded.length
  let lat = 0, lng = 0

  while (index < len) {
    let b, shift = 0, result = 0
    do {
      b = encoded.charCodeAt(index++) - 63
      result |= (b & 0x1f) << shift
      shift += 5
    } while (b >= 0x20)
    const dlat = ((result & 1) ? ~(result >> 1) : (result >> 1))
    lat += dlat

    shift = 0
    result = 0
    do {
      b = encoded.charCodeAt(index++) - 63
      result |= (b & 0x1f) << shift
      shift += 5
    } while (b >= 0x20)
    const dlng = ((result & 1) ? ~(result >> 1) : (result >> 1))
    lng += dlng

    points.push({ latitude: lat / 1E5, longitude: lng / 1E5 })
  }
  return points
}

const styles = StyleSheet.create({
  safeArea:             { flex: 1, backgroundColor: '#0A0A14' },
  header:               { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  headerLeft:           { flexDirection: 'row', alignItems: 'center', gap: 10 },
  backBtn:              { backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 20, width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  backBtnText:          { color: '#fff', fontSize: 18, lineHeight: 22 },
  title:                { color: '#fff', fontSize: 20, fontWeight: '700' },
  statusBadge:          { backgroundColor: 'rgba(255,107,53,0.2)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusText:           { color: '#FF6B35', fontSize: 12, fontWeight: '600', textTransform: 'capitalize' },
  // Map section (fixed, outside ScrollView)
  mapContainer:         { width: '100%', height: 260, borderBottomWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  map:                  { flex: 1 },
  riderMarker:          { backgroundColor: '#3B82F6', padding: 6, borderRadius: 20, borderWidth: 2, borderColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 2, elevation: 3 },
  pickupMarker:         { backgroundColor: '#22C55E', padding: 6, borderRadius: 20, borderWidth: 2, borderColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 2, elevation: 3 },
  deliveryMarker:       { backgroundColor: '#EF4444', padding: 6, borderRadius: 20, borderWidth: 2, borderColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 2, elevation: 3 },
  markerEmoji:          { fontSize: 16 },
  // Scrollable details
  scroll:               { flex: 1 },
  scrollContent:        { padding: 16, paddingBottom: 40 },
  // Premium navigation card
  navCard:              { backgroundColor: 'rgba(255,107,53,0.07)', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(255,107,53,0.2)' },
  navCardTitle:         { color: '#fff', fontSize: 13, fontWeight: '700', marginBottom: 14, letterSpacing: 0.3 },
  navRow:               { gap: 10 },
  navRowHeader:         { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  navRowDot:            { width: 10, height: 10, borderRadius: 5, marginTop: 2 },
  navRowLabel:          { color: 'rgba(255,255,255,0.45)', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.7 },
  navRowAddr:           { color: '#fff', fontSize: 13, fontWeight: '600', marginTop: 1 },
  navDivider:           { height: 1, backgroundColor: 'rgba(255,255,255,0.07)', marginVertical: 14 },
  navCardStats:         { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(255,107,53,0.15)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5 },
  navCardStatsFallback: { backgroundColor: 'rgba(255,255,255,0.06)' },
  navStatApprox:        { color: 'rgba(255,255,255,0.3)', fontSize: 9, marginRight: 1 },
  navStatValue:         { color: '#FF6B35', fontSize: 14, fontWeight: '800' },
  navStatValueFallback: { color: 'rgba(255,255,255,0.35)' },
  navStatUnit:          { color: 'rgba(255,255,255,0.4)', fontSize: 9, marginTop: 2 },
  navStatDiv:           { width: 1, height: 12, backgroundColor: 'rgba(255,107,53,0.3)', marginHorizontal: 3 },
  navAppRow:            { flexDirection: 'row', gap: 8 },
  navAppBtn:            { flex: 1, alignItems: 'center', gap: 5 },
  navAppIcon:           { fontSize: 22 },
  navAppPill:           { width: '100%', borderRadius: 8, paddingVertical: 6, alignItems: 'center' },
  navAppPillText:       { color: '#fff', fontSize: 11, fontWeight: '700' },
  // Order info cards
  card:                 { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  warningCard:          { borderColor: 'rgba(245,158,11,0.3)', backgroundColor: 'rgba(245,158,11,0.08)' },
  warningText:          { color: '#F59E0B', fontSize: 14, fontWeight: '600', marginBottom: 4 },
  label:                { color: 'rgba(255,255,255,0.4)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  value:                { color: '#fff', fontSize: 14 },
  subValue:             { color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 2 },
  etaRow:               { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  etaItem:              { flex: 1, alignItems: 'center' },
  etaValue:             { color: '#FF6B35', fontSize: 18, fontWeight: '700' },
  briefing:             { color: 'rgba(255,255,255,0.7)', fontSize: 13, fontStyle: 'italic', marginBottom: 12, lineHeight: 20 },
  step:                 { color: 'rgba(255,255,255,0.6)', fontSize: 12, marginBottom: 4 },
  feeValue:             { color: '#4ADE80', fontSize: 24, fontWeight: '700' },
  actions:              { gap: 10 },
  primaryBtn:           { backgroundColor: '#FF6B35', borderRadius: 12, padding: 16, alignItems: 'center' },
  primaryBtnText:       { color: '#fff', fontSize: 16, fontWeight: '700' },
  dangerBtn:            { backgroundColor: 'rgba(239,68,68,0.15)', borderRadius: 12, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)' },
  dangerBtnText:        { color: '#EF4444', fontSize: 14, fontWeight: '600' },
  // Failure picker overlay
  pickerOverlay:        { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  pickerCard:           { backgroundColor: '#1A1A2E', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  pickerTitle:          { color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 16 },
  pickerOption:         { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)' },
  pickerOptionText:     { color: '#fff', fontSize: 15 },
  pickerCancel:         { paddingVertical: 14, alignItems: 'center' },
  pickerCancelText:     { color: 'rgba(255,255,255,0.4)', fontSize: 14 },
})

