import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  Image,
} from 'react-native'
import MapView, { Marker } from 'react-native-maps'
import { useRoute } from '@react-navigation/native'
import type { RouteProp } from '@react-navigation/native'
import type { CustomerTrackingStackParamList } from '../../types/navigation'
import { supabase } from '../../config/supabase'
import { getTracking } from '../../services/customer/api'
import { DeliveryProgressBar } from '../../components/customer/DeliveryProgressBar'
import { customerStyles } from '../../components/customer/customerStyles'
import { DARK_MAP_STYLE } from '../../utils/theme'
import type { TrackingData } from '../../types/customer'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

type Route = RouteProp<CustomerTrackingStackParamList, 'CustomerTracking'>

export default function CustomerTrackingScreen() {
  const { params } = useRoute<Route>()
  const mapRef = useRef<MapView | null>(null)
  const insets = useSafeAreaInsets()
  const [data, setData] = useState<TrackingData | null>(null)
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const json = await getTracking(params.deliveryOrderId)
      setData(json)
      if (json.last_location) {
        setLocation({ lat: json.last_location.lat, lng: json.last_location.lng })
      }
    } finally {
      setLoading(false)
    }
  }, [params.deliveryOrderId])

  useEffect(() => {
    load()
    const interval = setInterval(load, 30_000)
    return () => clearInterval(interval)
  }, [load])

  useEffect(() => {
    if (!data || data.status !== 'in_transit') return

    const channel = supabase
      .channel(`rider-location-${params.deliveryOrderId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'rider_locations',
          filter: `delivery_order_id=eq.${params.deliveryOrderId}`,
        },
        (payload) => {
          const row = payload.new as { lat: number | string; lng: number | string }
          const lat = Number(row.lat)
          const lng = Number(row.lng)
          if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
            setLocation({ lat, lng })
            mapRef.current?.animateToRegion(
              {
                latitude: lat,
                longitude: lng,
                latitudeDelta: 0.02,
                longitudeDelta: 0.02,
              },
              600,
            )
          }
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [data, params.deliveryOrderId])

  if (loading || !data) {
    return (
      <View style={[customerStyles.screen, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color="#FF6B35" />
      </View>
    )
  }

  const delivered = data.status === 'delivered'
  const showMap = data.status === 'in_transit' && location

  return (
    <View style={{ flex: 1, backgroundColor: '#FAFAFA', paddingTop: insets.top }}>
      <ScrollView style={customerStyles.screen} contentContainerStyle={customerStyles.scroll}>
        <Text style={customerStyles.title}>Seguimiento</Text>
        <Text style={customerStyles.subtitle} numberOfLines={2}>
          {data.delivery_address}
        </Text>

      <View style={[customerStyles.card, { marginTop: 16 }]}>
        <DeliveryProgressBar status={data.status} />
      </View>

      {delivered && (
        <View style={[customerStyles.card, { backgroundColor: '#ECFDF5', borderColor: '#10B981' }]}>
          <Text style={{ color: '#059669', fontWeight: '700', textAlign: 'center' }}>
            ¡Pedido entregado!
          </Text>
        </View>
      )}

      {data.rider && (
        <View style={[customerStyles.card, { flexDirection: 'row', alignItems: 'center', gap: 12 }]}>
          {data.rider.profile_photo_url ? (
            <Image
              source={{ uri: data.rider.profile_photo_url }}
              style={{ width: 48, height: 48, borderRadius: 24 }}
            />
          ) : (
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                backgroundColor: '#F3F4F6',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ fontSize: 24 }}>🛵</Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={customerStyles.label}>Repartidor</Text>
            <Text style={{ fontWeight: '700', fontSize: 16 }}>{data.rider.first_name}</Text>
            {data.status === 'in_transit' && (
              <Text style={{ color: '#6B7280', fontSize: 12, marginTop: 4 }}>
                En camino a tu dirección
              </Text>
            )}
          </View>
        </View>
      )}

      {showMap && (
        <View style={{ height: 220, borderRadius: 12, overflow: 'hidden', marginTop: 12 }}>
          <MapView
            ref={mapRef}
            style={{ flex: 1 }}
            initialRegion={{
              latitude: location.lat,
              longitude: location.lng,
              latitudeDelta: 0.02,
              longitudeDelta: 0.02,
            }}
            customMapStyle={DARK_MAP_STYLE}
            userInterfaceStyle="dark"
          >
            <Marker
              coordinate={{ latitude: location.lat, longitude: location.lng }}
              title={data.rider?.first_name ?? 'Repartidor'}
            >
              <Text style={{ fontSize: 28 }}>🛵</Text>
            </Marker>
          </MapView>
        </View>
      )}

      {data.status === 'in_transit' && !location && (
        <Text style={{ textAlign: 'center', color: '#9CA3AF', marginTop: 16 }}>
          Esperando ubicación del repartidor…
        </Text>
        )}
      </ScrollView>
    </View>
  )
}
