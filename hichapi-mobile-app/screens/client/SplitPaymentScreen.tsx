/**
 * SplitPaymentScreen — divide the bill equally or by item.
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { formatCLP } from '../../utils/formatters';
import type { SplitPaymentScreenProps } from '../../types/navigation';

type SplitType = 'equal' | 'by_item';
type PaymentStatus = 'pending' | 'processing' | 'succeeded' | 'failed';

interface SplitPortion {
  personId: string;
  label: string;
  amount: number;
  status: PaymentStatus;
}

export default function SplitPaymentScreen({ route, navigation }: SplitPaymentScreenProps) {
  const { total } = route.params;
  const [splitType, setSplitType] = useState<SplitType>('equal');
  const [personCount, setPersonCount] = useState('2');
  const [confirming, setConfirming] = useState(false);
  const [portions, setPortions] = useState<SplitPortion[]>([]);
  const [confirmed, setConfirmed] = useState(false);

  // Equal split calculation
  const equalPortions = useMemo<SplitPortion[]>(() => {
    const count = Math.max(1, parseInt(personCount, 10) || 1);
    const base = Math.floor(total / count);
    const remainder = total - base * count;
    return Array.from({ length: count }, (_, i) => ({
      personId: `person-${i + 1}`,
      label: `Persona ${i + 1}`,
      amount: i === 0 ? base + remainder : base, // first person gets remainder
      status: 'pending' as PaymentStatus,
    }));
  }, [total, personCount]);

  const handleConfirm = useCallback(async () => {
    const activePortion = splitType === 'equal' ? equalPortions : portions;
    if (activePortion.length === 0) return;

    setConfirming(true);
    const updatedPortions = activePortion.map((p) => ({ ...p, status: 'processing' as PaymentStatus }));
    setPortions(updatedPortions);
    setConfirmed(true);

    // Stub: simulate payment intent creation
    try {
      for (const portion of activePortion) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
      setPortions(activePortion.map((p) => ({ ...p, status: 'succeeded' as PaymentStatus })));
      Alert.alert('¡Pagos procesados!', 'Todos los pagos fueron completados exitosamente.');
    } catch {
      Alert.alert('Error', 'No se pudo procesar el pago. Intenta nuevamente.');
    } finally {
      setConfirming(false);
    }
  }, [splitType, equalPortions, portions]);

  const statusColor = (status: PaymentStatus) => {
    switch (status) {
      case 'succeeded': return '#10B981';
      case 'failed': return '#EF4444';
      case 'processing': return '#F59E0B';
      default: return '#6B7280';
    }
  };

  const statusLabel = (status: PaymentStatus) => {
    switch (status) {
      case 'succeeded': return '✅ Pagado';
      case 'failed': return '❌ Fallido';
      case 'processing': return '⏳ Procesando';
      default: return '⏸ Pendiente';
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Dividir cuenta</Text>
      <Text style={styles.totalText}>Total: {formatCLP(total)}</Text>

      {/* Split type selector */}
      <View style={styles.typeSelector}>
        <TouchableOpacity
          style={[styles.typeButton, splitType === 'equal' && styles.typeButtonActive]}
          onPress={() => setSplitType('equal')}
          accessibilityLabel="Dividir por igual"
          accessibilityRole="button"
        >
          <Text style={[styles.typeButtonText, splitType === 'equal' && styles.typeButtonTextActive]}>
            Por igual
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.typeButton, splitType === 'by_item' && styles.typeButtonActive]}
          onPress={() => setSplitType('by_item')}
          accessibilityLabel="Dividir por plato"
          accessibilityRole="button"
        >
          <Text style={[styles.typeButtonText, splitType === 'by_item' && styles.typeButtonTextActive]}>
            Por plato
          </Text>
        </TouchableOpacity>
      </View>

      {/* Equal split configuration */}
      {splitType === 'equal' && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Número de personas</Text>
          <TextInput
            style={styles.personInput}
            value={personCount}
            onChangeText={setPersonCount}
            keyboardType="number-pad"
            maxLength={2}
            accessibilityLabel="Número de personas"
          />
          <View style={styles.portionsList}>
            {equalPortions.map((portion) => (
              <View key={portion.personId} style={styles.portionRow}>
                <Text style={styles.portionLabel}>{portion.label}</Text>
                <Text style={styles.portionAmount}>{formatCLP(portion.amount)}</Text>
                {confirmed && (
                  <Text style={[styles.portionStatus, { color: statusColor(
                    portions.find((p) => p.personId === portion.personId)?.status ?? 'pending'
                  ) }]}>
                    {statusLabel(portions.find((p) => p.personId === portion.personId)?.status ?? 'pending')}
                  </Text>
                )}
              </View>
            ))}
          </View>
        </View>
      )}

      {/* By item — placeholder */}
      {splitType === 'by_item' && (
        <View style={styles.section}>
          <Text style={styles.byItemPlaceholder}>
            La división por plato está disponible cuando tienes una orden activa.
          </Text>
        </View>
      )}

      {/* Confirm button */}
      {!confirmed && (
        <TouchableOpacity
          style={[styles.confirmButton, confirming && styles.confirmButtonDisabled]}
          onPress={handleConfirm}
          disabled={confirming}
          accessibilityLabel="Confirmar división de cuenta"
          accessibilityRole="button"
        >
          {confirming ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.confirmButtonText}>Confirmar y pagar</Text>
          )}
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  content: { padding: 20, gap: 16 },
  title: { fontSize: 22, fontWeight: '700', color: '#111827' },
  totalText: { fontSize: 16, color: '#6B7280' },
  typeSelector: { flexDirection: 'row', gap: 10 },
  typeButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  typeButtonActive: { borderColor: '#FF6B35', backgroundColor: '#FFF3EE' },
  typeButtonText: { fontSize: 14, color: '#6B7280', fontWeight: '500' },
  typeButtonTextActive: { color: '#FF6B35', fontWeight: '700' },
  section: { backgroundColor: '#fff', borderRadius: 12, padding: 16, gap: 12 },
  sectionLabel: { fontSize: 14, fontWeight: '600', color: '#374151' },
  personInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    width: 80,
  },
  portionsList: { gap: 8 },
  portionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  portionLabel: { fontSize: 14, color: '#374151', flex: 1 },
  portionAmount: { fontSize: 15, fontWeight: '700', color: '#111827' },
  portionStatus: { fontSize: 12, fontWeight: '600', marginLeft: 8 },
  byItemPlaceholder: { fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 20 },
  confirmButton: { backgroundColor: '#FF6B35', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  confirmButtonDisabled: { backgroundColor: '#FF6B3580' },
  confirmButtonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
