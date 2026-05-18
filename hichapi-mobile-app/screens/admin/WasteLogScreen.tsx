/**
 * WasteLogScreen — admin screen for logging inventory waste.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, ScrollView,
} from 'react-native';
import { supabase } from '../../config/supabase';
import { stockService } from '../../services/stock/StockService';
import { useAuth } from '../../hooks/useAuth';
import { useRestaurant } from '../../hooks/useRestaurant';
import { formatCLP, formatDate } from '../../utils/formatters';
import type { StockItem, WasteLog } from '../../types/models';

const WASTE_REASONS = ['vencimiento', 'deterioro', 'rotura', 'error_prep', 'sobras', 'otro'] as const;

export default function WasteLogScreen() {
  const { user } = useAuth();
  const { restaurantId } = useRestaurant();

  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [wasteLogs, setWasteLogs] = useState<WasteLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStockId, setSelectedStockId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState<typeof WASTE_REASONS[number]>('vencimiento');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    if (!restaurantId) return;
    try {
      const [items, { data: logs }] = await Promise.all([
        stockService.getStockItems(restaurantId),
        supabase
          .from('waste_logs')
          .select('id, restaurant_id, stock_item_id, qty_lost, reason, notes, logged_by, cost_lost, logged_at')
          .eq('restaurant_id', restaurantId)
          .order('logged_at', { ascending: false })
          .limit(50),
      ]);
      setStockItems(items);
      setWasteLogs((logs ?? []) as WasteLog[]);
    } catch {
      Alert.alert('Error', 'No se pudo cargar los datos.');
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const selectedStock = stockItems.find((i) => i.id === selectedStockId);
  const estimatedCost = selectedStock && quantity
    ? selectedStock.cost_per_unit * (parseInt(quantity, 10) || 0)
    : 0;

  // Weekly summary
  const weeklyCost = useMemo(() => {
    const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return wasteLogs
      .filter((log) => new Date(log.logged_at).getTime() >= oneWeekAgo)
      .reduce((sum, log) => sum + log.cost_lost, 0);
  }, [wasteLogs]);

  // Group by date
  const groupedLogs = useMemo(() => {
    const map = new Map<string, WasteLog[]>();
    for (const log of wasteLogs) {
      const date = formatDate(log.logged_at);
      map.set(date, [...(map.get(date) ?? []), log]);
    }
    return Array.from(map.entries()).map(([date, logs]) => ({ date, logs }));
  }, [wasteLogs]);

  const handleSubmit = async () => {
    if (!selectedStockId || !quantity.trim()) {
      Alert.alert('Error', 'Selecciona un ítem e ingresa la cantidad.');
      return;
    }
    setSaving(true);
    try {
      const { error: err } = await supabase.from('waste_logs').insert({
        restaurant_id: restaurantId,
        stock_item_id: selectedStockId,
        qty_lost: parseInt(quantity, 10),
        reason,
        notes: notes.trim() || '',
        cost_lost: estimatedCost,
        logged_at: new Date().toISOString(),
      });
      if (err) throw new Error(err.message);
      setSelectedStockId('');
      setQuantity('');
      setNotes('');
      fetchData();
      Alert.alert('Éxito', 'Merma registrada correctamente.');
    } catch {
      Alert.alert('Error', 'No se pudo registrar la merma.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <View style={styles.centered}><ActivityIndicator size="large" color="#FF6B35" /></View>;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Weekly summary */}
      <View style={styles.summaryCard}>
        <Text style={styles.summaryLabel}>Mermas esta semana</Text>
        <Text style={styles.summaryAmount}>{formatCLP(weeklyCost)}</Text>
      </View>

      {/* Entry form */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Registrar merma</Text>

        <Text style={styles.fieldLabel}>Ítem de inventario</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.stockPicker}>
          {stockItems.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={[styles.stockChip, selectedStockId === item.id && styles.stockChipActive]}
              onPress={() => setSelectedStockId(item.id)}
              accessibilityRole="button"
            >
              <Text style={[styles.stockChipText, selectedStockId === item.id && styles.stockChipTextActive]}>
                {item.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <Text style={styles.fieldLabel}>Cantidad ({selectedStock?.unit ?? 'unidades'})</Text>
        <TextInput style={styles.fieldInput} value={quantity} onChangeText={setQuantity} keyboardType="number-pad" placeholder="0" accessibilityLabel="Cantidad de merma" />

        {estimatedCost > 0 && (
          <Text style={styles.costEstimate}>Costo estimado: {formatCLP(estimatedCost)}</Text>
        )}

        <Text style={styles.fieldLabel}>Razón</Text>
        <View style={styles.reasonGrid}>
          {WASTE_REASONS.map((r) => (
            <TouchableOpacity key={r} style={[styles.reasonBtn, reason === r && styles.reasonBtnActive]} onPress={() => setReason(r)} accessibilityRole="button">
              <Text style={[styles.reasonBtnText, reason === r && styles.reasonBtnTextActive]}>{r}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.fieldLabel}>Notas (opcional)</Text>
        <TextInput style={styles.fieldInput} value={notes} onChangeText={setNotes} placeholder="Notas adicionales" accessibilityLabel="Notas de la merma" />

        <TouchableOpacity style={[styles.submitBtn, saving && styles.submitBtnDisabled]} onPress={handleSubmit} disabled={saving} accessibilityRole="button">
          {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.submitBtnText}>Registrar merma</Text>}
        </TouchableOpacity>
      </View>

      {/* History */}
      <Text style={styles.historyTitle}>Historial</Text>
      {groupedLogs.map(({ date, logs }) => (
        <View key={date} style={styles.dateGroup}>
          <Text style={styles.dateLabel}>{date}</Text>
          {logs.map((log) => {
            const stockItem = stockItems.find((i) => i.id === log.stock_item_id);
            return (
              <View key={log.id} style={styles.logRow}>
                <View style={styles.logInfo}>
                  <Text style={styles.logName}>{stockItem?.name ?? log.stock_item_id}</Text>
                  <Text style={styles.logDetail}>{log.qty_lost} {stockItem?.unit} · {log.reason}</Text>
                </View>
                <Text style={styles.logCost}>{formatCLP(log.cost_lost)}</Text>
              </View>
            );
          })}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  content: { padding: 16, gap: 12 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  summaryCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: '#F3F4F6' },
  summaryLabel: { fontSize: 13, color: '#6B7280', marginBottom: 4 },
  summaryAmount: { fontSize: 28, fontWeight: '800', color: '#EF4444' },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, gap: 10, borderWidth: 1, borderColor: '#F3F4F6' },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#374151' },
  fieldInput: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 12, fontSize: 14, color: '#111827' },
  stockPicker: { maxHeight: 44 },
  stockChip: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20, backgroundColor: '#F3F4F6', marginRight: 8 },
  stockChipActive: { backgroundColor: '#FFF3EE', borderWidth: 1, borderColor: '#FF6B35' },
  stockChipText: { fontSize: 13, color: '#6B7280' },
  stockChipTextActive: { color: '#FF6B35', fontWeight: '600' },
  costEstimate: { fontSize: 13, color: '#EF4444', fontWeight: '600' },
  reasonGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  reasonBtn: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 6, borderWidth: 1, borderColor: '#D1D5DB' },
  reasonBtnActive: { borderColor: '#FF6B35', backgroundColor: '#FFF3EE' },
  reasonBtnText: { fontSize: 11, color: '#6B7280' },
  reasonBtnTextActive: { color: '#FF6B35', fontWeight: '700' },
  submitBtn: { backgroundColor: '#FF6B35', borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 4 },
  submitBtnDisabled: { backgroundColor: '#FF6B3580' },
  submitBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  historyTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  dateGroup: { gap: 6 },
  dateLabel: { fontSize: 13, fontWeight: '600', color: '#6B7280' },
  logRow: { backgroundColor: '#fff', borderRadius: 8, padding: 12, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#F3F4F6' },
  logInfo: { flex: 1 },
  logName: { fontSize: 13, fontWeight: '600', color: '#111827' },
  logDetail: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  logCost: { fontSize: 13, fontWeight: '700', color: '#EF4444' },
});
