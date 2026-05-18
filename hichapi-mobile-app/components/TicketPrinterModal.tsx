import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { TicketGroup } from '../types/models';

interface TicketPrinterModalProps {
  visible: boolean;
  groups: TicketGroup[];
  onConfirm: (selections: Record<string, string>) => void; // kind -> printerName
  onCancel: () => void;
  title?: string;
}

const KIND_LABEL: Record<string, string> = {
  cocina: 'Cocina',
  barra: 'Barra',
  caja: 'Caja / Precuenta',
};

const KIND_COLOR: Record<string, string> = {
  cocina: '#FBBF24',
  barra: '#60A5FA',
  caja: '#FF6B35',
};

export function TicketPrinterModal({
  visible,
  groups,
  onConfirm,
  onCancel,
  title = 'Enviar tickets',
}: TicketPrinterModalProps) {
  const needsSelection = useMemo(() => groups.filter((g) => g.printers.length > 1), [groups]);
  const autoGroups = useMemo(() => groups.filter((g) => g.printers.length === 1), [groups]);

  const [selections, setSelections] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    autoGroups.forEach((g) => {
      init[g.kind] = g.printers[0].name;
    });
    return init;
  });

  const allSelected = useMemo(() => {
    return needsSelection.every((g) => !!selections[g.kind]);
  }, [needsSelection, selections]);

  const handleConfirm = () => {
    if (!allSelected) return;
    onConfirm(selections);
  };

  return (
    <Modal visible={visible} animationType="fade" transparent={true}>
      <View style={styles.overlay}>
        <SafeAreaView style={styles.container}>
          <View style={styles.card}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.title}>{title}</Text>
              <TouchableOpacity onPress={onCancel}>
                <Text style={styles.closeBtn}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.body}>
              {/* Auto groups */}
              {autoGroups.map((g) => (
                <View
                  key={g.kind}
                  style={[styles.autoGroup, { borderColor: KIND_COLOR[g.kind] + '30', backgroundColor: KIND_COLOR[g.kind] + '08' }]}
                >
                  <Text style={[styles.kindLabel, { color: KIND_COLOR[g.kind] }]}>
                    {KIND_LABEL[g.kind] || g.kind} → {g.printers[0].name}
                  </Text>
                  <Text style={styles.autoSubtext}>Envío automático</Text>
                </View>
              ))}

              {/* Selection groups */}
              {needsSelection.map((g) => (
                <View key={g.kind} style={styles.selectionGroup}>
                  <Text style={[styles.kindLabel, { color: KIND_COLOR[g.kind] }]}>
                    {KIND_LABEL[g.kind] || g.kind} ({g.items.length} ítems)
                  </Text>
                  
                  <View style={styles.itemsList}>
                    {g.items.map((item, i) => (
                      <Text key={i} style={styles.itemText}>
                        {item.cantidad}x {item.nombre} {item.observacion ? `· ${item.observacion}` : ''}
                      </Text>
                    ))}
                  </View>

                  <View style={styles.printerGrid}>
                    {g.printers.map((p) => (
                      <TouchableOpacity
                        key={p.id}
                        onPress={() => setSelections((prev) => ({ ...prev, [g.kind]: p.name }))}
                        style={[
                          styles.printerBtn,
                          selections[g.kind] === p.name && {
                            backgroundColor: KIND_COLOR[g.kind] + '20',
                            borderColor: KIND_COLOR[g.kind],
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.printerBtnText,
                            selections[g.kind] === p.name && { color: KIND_COLOR[g.kind] },
                          ]}
                        >
                          {p.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              ))}
            </ScrollView>

            {/* Footer */}
            <View style={styles.footer}>
              <TouchableOpacity onPress={onCancel} style={styles.cancelBtn}>
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleConfirm}
                disabled={!allSelected}
                style={[styles.confirmBtn, !allSelected && styles.confirmBtnDisabled]}
              >
                <Text style={styles.confirmBtnText}>Confirmar envío</Text>
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: 20,
  },
  container: {
    width: '100%',
  },
  card: {
    backgroundColor: '#161622',
    borderRadius: 20,
    overflow: 'hidden',
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  title: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  closeBtn: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 18,
  },
  body: {
    padding: 16,
  },
  autoGroup: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  kindLabel: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  autoSubtext: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 11,
  },
  selectionGroup: {
    marginBottom: 20,
  },
  itemsList: {
    paddingLeft: 8,
    marginBottom: 12,
  },
  itemText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    marginBottom: 2,
  },
  printerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  printerBtn: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    minWidth: '45%',
    alignItems: 'center',
  },
  printerBtnText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
  },
  cancelBtnText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 14,
    fontWeight: '600',
  },
  confirmBtn: {
    flex: 2,
    backgroundColor: '#FF6B35',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  confirmBtnDisabled: {
    opacity: 0.4,
  },
  confirmBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
});
