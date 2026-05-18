/**
 * screens/rider/RiderHeatMapScreen.tsx
 *
 * Heat map screen — demand visualization with time/day filters and interactive MapView.
 * Requirements: 4.1, 4.3, 4.4, 4.5, 4.6
 */
import React, { useState, useEffect } from 'react'
import {
  View, Text, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator,
} from 'react-native'
import MapView, { Marker, Circle } from 'react-native-maps'
import { getHeatMap } from '../../services/rider/api'
import { getCurrentPosition } from '../../services/rider/geolocation'
import type { HeatMapCell, TimeOfDay } from '../../../lib/delivery/types'

const TIME_LABELS: Record<TimeOfDay, string> = {
  morning:   'Mañana (6–12)',
  afternoon: 'Tarde (12–18)',
  evening:   'Noche (18–24)',
  night:     'Madrugada (0–6)',
}

const DAY_LABELS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

interface Props {
  token: string
}

export default function RiderHeatMapScreen({ token }: Props) {
  const [cells, setCells] = useState<HeatMapCell[]>([])
  const [loading, setLoading] = useState(true)
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay | undefined>()
  const [dayOfWeek, setDayOfWeek] = useState<number | undefined>()
  const [selectedCell, setSelectedCell] = useState<HeatMapCell | null>(null)
  const [riderLocation, setRiderLocation] = useState<{ lat: number; lng: number } | null>(null)

  // Fetch rider's current position to center the map
  useEffect(() => {
    getCurrentPosition()
      .then(setRiderLocation)
      .catch(console.warn)
  }, [])

  useEffect(() => {
    setLoading(true)
    getHeatMap(token, { time_of_day: timeOfDay, day_of_week: dayOfWeek })
      .then(setCells)
      .catch(console.warn)
      .finally(() => setLoading(false))
  }, [token, timeOfDay, dayOfWeek])

  const maxCount = Math.max(...cells.map(c => c.order_count), 1)

  function getHeatColor(count: number): string {
    const intensity = count / maxCount
    if (intensity > 0.75) return '#EF4444'  // red — very hot
    if (intensity > 0.5)  return '#F97316'  // orange — hot
    if (intensity > 0.25) return '#EAB308'  // yellow — warm
    return '#22C55E'                         // green — cool
  }

  const initialRegion = riderLocation ? {
    latitude: riderLocation.lat,
    longitude: riderLocation.lng,
    latitudeDelta: 0.03,
    longitudeDelta: 0.03,
  } : {
    latitude: -30.6011,
    longitude: -71.2011,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Mapa de calor</Text>
      <Text style={styles.subtitle}>Zonas con mayor demanda de pedidos</Text>

      {/* Time of day filter */}
      <Text style={styles.filterLabel}>Franja horaria</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
        <TouchableOpacity
          style={[styles.chip, !timeOfDay && styles.chipActive]}
          onPress={() => setTimeOfDay(undefined)}
        >
          <Text style={[styles.chipText, !timeOfDay && styles.chipTextActive]}>Todas</Text>
        </TouchableOpacity>
        {(Object.keys(TIME_LABELS) as TimeOfDay[]).map(t => (
          <TouchableOpacity
            key={t}
            style={[styles.chip, timeOfDay === t && styles.chipActive]}
            onPress={() => setTimeOfDay(prev => prev === t ? undefined : t)}
          >
            <Text style={[styles.chipText, timeOfDay === t && styles.chipTextActive]}>
              {TIME_LABELS[t]}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Day of week filter */}
      <Text style={styles.filterLabel}>Día de la semana</Text>
      <View style={styles.dayRow}>
        {DAY_LABELS.map((label, i) => (
          <TouchableOpacity
            key={i}
            style={[styles.dayChip, dayOfWeek === i && styles.chipActive]}
            onPress={() => setDayOfWeek(prev => prev === i ? undefined : i)}
          >
            <Text style={[styles.chipText, dayOfWeek === i && styles.chipTextActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Heat map view */}
      {loading ? (
        <ActivityIndicator color="#FF6B35" style={{ marginTop: 40 }} />
      ) : cells.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No hay datos de demanda para los filtros seleccionados</Text>
        </View>
      ) : (
        <>
          <Text style={styles.filterLabel}>Zonas ({cells.length} celdas)</Text>
          
          <View style={styles.mapContainer}>
            <MapView
              style={styles.map}
              initialRegion={initialRegion}
              showsUserLocation={true}
              userLocationCalloutEnabled={true}
            >
              {cells.map((cell, i) => (
                <React.Fragment key={i}>
                  <Circle
                    center={{ latitude: cell.cell_lat, longitude: cell.cell_lng }}
                    radius={250}
                    fillColor={getHeatColor(cell.order_count) + '33'}
                    strokeColor={getHeatColor(cell.order_count)}
                    strokeWidth={1.5}
                  />
                  <Marker
                    coordinate={{ latitude: cell.cell_lat, longitude: cell.cell_lng }}
                    onPress={() => setSelectedCell(prev => prev === cell ? null : cell)}
                  >
                    <View style={[styles.cellMarker, { backgroundColor: getHeatColor(cell.order_count) }]}>
                      <Text style={styles.markerText}>{cell.order_count}</Text>
                    </View>
                  </Marker>
                </React.Fragment>
              ))}
            </MapView>
          </View>

          {/* Legend */}
          <View style={styles.legend}>
            {[
              { color: '#22C55E', label: 'Baja' },
              { color: '#EAB308', label: 'Media' },
              { color: '#F97316', label: 'Alta' },
              { color: '#EF4444', label: 'Muy alta' },
            ].map(({ color, label }) => (
              <View key={label} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: color }]} />
                <Text style={styles.legendText}>{label}</Text>
              </View>
            ))}
          </View>

          {/* Selected cell detail */}
          {selectedCell && (
            <View style={styles.cellDetail}>
              <Text style={styles.cellDetailTitle}>Zona seleccionada</Text>
              <Text style={styles.cellDetailText}>
                {selectedCell.order_count} pedidos históricos
              </Text>
              <Text style={styles.cellDetailText}>
                Tarifa promedio: ${Math.round(selectedCell.avg_fee_clp).toLocaleString('es-CL')} CLP
              </Text>
            </View>
          )}
        </>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: '#0A0A14' },
  content:         { padding: 16, paddingBottom: 40 },
  title:           { color: '#fff', fontSize: 20, fontWeight: '700', marginBottom: 4 },
  subtitle:        { color: 'rgba(255,255,255,0.4)', fontSize: 13, marginBottom: 20 },
  filterLabel:     { color: 'rgba(255,255,255,0.5)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, marginTop: 12 },
  filterRow:       { flexDirection: 'row', marginBottom: 4 },
  chip:            { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.08)', marginRight: 8 },
  chipActive:      { backgroundColor: '#FF6B35' },
  chipText:        { color: 'rgba(255,255,255,0.6)', fontSize: 12 },
  chipTextActive:  { color: '#fff', fontWeight: '600' },
  dayRow:          { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  dayChip:         { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.08)' },
  mapContainer:    { width: '100%', height: 380, borderRadius: 16, overflow: 'hidden', marginTop: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  map:             { flex: 1 },
  cellMarker:      { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, borderWidth: 1.5, borderColor: '#fff', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3.84, elevation: 5 },
  markerText:      { color: '#fff', fontSize: 10, fontWeight: '700' },
  legend:          { flexDirection: 'row', gap: 16, marginTop: 16 },
  legendItem:      { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot:       { width: 10, height: 10, borderRadius: 5 },
  legendText:      { color: 'rgba(255,255,255,0.5)', fontSize: 11 },
  cellDetail:      { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 16, marginTop: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  cellDetailTitle: { color: '#fff', fontWeight: '600', marginBottom: 8 },
  cellDetailText:  { color: 'rgba(255,255,255,0.7)', fontSize: 14, marginBottom: 4 },
  empty:           { padding: 40, alignItems: 'center' },
  emptyText:       { color: 'rgba(255,255,255,0.4)', textAlign: 'center' },
})
