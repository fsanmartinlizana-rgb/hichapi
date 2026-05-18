import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { formatCLP } from '../utils/formatters';
import { billSplitService, type Split, type SplitType, type DteSelection } from '../services/orders/BillSplitService';
import { EnhancedPaymentModal } from './EnhancedPaymentModal';

interface BillSplitModalProps {
  visible: boolean;
  tableLabel: string;
  tableId: string;
  orderIds: string[];
  totalAmount: number;
  restaurantId: string;
  onClose: () => void;
  onComplete: () => void;
}

type Step = 'type' | 'payment';

export const BillSplitModal: React.FC<BillSplitModalProps> = ({
  visible,
  tableLabel,
  tableId,
  orderIds,
  totalAmount,
  restaurantId,
  onClose,
  onComplete,
}) => {
  const [step, setStep] = useState<Step>('type');
  const [splitType, setSplitType] = useState<SplitType | null>(null);
  const [splits, setSplits] = useState<Split[]>([]);
  const [currentSplitIndex, setCurrentSplitIndex] = useState(0);
  const [billSplitId, setBillSplitId] = useState<string | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  useEffect(() => {
    if (!visible) {
      setStep('type');
      setSplitType(null);
      setSplits([]);
      setCurrentSplitIndex(0);
      setBillSplitId(null);
      setShowPaymentModal(false);
    }
  }, [visible]);

  const handleSelectType = (type: SplitType) => {
    setSplitType(type);
    if (type === 'full') {
      setSplits([{ index: 0, amount: totalAmount, paid: false }]);
      setStep('payment');
      setShowPaymentModal(true);
    } else {
      // Por ahora solo implementamos 'full' para no saturar, pero dejamos la base para los otros
      Alert.alert('Próximamente', 'La división de cuentas estará disponible muy pronto en la app. Por ahora usa "Pago completo".');
    }
  };

  const handlePaymentConfirm = async (
    method: 'cash' | 'digital' | 'mixed',
    dte: DteSelection,
    cashAmount: number,
    digitalAmount: number,
    tipAmount: number
  ) => {
    try {
      let currentBillSplitId = billSplitId;

      if (!currentBillSplitId) {
        // Crear el bill split en el backend
        const res = await billSplitService.createSplit({
          restaurant_id: restaurantId,
          table_id: tableId,
          order_ids: orderIds,
          split_type: splitType!,
          total_amount: totalAmount,
          num_splits: splits.length,
          split_config: {},
        });
        currentBillSplitId = res.bill_split_id;
        setBillSplitId(currentBillSplitId);
      }

      // Procesar el pago
      const payRes = await billSplitService.paySplit(currentBillSplitId!, {
        split_index: currentSplitIndex,
        amount: cashAmount + digitalAmount,
        tip_amount: tipAmount,
        payment_method: method,
        cash_amount: cashAmount,
        digital_amount: digitalAmount,
        dte,
      });

      if (payRes.completed) {
        Alert.alert('✅ ¡Pago completado!', 'La mesa ha sido liberada.');
        onComplete();
      } else {
        // Pasar al siguiente split si hubiera
        setCurrentSplitIndex(prev => prev + 1);
        setShowPaymentModal(false);
      }
    } catch (err) {
      console.error('Error in payment flow:', err);
      Alert.alert('Error', 'No se pudo procesar el pago.');
    }
  };

  return (
    <>
      {visible && !showPaymentModal && (
        <Modal visible={true} transparent animationType="slide" onRequestClose={onClose}>
          <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>
                {step === 'type' ? 'Cobrar mesa' : 'Procesar pago'}
              </Text>
              <Text style={styles.subtitle}>{tableLabel} · {orderIds.length} comanda(s)</Text>
            </View>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#9CA3AF" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content}>
            {step === 'type' && (
              <View style={styles.typeSelector}>
                <Text style={styles.sectionTitle}>¿Cómo deseas dividir la cuenta?</Text>
                <Text style={styles.totalLabel}>Total a cobrar: {formatCLP(totalAmount)}</Text>

                <TouchableOpacity style={styles.typeCard} onPress={() => handleSelectType('full')}>
                  <View style={[styles.typeIcon, { backgroundColor: 'rgba(16, 185, 129, 0.1)' }]}>
                    <MaterialCommunityIcons name="cash-multiple" size={24} color="#10B981" />
                  </View>
                  <View>
                    <Text style={styles.typeTitle}>Pago completo</Text>
                    <Text style={styles.typeDesc}>Una persona paga todo: {formatCLP(totalAmount)}</Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity style={styles.typeCard} onPress={() => handleSelectType('equal')}>
                  <View style={[styles.typeIcon, { backgroundColor: 'rgba(59, 130, 246, 0.1)' }]}>
                    <Ionicons name="people-outline" size={24} color="#3B82F6" />
                  </View>
                  <View>
                    <Text style={styles.typeTitle}>Dividir en partes iguales</Text>
                    <Text style={styles.typeDesc}>Dividir el total por número de personas</Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity style={styles.typeCard} onPress={() => handleSelectType('by_items')}>
                  <View style={[styles.typeIcon, { backgroundColor: 'rgba(139, 92, 246, 0.1)' }]}>
                    <Ionicons name="list-outline" size={24} color="#8B5CF6" />
                  </View>
                  <View>
                    <Text style={styles.typeTitle}>Dividir por ítems</Text>
                    <Text style={styles.typeDesc}>Cada persona paga lo que consumió</Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity style={styles.typeCard} onPress={() => handleSelectType('custom')}>
                  <View style={[styles.typeIcon, { backgroundColor: 'rgba(245, 158, 11, 0.1)' }]}>
                    <Ionicons name="calculator-outline" size={24} color="#F59E0B" />
                  </View>
                  <View>
                    <Text style={styles.typeTitle}>División personalizada</Text>
                    <Text style={styles.typeDesc}>Montos específicos por persona</Text>
                  </View>
                </TouchableOpacity>
              </View>
            )}

            {step === 'payment' && (
              <View style={styles.paymentSummary}>
                <View style={styles.summaryBox}>
                  <Text style={styles.summaryLabel}>Total a pagar</Text>
                  <Text style={styles.summaryValue}>{formatCLP(totalAmount)}</Text>
                </View>
                
                <TouchableOpacity 
                  style={styles.payButton}
                  onPress={() => setShowPaymentModal(true)}
                >
                  <Text style={styles.payButtonText}>Continuar al pago</Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  )}

      {showPaymentModal && (
        <EnhancedPaymentModal
          visible={true}
          orderTotal={splits[currentSplitIndex]?.amount || 0}
          restaurantId={restaurantId}
          onClose={() => {
            if (!billSplitId) {
              setStep('type');
              setShowPaymentModal(false);
            } else {
              // Si ya se empezó a pagar una división, no permitimos volver tan fácil
              setShowPaymentModal(false);
            }
          }}
          onConfirm={handlePaymentConfirm}
        />
      )}
    </>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    padding: 20,
  },
  container: {
    backgroundColor: '#1F2937',
    borderRadius: 24,
    maxHeight: '80%',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  subtitle: {
    color: '#9CA3AF',
    fontSize: 12,
  },
  content: {
    padding: 20,
  },
  typeSelector: {
    gap: 12,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  totalLabel: {
    color: '#9CA3AF',
    fontSize: 14,
    marginBottom: 12,
  },
  typeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 16,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#374151',
  },
  typeIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  typeDesc: {
    color: '#6B7280',
    fontSize: 12,
    marginTop: 2,
  },
  paymentSummary: {
    gap: 20,
  },
  summaryBox: {
    backgroundColor: 'rgba(255, 107, 53, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 53, 0.3)',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
  },
  summaryLabel: {
    color: '#FF6B35',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  summaryValue: {
    color: '#fff',
    fontSize: 32,
    fontWeight: '800',
  },
  payButton: {
    backgroundColor: '#FF6B35',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  payButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
