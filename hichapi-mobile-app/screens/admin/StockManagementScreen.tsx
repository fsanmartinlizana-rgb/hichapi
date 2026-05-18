/**
 * StockManagementScreen — admin screen for managing inventory.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  Modal, TextInput, Alert, ActivityIndicator,
} from 'react-native';
import { supabase } from '../../config/supabase';
import { stockService } from '../../services/stock/StockService';
import { useAuth } from '../../hooks/useAuth';
import { useRestaurant } from '../../hooks/useRestaurant';
import type { StockItem } from '../../types/models';

export default function StockManagementScreen() {
  const { user } = useAuth();
  const { restaurantId } = useRestaurant();

  const [items, setItems] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [adjustModalVisible, setAdjustModalVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState<StockItem | null>(null);
  const [delta, setDelta] = useState('');
  const [reason, setReason] = useState<'compra' | 'ajuste_manual' | 'devolucion'>('compra');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchItems = useCallback(async () => {
    try {
      const data = await stockService.getStockItems(restaurantId);
      setItems(data);
    } catch {
      Alert.alert('Error', 'No se pudo cargar el inventario.');
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const lowStockItems = items.filter((i) => i.current_qty < i.min_qty);

  const handleAdjust = async () => {
    if (!selectedItem || !delta.trim()) return;
    setSaving(true);
    try {
      await stockService.adjustStock({
        stock_item_id: selectedItem.id,
        delta: parseInt(delta, 10),
        reason,
        notes: notes.trim() || undefined,
      });
      setAdjustModalVisible(false);
      setDelta('');
      setNotes('');
      fetchItems();
    } catch {
      Alert.alert('Error', 'No se pudo ajustar el stock.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <View style={styles.centered}><ActivityIndicator size="large" color="#FF6B35" /></View>;

  return (
    <View style={styles.container}>
      {/* Low stock banner */}
      {lowStockItems.length > 0 && (
        <View style={styles.alertBanner}>
          <Text style={styles.alertText}>⚠️ {lowStockItems.length} ítem{lowStockItems.length !== 1 ? 's' : ''} con stock bajo</Text>
        </View>
      )}

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          const isLow = item.current_qty < item.min_qty;
          return (
            <View style={[styles.itemRow, isLow && styles.itemRowLow]}>
              <View style={styles.itemInfo}>
                <View style={styles.itemNameRow}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  {isLow && <View style={styles.lowBadge}><Text style={styles.lowBadgeText}>Bajo</Text></View>}
                </View>
                <Text style={styles.itemQty}>{item.current_qty} {item.unit} (mín: {item.min_qty})</Text>
              </View>
              <TouchableOpacity
                style={styles.adjustBtn}
                onPress={() => { setSelectedItem(item); setAdjustModalVisible(true); }}
                accessibilityLabel={`Ajustar stock de ${item.name}`}
                accessibilityRole="button"
              >
                <Text style={styles.adjustBtnText}>Ajustar</Text>
              </TouchableOpacity>
            </View>
          );
        }}
        ListEmptyComponent={<View style={styles.centered}><Text style={styles.emptyText}>Sin ítems de inventario.</Text></View>}
      />

      {/* Adjust Modal */}
      <Modal visible={adjustModalVisible} animationType="slide" transparent onRequestClose={() => setAdjustModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Ajustar: {selectedItem?.name}</Text>
            <Text style={styles.fieldLabel}>Delta (positivo = entrada, negativo = salida)</Text>
            <TextInput style={styles.fieldInput} value={delta} onChangeText={setDelta} keyboardType="numbers-and-punctuation" placeholder="ej. 10 o -5" accessibilityLabel="Delta de stock" />
            <Text style={styles.fieldLabel}>Razón</Text>
            <View style={styles.reasonRow}>
              {(['compra', 'ajuste_manual', 'devolucion'] as const).map((r) => (
                <TouchableOpacity key={r} style={[styles.reasonBtn, reason === r && styles.reasonBtnActive]} onPress={() => setReason(r)} accessibilityRole="button">
                  <Text style={[styles.reasonBtnText, reason === r && styles.reasonBtnTextActive]}>{r}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.fieldLabel}>Notas (opcional)</Text>
            <TextInput style={styles.fieldInput} value={notes} onChangeText={setNotes} placeholder="Notas adicionales" accessibilityLabel="Notas del ajuste" />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setAdjustModalVisible(false)} accessibilityRole="button"><Text style={styles.cancelBtnText}>Cancelar</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.saveBtn, saving && styles.saveBtnDisabled]} onPress={handleAdjust} disabled={saving} accessibilityRole="button">
                {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.saveBtnText}>Guardar</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyText: { fontSize: 14, color: '#9CA3AF' },
  alertBanner: { backgroundColor: '#FEF3C7', padding: 12, borderBottomWidth: 1, borderBottomColor: '#FDE68A' },
  alertText: { fontSize: 14, color: '#92400E', fontWeight: '600', textAlign: 'center' },
  list: { padding: 12, gap: 8 },
  itemRow: { backgroundColor: '#fff', borderRadius: 10, padding: 14, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#F3F4F6' },
  itemRowLow: { borderColor: '#FCA5A5', backgroundColor: '#FFF5F5' },
  itemInfo: { flex: 1 },
  itemNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  itemName: { fontSize: 14, fontWeight: '600', color: '#111827' },
  lowBadge: { backgroundColor: '#FEE2E2', borderRadius: 4, paddingVertical: 2, paddingHorizontal: 6 },
  lowBadgeText: { fontSize: 10, color: '#EF4444', fontWeight: '700' },
  itemQty: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  adjustBtn: { backgroundColor: '#FF6B35', borderRadius: 6, paddingVertical: 6, paddingHorizontal: 12 },
  adjustBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20, gap: 12 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#374151' },
  fieldInput: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 12, fontSize: 14, color: '#111827' },
  reasonRow: { flexDirection: 'row', gap: 8 },
  reasonBtn: { flex: 1, paddingVertical: 8, borderRadius: 6, borderWidth: 1, borderColor: '#D1D5DB', alignItems: 'center' },
  reasonBtnActive: { borderColor: '#FF6B35', backgroundColor: '#FFF3EE' },
  reasonBtnText: { fontSize: 11, color: '#6B7280' },
  reasonBtnTextActive: { color: '#FF6B35', fontWeight: '700' },
  modalActions: { flexDirection: 'row', gap: 12 },
  cancelBtn: { flex: 1, borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  cancelBtnText: { fontSize: 14, color: '#374151', fontWeight: '600' },
  saveBtn: { flex: 1, backgroundColor: '#FF6B35', borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  saveBtnDisabled: { backgroundColor: '#FF6B3580' },
  saveBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
