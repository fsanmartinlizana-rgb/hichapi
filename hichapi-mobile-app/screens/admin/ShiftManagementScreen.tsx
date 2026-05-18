/**
 * ShiftManagementScreen — admin screen for managing staff shifts.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  Modal, TextInput, Alert, ActivityIndicator, ScrollView,
} from 'react-native';
import { supabase } from '../../config/supabase';
import { useAuth } from '../../hooks/useAuth';
import { useRestaurant } from '../../hooks/useRestaurant';
import { formatDate } from '../../utils/formatters';
import type { Shift, TeamMember } from '../../types/models';

export default function ShiftManagementScreen() {
  const { user } = useAuth();
  const { restaurantId } = useRestaurant();

  const [shifts, setShifts] = useState<Shift[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [modalVisible, setModalVisible] = useState(false);
  const [staffId, setStaffId] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('18:00');
  const [saving, setSaving] = useState(false);

  // Generate 7-day week starting from today
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return d;
  });

  const fetchData = useCallback(async () => {
    if (!restaurantId) return;
    try {
      const [{ data: shiftsData }, { data: teamData }] = await Promise.all([
        supabase
          .from('shifts')
          .select('id, restaurant_id, template_id, staff_id, shift_date, start_time, end_time, tables_assigned, status, opened_at, closed_at, notes')
          .eq('restaurant_id', restaurantId)
          .order('shift_date', { ascending: false })
          .limit(50),
        supabase
          .from('team_members')
          .select('id, restaurant_id, user_id, role, invited_by, joined_at, active')
          .eq('restaurant_id', restaurantId)
          .eq('active', true),
      ]);
      setShifts((shiftsData ?? []) as Shift[]);
      setTeamMembers((teamData ?? []) as TeamMember[]);
    } catch {
      Alert.alert('Error', 'No se pudo cargar los turnos.');
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const selectedDateStr = selectedDate.toISOString().split('T')[0];
  const dayShifts = shifts.filter((s) => s.shift_date === selectedDateStr);

  const handleCreateShift = async () => {
    if (!staffId) { Alert.alert('Error', 'Selecciona un miembro del equipo.'); return; }
    setSaving(true);
    try {
      const { error: err } = await supabase.from('shifts').insert({
        restaurant_id: restaurantId,
        staff_id: staffId,
        shift_date: selectedDateStr,
        start_time: startTime,
        end_time: endTime,
        tables_assigned: [],
        status: 'scheduled',
        notes: '',
        template_id: '',
      });
      if (err) throw new Error(err.message);
      setModalVisible(false);
      fetchData();
    } catch {
      Alert.alert('Error', 'No se pudo crear el turno.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (shift: Shift) => {
    const newStatus = shift.status === 'open' ? 'closed' : 'open';
    try {
      const { error: err } = await supabase
        .from('shifts')
        .update({ status: newStatus })
        .eq('id', shift.id);
      if (err) throw new Error(err.message);
      fetchData();
    } catch {
      Alert.alert('Error', 'No se pudo actualizar el turno.');
    }
  };

  if (loading) return <View style={styles.centered}><ActivityIndicator size="large" color="#FF6B35" /></View>;

  return (
    <View style={styles.container}>
      {/* Week calendar */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.calendar} contentContainerStyle={styles.calendarContent}>
        {weekDays.map((day) => {
          const dateStr = day.toISOString().split('T')[0];
          const isSelected = dateStr === selectedDateStr;
          const dayName = day.toLocaleDateString('es-CL', { weekday: 'short' });
          const dayNum = day.getDate();
          return (
            <TouchableOpacity
              key={dateStr}
              style={[styles.dayBtn, isSelected && styles.dayBtnActive]}
              onPress={() => setSelectedDate(day)}
              accessibilityRole="button"
              accessibilityLabel={`Seleccionar ${dayName} ${dayNum}`}
            >
              <Text style={[styles.dayName, isSelected && styles.dayNameActive]}>{dayName}</Text>
              <Text style={[styles.dayNum, isSelected && styles.dayNumActive]}>{dayNum}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Shifts for selected day */}
      <FlatList
        data={dayShifts}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          const member = teamMembers.find((m) => m.user_id === item.staff_id);
          return (
            <View style={styles.shiftRow}>
              <View style={styles.shiftInfo}>
                <Text style={styles.shiftMember}>{member?.user_id ?? item.staff_id}</Text>
                <Text style={styles.shiftTime}>{item.start_time} – {item.end_time}</Text>
              </View>
              <TouchableOpacity
                style={[styles.statusBtn, item.status === 'open' && styles.statusBtnOpen]}
                onPress={() => handleToggleStatus(item)}
                accessibilityRole="button"
              >
                <Text style={styles.statusBtnText}>{item.status === 'open' ? 'Abierto' : 'Cerrado'}</Text>
              </TouchableOpacity>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Sin turnos para este día.</Text>
          </View>
        }
      />

      {/* Add shift FAB */}
      <TouchableOpacity style={styles.fab} onPress={() => setModalVisible(true)} accessibilityLabel="Agregar turno" accessibilityRole="button">
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      {/* Create shift modal */}
      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Nuevo turno — {selectedDateStr}</Text>

            <Text style={styles.fieldLabel}>Personal</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.memberPicker}>
              {teamMembers.map((m) => (
                <TouchableOpacity
                  key={m.id}
                  style={[styles.memberChip, staffId === m.user_id && styles.memberChipActive]}
                  onPress={() => setStaffId(m.user_id)}
                  accessibilityRole="button"
                >
                  <Text style={[styles.memberChipText, staffId === m.user_id && styles.memberChipTextActive]}>
                    {m.role}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.timeRow}>
              <View style={styles.timeField}>
                <Text style={styles.fieldLabel}>Inicio</Text>
                <TextInput style={styles.fieldInput} value={startTime} onChangeText={setStartTime} placeholder="09:00" accessibilityLabel="Hora de inicio" />
              </View>
              <View style={styles.timeField}>
                <Text style={styles.fieldLabel}>Fin</Text>
                <TextInput style={styles.fieldInput} value={endTime} onChangeText={setEndTime} placeholder="18:00" accessibilityLabel="Hora de fin" />
              </View>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)} accessibilityRole="button"><Text style={styles.cancelBtnText}>Cancelar</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.saveBtn, saving && styles.saveBtnDisabled]} onPress={handleCreateShift} disabled={saving} accessibilityRole="button">
                {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.saveBtnText}>Crear turno</Text>}
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
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  calendar: { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E5E7EB', maxHeight: 80 },
  calendarContent: { paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  dayBtn: { width: 52, alignItems: 'center', paddingVertical: 8, borderRadius: 10 },
  dayBtnActive: { backgroundColor: '#FF6B35' },
  dayName: { fontSize: 11, color: '#6B7280', textTransform: 'capitalize' },
  dayNameActive: { color: '#fff' },
  dayNum: { fontSize: 18, fontWeight: '700', color: '#111827' },
  dayNumActive: { color: '#fff' },
  list: { padding: 12, gap: 8 },
  shiftRow: { backgroundColor: '#fff', borderRadius: 10, padding: 14, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#F3F4F6' },
  shiftInfo: { flex: 1 },
  shiftMember: { fontSize: 14, fontWeight: '600', color: '#111827' },
  shiftTime: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  statusBtn: { backgroundColor: '#F3F4F6', borderRadius: 6, paddingVertical: 6, paddingHorizontal: 12 },
  statusBtnOpen: { backgroundColor: '#D1FAE5' },
  statusBtnText: { fontSize: 12, fontWeight: '600', color: '#374151' },
  emptyContainer: { alignItems: 'center', paddingVertical: 32 },
  emptyText: { fontSize: 14, color: '#9CA3AF' },
  fab: { position: 'absolute', bottom: 24, right: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: '#FF6B35', alignItems: 'center', justifyContent: 'center', elevation: 4 },
  fabText: { color: '#fff', fontSize: 28, fontWeight: '300' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20, gap: 12 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#374151' },
  fieldInput: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 12, fontSize: 14, color: '#111827' },
  memberPicker: { maxHeight: 44 },
  memberChip: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20, backgroundColor: '#F3F4F6', marginRight: 8 },
  memberChipActive: { backgroundColor: '#FFF3EE', borderWidth: 1, borderColor: '#FF6B35' },
  memberChipText: { fontSize: 13, color: '#6B7280' },
  memberChipTextActive: { color: '#FF6B35', fontWeight: '600' },
  timeRow: { flexDirection: 'row', gap: 12 },
  timeField: { flex: 1, gap: 4 },
  modalActions: { flexDirection: 'row', gap: 12 },
  cancelBtn: { flex: 1, borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  cancelBtnText: { fontSize: 14, color: '#374151', fontWeight: '600' },
  saveBtn: { flex: 1, backgroundColor: '#FF6B35', borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  saveBtnDisabled: { backgroundColor: '#FF6B3580' },
  saveBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
