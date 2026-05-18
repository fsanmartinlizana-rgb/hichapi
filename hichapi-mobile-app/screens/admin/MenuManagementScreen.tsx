/**
 * MenuManagementScreen — admin screen for managing restaurant menu items.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  Modal, TextInput, Switch, ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import { supabase } from '../../config/supabase';
import { useAuth } from '../../hooks/useAuth';
import { useRestaurant } from '../../hooks/useRestaurant';
import { formatCLP } from '../../utils/formatters';
import type { MenuItem } from '../../types/models';

interface MenuItemForm {
  name: string;
  description: string;
  price: string;
  category: string;
  tags: string;
  available: boolean;
}

const EMPTY_FORM: MenuItemForm = {
  name: '', description: '', price: '', category: '', tags: '', available: true,
};

export default function MenuManagementScreen() {
  const { user } = useAuth();
  const { restaurantId } = useRestaurant();

  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string>('Todos');
  const [modalVisible, setModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [form, setForm] = useState<MenuItemForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const fetchItems = useCallback(async () => {
    if (!restaurantId) return;
    try {
      const { data, error: err } = await supabase
        .from('menu_items')
        .select('id, restaurant_id, name, description, price, category, tags, available')
        .eq('restaurant_id', restaurantId)
        .order('category');
      if (err) throw new Error(err.message);
      setItems((data ?? []) as MenuItem[]);
    } catch {
      Alert.alert('Error', 'No se pudo cargar el menú.');
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const categories = useMemo(() => {
    const cats = ['Todos', ...new Set(items.map((i) => i.category))];
    return cats;
  }, [items]);

  const filteredItems = useMemo(() =>
    activeCategory === 'Todos' ? items : items.filter((i) => i.category === activeCategory),
    [items, activeCategory]
  );

  const openCreate = () => { setEditingItem(null); setForm(EMPTY_FORM); setModalVisible(true); };
  const openEdit = (item: MenuItem) => {
    setEditingItem(item);
    setForm({ name: item.name, description: item.description, price: String(item.price), category: item.category, tags: item.tags.join(', '), available: item.available });
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.price.trim()) {
      Alert.alert('Error', 'Nombre y precio son requeridos.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        restaurant_id: restaurantId,
        name: form.name.trim(),
        description: form.description.trim(),
        price: parseInt(form.price, 10),
        category: form.category.trim(),
        tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
        available: form.available,
      };
      if (editingItem) {
        const { error: err } = await supabase
          .from('menu_items')
          .update(payload)
          .eq('id', editingItem.id);
        if (err) throw new Error(err.message);
      } else {
        const { error: err } = await supabase
          .from('menu_items')
          .insert(payload);
        if (err) throw new Error(err.message);
      }
      setModalVisible(false);
      fetchItems();
    } catch {
      Alert.alert('Error', 'No se pudo guardar el ítem.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (item: MenuItem) => {
    Alert.alert('Eliminar ítem', `¿Eliminar "${item.name}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar', style: 'destructive',
        onPress: async () => {
          try {
            const { error: err } = await supabase
              .from('menu_items')
              .delete()
              .eq('id', item.id);
            if (err) throw new Error(err.message);
            fetchItems();
          } catch {
            Alert.alert('Error', 'No se pudo eliminar el ítem.');
          }
        },
      },
    ]);
  };

  if (loading) return <View style={styles.centered}><ActivityIndicator size="large" color="#FF6B35" /></View>;

  return (
    <View style={styles.container}>
      {/* Category tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabs} contentContainerStyle={styles.tabsContent}>
        {categories.map((cat) => (
          <TouchableOpacity key={cat} style={[styles.tab, activeCategory === cat && styles.tabActive]} onPress={() => setActiveCategory(cat)} accessibilityRole="button">
            <Text style={[styles.tabText, activeCategory === cat && styles.tabTextActive]}>{cat}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Item list */}
      <FlatList
        data={filteredItems}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View style={styles.itemRow}>
            <View style={styles.itemInfo}>
              <Text style={styles.itemName}>{item.name}</Text>
              <Text style={styles.itemPrice}>{formatCLP(item.price)}</Text>
            </View>
            <Switch value={item.available} onValueChange={async (val) => {
              await supabase
                .from('menu_items')
                .update({ available: val })
                .eq('id', item.id);
              fetchItems();
            }} accessibilityLabel={`Disponibilidad de ${item.name}`} />
            <TouchableOpacity style={styles.editBtn} onPress={() => openEdit(item)} accessibilityRole="button" accessibilityLabel={`Editar ${item.name}`}>
              <Text style={styles.editBtnText}>✏️</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(item)} accessibilityRole="button" accessibilityLabel={`Eliminar ${item.name}`}>
              <Text style={styles.deleteBtnText}>🗑️</Text>
            </TouchableOpacity>
          </View>
        )}
        ListEmptyComponent={<View style={styles.centered}><Text style={styles.emptyText}>Sin ítems en esta categoría.</Text></View>}
      />

      {/* FAB */}
      <TouchableOpacity style={styles.fab} onPress={openCreate} accessibilityLabel="Agregar ítem al menú" accessibilityRole="button">
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      {/* Create/Edit Modal */}
      <Modal visible={modalVisible} animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <ScrollView style={styles.modal} contentContainerStyle={styles.modalContent}>
          <Text style={styles.modalTitle}>{editingItem ? 'Editar ítem' : 'Nuevo ítem'}</Text>
          {(['name', 'description', 'price', 'category', 'tags'] as const).map((field) => (
            <View key={field} style={styles.field}>
              <Text style={styles.fieldLabel}>{field === 'tags' ? 'Tags (separados por coma)' : field.charAt(0).toUpperCase() + field.slice(1)}</Text>
              <TextInput
                style={styles.fieldInput}
                value={form[field]}
                onChangeText={(val) => setForm((f) => ({ ...f, [field]: val }))}
                keyboardType={field === 'price' ? 'number-pad' : 'default'}
                accessibilityLabel={field}
              />
            </View>
          ))}
          <View style={styles.switchRow}>
            <Text style={styles.fieldLabel}>Disponible</Text>
            <Switch value={form.available} onValueChange={(val) => setForm((f) => ({ ...f, available: val }))} />
          </View>
          <TouchableOpacity style={styles.imageBtn} onPress={() => Alert.alert('Imagen', 'Seleccionar imagen (próximamente)')} accessibilityRole="button">
            <Text style={styles.imageBtnText}>📷 Seleccionar imagen</Text>
          </TouchableOpacity>
          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)} accessibilityRole="button">
              <Text style={styles.cancelBtnText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.saveBtn, saving && styles.saveBtnDisabled]} onPress={handleSave} disabled={saving} accessibilityRole="button">
              {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.saveBtnText}>Guardar</Text>}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyText: { fontSize: 14, color: '#9CA3AF' },
  tabs: { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E5E7EB', maxHeight: 50 },
  tabsContent: { paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
  tab: { paddingVertical: 6, paddingHorizontal: 14, borderRadius: 20, backgroundColor: '#F3F4F6' },
  tabActive: { backgroundColor: '#FFF3EE', borderWidth: 1, borderColor: '#FF6B35' },
  tabText: { fontSize: 13, color: '#6B7280', fontWeight: '500' },
  tabTextActive: { color: '#FF6B35', fontWeight: '700' },
  list: { padding: 12, gap: 8 },
  itemRow: { backgroundColor: '#fff', borderRadius: 10, padding: 14, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#F3F4F6' },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 14, fontWeight: '600', color: '#111827' },
  itemPrice: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  editBtn: { padding: 8 },
  editBtnText: { fontSize: 18 },
  deleteBtn: { padding: 8 },
  deleteBtnText: { fontSize: 18 },
  fab: { position: 'absolute', bottom: 24, right: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: '#FF6B35', alignItems: 'center', justifyContent: 'center', elevation: 4 },
  fabText: { color: '#fff', fontSize: 28, fontWeight: '300' },
  modal: { flex: 1, backgroundColor: '#fff' },
  modalContent: { padding: 20, gap: 12 },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#111827', marginBottom: 8 },
  field: { gap: 4 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#374151' },
  fieldInput: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 12, fontSize: 14, color: '#111827' },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  imageBtn: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, paddingVertical: 12, alignItems: 'center', borderStyle: 'dashed' },
  imageBtnText: { fontSize: 14, color: '#6B7280' },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  cancelBtn: { flex: 1, borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  cancelBtnText: { fontSize: 14, color: '#374151', fontWeight: '600' },
  saveBtn: { flex: 1, backgroundColor: '#FF6B35', borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  saveBtnDisabled: { backgroundColor: '#FF6B3580' },
  saveBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
