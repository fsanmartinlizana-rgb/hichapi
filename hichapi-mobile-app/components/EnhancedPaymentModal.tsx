import React, { useState, useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Switch,
  Alert,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import { formatCLP } from '../utils/formatters';
import { billSplitService, type DteSelection } from '../services/orders/BillSplitService';

interface EnhancedPaymentModalProps {
  visible: boolean;
  orderTotal: number;
  restaurantId: string;
  onClose: () => void;
  onConfirm: (
    method: 'cash' | 'digital' | 'mixed',
    dte: DteSelection,
    cashAmount: number,
    digitalAmount: number,
    tipAmount: number
  ) => Promise<void>;
}

export const EnhancedPaymentModal: React.FC<EnhancedPaymentModalProps> = ({
  visible,
  orderTotal,
  restaurantId,
  onClose,
  onConfirm,
}) => {
  const [method, setMethod] = useState<'cash' | 'digital' | 'mixed' | null>(null);
  const [cashPart, setCashPart] = useState('');
  const [saving, setSaving] = useState(false);

  // Propina
  const [tipPct, setTipPct] = useState(10);
  const [tipCustom, setTipCustom] = useState('');
  const [tipMode, setTipMode] = useState<'pct' | 'custom'>('pct');

  const tipAmount = tipMode === 'pct'
    ? Math.round(orderTotal * tipPct / 100)
    : Math.max(0, parseInt(tipCustom) || 0);
  const grandTotal = orderTotal + tipAmount;

  // DTE
  const [needsInvoice, setNeedsInvoice] = useState(false);
  const [sendByEmail, setSendByEmail] = useState(false);
  const [boletaEmail, setBoletaEmail] = useState('');

  // Factura Receptor Fields
  const [rut, setRut] = useState('');
  const [razon, setRazon] = useState('');
  const [giro, setGiro] = useState('');
  const [direccion, setDireccion] = useState('');
  const [comuna, setComuna] = useState('');
  const [email, setEmail] = useState('');

  // Autocomplete
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loadingSuggest, setLoadingSuggest] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const digitalPart = method === 'mixed' ? Math.max(0, grandTotal - (parseInt(cashPart) || 0)) : 0;

  useEffect(() => {
    if (!visible) {
      setMethod(null);
      setCashPart('');
      setTipPct(10);
      setTipCustom('');
      setTipMode('pct');
      setNeedsInvoice(false);
      setSendByEmail(false);
      setBoletaEmail('');
      setRut('');
      setRazon('');
      setGiro('');
      setDireccion('');
      setComuna('');
      setEmail('');
    }
  }, [visible]);

  // Autocomplete RUT
  useEffect(() => {
    if (!needsInvoice || rut.length < 3) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const timer = setTimeout(async () => {
      setLoadingSuggest(true);
      try {
        const data = await billSplitService.getReceptores(restaurantId, rut);
        setSuggestions(data.receptores || []);
        setShowSuggestions((data.receptores || []).length > 0);
      } catch (err) {
        console.error('Error fetching receptors:', err);
      } finally {
        setLoadingSuggest(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [rut, needsInvoice, restaurantId]);

  const applyReceptor = (r: any) => {
    setRut(r.rut);
    setRazon(r.razon_social);
    setGiro(r.giro || '');
    setDireccion(r.direccion || '');
    setComuna(r.comuna || '');
    setEmail(r.email || '');
    setShowSuggestions(false);
  };

  const handleConfirm = async () => {
    if (!method) {
      Alert.alert('Error', 'Selecciona un método de pago.');
      return;
    }
    if (method === 'mixed' && !cashPart) {
      Alert.alert('Error', 'Ingresa el monto en efectivo para el pago mixto.');
      return;
    }

    if (needsInvoice && (!rut || !razon || !giro || !direccion || !comuna)) {
      Alert.alert('Error', 'Completa todos los campos obligatorios para la factura.');
      return;
    }

    if (sendByEmail && !boletaEmail) {
      Alert.alert('Error', 'Ingresa el correo para enviar la boleta.');
      return;
    }

    const dte: DteSelection = needsInvoice
      ? {
          document_type: 33,
          rut_receptor: rut.replace(/\./g, '').trim(),
          razon_receptor: razon.trim(),
          giro_receptor: giro.trim(),
          direccion_receptor: direccion.trim(),
          comuna_receptor: comuna.trim(),
          fma_pago: method === 'cash' ? 1 : 2,
          email_receptor: email.trim() || undefined,
        }
      : {
          document_type: 39,
          email_receptor: sendByEmail ? boletaEmail.trim() : undefined,
        };

    const cashAmount = method === 'cash' ? grandTotal : method === 'mixed' ? (parseInt(cashPart) || 0) : 0;
    const digitalAmount = method === 'digital' ? grandTotal : method === 'mixed' ? Math.max(0, grandTotal - (parseInt(cashPart) || 0)) : 0;

    setSaving(true);
    try {
      await onConfirm(method, dte, cashAmount, digitalAmount, tipAmount);
    } catch (err) {
      Alert.alert('Error', 'No se pudo procesar el pago.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Método de pago</Text>
              <Text style={styles.subtitle}>
                Subtotal: {formatCLP(orderTotal)}
                {tipAmount > 0 && (
                  <Text style={styles.tipDetail}> + {formatCLP(tipAmount)} propina</Text>
                )}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#9CA3AF" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Propina Section */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Propina</Text>
                <Text style={styles.sectionValue}>{formatCLP(tipAmount)}</Text>
              </View>

              <View style={styles.tipOptions}>
                {[0, 5, 10, 15, 20].map((pct) => (
                  <TouchableOpacity
                    key={pct}
                    style={[
                      styles.tipButton,
                      tipMode === 'pct' && tipPct === pct && styles.tipButtonActive,
                    ]}
                    onPress={() => {
                      setTipPct(pct);
                      setTipMode('pct');
                      setTipCustom('');
                    }}
                  >
                    <Text
                      style={[
                        styles.tipButtonText,
                        tipMode === 'pct' && tipPct === pct && styles.tipButtonTextActive,
                      ]}
                    >
                      {pct === 0 ? 'Sin' : `${pct}%`}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.customTipContainer}>
                <Text style={styles.inputLabel}>Monto fijo:</Text>
                <View style={styles.inputWrapper}>
                  <Text style={styles.currencyPrefix}>$</Text>
                  <TextInput
                    style={styles.customTipInput}
                    value={tipCustom}
                    onChangeText={(val) => {
                      setTipCustom(val);
                      setTipMode('custom');
                    }}
                    placeholder="0"
                    keyboardType="numeric"
                    placeholderTextColor="#4B5563"
                  />
                </View>
              </View>

              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Total a cobrar</Text>
                <Text style={styles.totalValue}>{formatCLP(grandTotal)}</Text>
              </View>
            </View>

            {/* Payment Methods */}
            <View style={styles.methodsContainer}>
              <TouchableOpacity
                style={[styles.methodCard, method === 'cash' && styles.methodCardActive]}
                onPress={() => setMethod('cash')}
              >
                <View style={[styles.iconBox, method === 'cash' && styles.iconBoxActive]}>
                  <MaterialCommunityIcons
                    name="banknote-outline"
                    size={22}
                    color={method === 'cash' ? '#FF6B35' : '#9CA3AF'}
                  />
                </View>
                <View>
                  <Text style={styles.methodLabel}>Efectivo</Text>
                  <Text style={styles.methodDesc}>Sin comisión HiChapi</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.methodCard, method === 'digital' && styles.methodCardActive]}
                onPress={() => setMethod('digital')}
              >
                <View style={[styles.iconBox, method === 'digital' && styles.iconBoxActive]}>
                  <Ionicons
                    name="card-outline"
                    size={22}
                    color={method === 'digital' ? '#FF6B35' : '#9CA3AF'}
                  />
                </View>
                <View>
                  <Text style={styles.methodLabel}>Digital (Stripe)</Text>
                  <Text style={styles.methodDesc}>1% comisión HiChapi</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.methodCard, method === 'mixed' && styles.methodCardActive]}
                onPress={() => setMethod('mixed')}
              >
                <View style={[styles.iconBox, method === 'mixed' && styles.iconBoxActive]}>
                  <MaterialCommunityIcons
                    name="layers-outline"
                    size={22}
                    color={method === 'mixed' ? '#FF6B35' : '#9CA3AF'}
                  />
                </View>
                <View>
                  <Text style={styles.methodLabel}>Pago mixto</Text>
                  <Text style={styles.methodDesc}>Parte efectivo + parte digital</Text>
                </View>
              </TouchableOpacity>
            </View>

            {method === 'mixed' && (
              <View style={styles.mixedInputContainer}>
                <Text style={styles.inputLabel}>Parte en efectivo (CLP)</Text>
                <TextInput
                  style={styles.textInput}
                  value={cashPart}
                  onChangeText={setCashPart}
                  placeholder="0"
                  keyboardType="numeric"
                  placeholderTextColor="#4B5563"
                />
                {cashPart !== '' && (
                  <Text style={styles.mixedCalculation}>
                    Digital: {formatCLP(digitalPart)}
                  </Text>
                )}
              </View>
            )}

            {/* Email Boleta Toggle */}
            {!needsInvoice && (
              <View style={styles.toggleCard}>
                <View style={styles.toggleRow}>
                  <View style={styles.toggleIconLabel}>
                    <View style={styles.toggleIconBox}>
                      <Ionicons name="mail-outline" size={20} color="#FF6B35" />
                    </View>
                    <View>
                      <Text style={styles.toggleLabel}>Enviar boleta por email</Text>
                      <Text style={styles.toggleDesc}>El cliente recibe la boleta</Text>
                    </View>
                  </View>
                  <Switch
                    value={sendByEmail}
                    onValueChange={setSendByEmail}
                    trackColor={{ false: '#374151', true: '#FF6B35' }}
                    thumbColor="#fff"
                  />
                </View>
                {sendByEmail && (
                  <TextInput
                    style={[styles.textInput, styles.mt10]}
                    value={boletaEmail}
                    onChangeText={setBoletaEmail}
                    placeholder="cliente@ejemplo.com"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    placeholderTextColor="#4B5563"
                  />
                )}
              </View>
            )}

            {/* Factura Toggle */}
            <View style={[styles.toggleCard, styles.invoiceToggle]}>
              <View style={styles.toggleRow}>
                <View style={styles.toggleIconLabel}>
                  <View style={[styles.toggleIconBox, styles.invoiceIconBox]}>
                    <MaterialCommunityIcons name="office-building" size={20} color="#3B82F6" />
                  </View>
                  <View>
                    <Text style={styles.toggleLabel}>¿Necesitas factura?</Text>
                    <Text style={styles.toggleDesc}>Para empresas con crédito fiscal</Text>
                  </View>
                </View>
                <Switch
                  value={needsInvoice}
                  onValueChange={setNeedsInvoice}
                  trackColor={{ false: '#374151', true: '#FF6B35' }}
                  thumbColor="#fff"
                />
              </View>
            </View>

            {needsInvoice && (
              <View style={styles.invoiceForm}>
                <Text style={styles.formTitle}>Datos del receptor</Text>
                
                <View style={styles.inputGroup}>
                  <Text style={styles.fieldLabel}>RUT empresa *</Text>
                  <View>
                    <TextInput
                      style={styles.textInput}
                      value={rut}
                      onChangeText={setRut}
                      placeholder="76354771-K"
                      autoCapitalize="characters"
                      placeholderTextColor="#4B5563"
                    />
                    {loadingSuggest && (
                      <ActivityIndicator size="small" color="#FF6B35" style={styles.inputLoader} />
                    )}
                  </View>
                </View>

                {showSuggestions && suggestions.length > 0 && (
                  <View style={styles.suggestionsBox}>
                    {suggestions.map((s, idx) => (
                      <TouchableOpacity
                        key={idx}
                        style={styles.suggestionItem}
                        onPress={() => applyReceptor(s)}
                      >
                        <Text style={styles.suggestionName}>{s.razon_social}</Text>
                        <Text style={styles.suggestionRut}>{s.rut}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                <View style={styles.inputGroup}>
                  <Text style={styles.fieldLabel}>Razón social *</Text>
                  <TextInput
                    style={styles.textInput}
                    value={razon}
                    onChangeText={setRazon}
                    placeholder="Empresa Ejemplo SpA"
                    placeholderTextColor="#4B5563"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.fieldLabel}>Giro *</Text>
                  <TextInput
                    style={styles.textInput}
                    value={giro}
                    onChangeText={setGiro}
                    placeholder="Servicios de alimentación"
                    placeholderTextColor="#4B5563"
                  />
                </View>

                <View style={styles.row}>
                  <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                    <Text style={styles.fieldLabel}>Dirección *</Text>
                    <TextInput
                      style={styles.textInput}
                      value={direccion}
                      onChangeText={setDireccion}
                      placeholder="Av. Providencia 1234"
                      placeholderTextColor="#4B5563"
                    />
                  </View>
                  <View style={[styles.inputGroup, { flex: 1 }]}>
                    <Text style={styles.fieldLabel}>Comuna *</Text>
                    <TextInput
                      style={styles.textInput}
                      value={comuna}
                      onChangeText={setComuna}
                      placeholder="Providencia"
                      placeholderTextColor="#4B5563"
                    />
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.fieldLabel}>Correo electrónico (opcional)</Text>
                  <TextInput
                    style={styles.textInput}
                    value={email}
                    onChangeText={setEmail}
                    placeholder="contabilidad@empresa.cl"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    placeholderTextColor="#4B5563"
                  />
                </View>
              </View>
            )}

            <View style={{ height: 40 }} />
          </ScrollView>

          {/* Footer Buttons */}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose} disabled={saving}>
              <Text style={styles.cancelButtonText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.confirmButton, (!method || saving) && styles.buttonDisabled]}
              onPress={handleConfirm}
              disabled={!method || saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.confirmButtonText}>Confirmar pago</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#111827',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: '90%',
    paddingBottom: Platform.OS === 'ios' ? 30 : 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#1F2937',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  subtitle: {
    fontSize: 13,
    color: '#9CA3AF',
    marginTop: 2,
  },
  tipDetail: {
    color: '#10B981',
    fontWeight: '600',
  },
  closeButton: {
    padding: 4,
  },
  content: {
    padding: 20,
  },
  section: {
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.2)',
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    color: '#6EE7B7',
    fontSize: 13,
    fontWeight: '700',
  },
  sectionValue: {
    color: '#10B981',
    fontSize: 15,
    fontWeight: '700',
  },
  tipOptions: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  tipButton: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  tipButtonActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderColor: 'rgba(16, 185, 129, 0.5)',
  },
  tipButtonText: {
    color: '#9CA3AF',
    fontSize: 12,
    fontWeight: '700',
  },
  tipButtonTextActive: {
    color: '#6EE7B7',
  },
  customTipContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  inputLabel: {
    color: '#9CA3AF',
    fontSize: 12,
  },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 8,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  currencyPrefix: {
    color: '#4B5563',
    fontSize: 14,
  },
  customTipInput: {
    flex: 1,
    height: 36,
    color: '#fff',
    fontSize: 14,
    paddingLeft: 4,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(16, 185, 129, 0.15)',
  },
  totalLabel: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 13,
  },
  totalValue: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
  },
  methodsContainer: {
    gap: 10,
    marginBottom: 20,
  },
  methodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1F2937',
    backgroundColor: 'transparent',
  },
  methodCardActive: {
    borderColor: '#FF6B35',
    backgroundColor: 'rgba(255, 107, 53, 0.1)',
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBoxActive: {
    backgroundColor: 'rgba(255, 107, 53, 0.2)',
  },
  methodLabel: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  methodDesc: {
    color: '#6B7280',
    fontSize: 12,
  },
  mixedInputContainer: {
    marginBottom: 20,
  },
  textInput: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderWidth: 1,
    borderColor: '#1F2937',
    borderRadius: 12,
    padding: 14,
    color: '#fff',
    fontSize: 14,
  },
  mixedCalculation: {
    color: '#9CA3AF',
    fontSize: 11,
    marginTop: 6,
  },
  toggleCard: {
    backgroundColor: 'rgba(255, 107, 53, 0.08)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 53, 0.2)',
    padding: 14,
    marginBottom: 12,
  },
  invoiceToggle: {
    backgroundColor: 'rgba(59, 130, 246, 0.08)',
    borderColor: 'rgba(59, 130, 246, 0.2)',
    marginBottom: 20,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  toggleIconLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  toggleIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 107, 53, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  invoiceIconBox: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
  },
  toggleLabel: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  toggleDesc: {
    color: '#6B7280',
    fontSize: 11,
  },
  mt10: {
    marginTop: 10,
  },
  invoiceForm: {
    gap: 12,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#1F2937',
  },
  formTitle: {
    color: '#9CA3AF',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  inputGroup: {
    gap: 6,
  },
  fieldLabel: {
    color: '#9CA3AF',
    fontSize: 12,
  },
  row: {
    flexDirection: 'row',
  },
  inputLoader: {
    position: 'absolute',
    right: 12,
    top: 14,
  },
  suggestionsBox: {
    backgroundColor: '#1F2937',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#374151',
    marginTop: -8,
    overflow: 'hidden',
    zIndex: 10,
  },
  suggestionItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  suggestionName: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  suggestionRut: {
    color: '#9CA3AF',
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#1F2937',
  },
  cancelButton: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1F2937',
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#9CA3AF',
    fontSize: 15,
    fontWeight: '600',
  },
  confirmButton: {
    flex: 1,
    backgroundColor: '#FF6B35',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});
