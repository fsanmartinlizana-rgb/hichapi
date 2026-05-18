import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { formatCLP } from '../utils/formatters';

interface PaymentModalProps {
  visible: boolean;
  orderTotal: number;
  onClose: () => void;
  onConfirm: (method: 'cash' | 'digital' | 'mixed', cashAmount: number, digitalAmount: number) => void;
}

export function PaymentModal({ visible, orderTotal, onClose, onConfirm }: PaymentModalProps) {
  const [method, setMethod] = useState<'cash' | 'digital' | 'mixed'>('digital');
  const [cashAmount, setCashAmount] = useState(orderTotal.toString());
  const [digitalAmount, setDigitalAmount] = useState('0');

  const handleConfirm = () => {
    const cash = parseInt(cashAmount) || 0;
    const digital = parseInt(digitalAmount) || 0;
    onConfirm(method, cash, digital);
  };

  const handleMethodChange = (newMethod: 'cash' | 'digital' | 'mixed') => {
    setMethod(newMethod);
    if (newMethod === 'cash') {
      setCashAmount(orderTotal.toString());
      setDigitalAmount('0');
    } else if (newMethod === 'digital') {
      setCashAmount('0');
      setDigitalAmount(orderTotal.toString());
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.container}
        >
          <View style={styles.content}>
            <Text style={styles.title}>Finalizar Pago</Text>
            <Text style={styles.totalLabel}>Total a cobrar:</Text>
            <Text style={styles.totalValue}>{formatCLP(orderTotal)}</Text>

            <View style={styles.methodRow}>
              <TouchableOpacity
                style={[styles.methodBtn, method === 'cash' && styles.methodBtnActive]}
                onPress={() => handleMethodChange('cash')}
              >
                <Text style={[styles.methodBtnText, method === 'cash' && styles.methodBtnTextActive]}>Efectivo</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.methodBtn, method === 'digital' && styles.methodBtnActive]}
                onPress={() => handleMethodChange('digital')}
              >
                <Text style={[styles.methodBtnText, method === 'digital' && styles.methodBtnTextActive]}>Digital</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.methodBtn, method === 'mixed' && styles.methodBtnActive]}
                onPress={() => handleMethodChange('mixed')}
              >
                <Text style={[styles.methodBtnText, method === 'mixed' && styles.methodBtnTextActive]}>Mixto</Text>
              </TouchableOpacity>
            </View>

            {method === 'mixed' && (
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Efectivo:</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  value={cashAmount}
                  onChangeText={setCashAmount}
                />
                <Text style={styles.inputLabel}>Digital (Transferencia/Tarjeta):</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  value={digitalAmount}
                  onChangeText={setDigitalAmount}
                />
              </View>
            )}

            <View style={styles.actions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirm}>
                <Text style={styles.confirmBtnText}>Confirmar Pago</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  container: {
    width: '100%',
  },
  content: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 16,
  },
  totalLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  totalValue: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FF6B35',
    marginBottom: 24,
  },
  methodRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 24,
  },
  methodBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  methodBtnActive: {
    backgroundColor: '#FF6B35',
    borderColor: '#FF6B35',
  },
  methodBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  methodBtnTextActive: {
    color: '#fff',
  },
  inputGroup: {
    width: '100%',
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
    marginTop: 8,
  },
  input: {
    width: '100%',
    height: 48,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 16,
    color: '#111827',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  cancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
  },
  cancelBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4B5563',
  },
  confirmBtn: {
    flex: 2,
    height: 48,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#10B981',
  },
  confirmBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
