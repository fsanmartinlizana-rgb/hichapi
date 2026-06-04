/**
 * QRScannerScreen — scans QR codes to access restaurant table menus.
 *
 * Features:
 * - Camera permissions request on mount
 * - Permission denied state with settings link
 * - Barcode scanning via CameraView
 * - QR URL parsing and qr_token validation against backend
 * - "Mesa no encontrada" error modal for invalid tokens
 * - Haptic feedback on successful scan
 * - Viewfinder overlay with corner guidelines
 */

import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { supabase } from '../../config/supabase';
import { parseQRCode } from '../../utils/qrParser';
import type { QRScannerScreenProps } from '../../types/navigation';
import type { Table } from '../../types/models';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function QRScannerScreen({ navigation }: QRScannerScreenProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const [validating, setValidating] = useState(false);
  const [errorVisible, setErrorVisible] = useState(false);
  const [errorMessage, setErrorMessage] = useState('Mesa no encontrada');
  const scanningRef = useRef(false);

  // -------------------------------------------------------------------------
  // Barcode scan handler
  // -------------------------------------------------------------------------

  const handleBarcodeScanned = useCallback(
    async ({ data }: { data: string }) => {
      if (scanningRef.current || validating) return;
      scanningRef.current = true;

      const parsed = parseQRCode(data);
      if (!parsed) {
        setErrorMessage('Código QR no válido');
        setErrorVisible(true);
        scanningRef.current = false;
        return;
      }

      setValidating(true);
      try {
        const { data: tables } = await supabase
          .from('tables')
          .select('id, restaurant_id, label, qr_token')
          .eq('qr_token', parsed.qrToken)
          .limit(1);

        if (!tables || tables.length === 0) {
          setErrorMessage('Mesa no encontrada');
          setErrorVisible(true);
          scanningRef.current = false;
          return;
        }

        const table = tables[0];

        // Haptic feedback on success
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        // Navigate to client chat
        navigation.navigate('ClientChat', {
          restaurantId: table.restaurant_id,
          tableId: table.id,
          slug: parsed.slug,
        });
      } catch {
        setErrorMessage('No se pudo verificar la mesa. Intenta nuevamente.');
        setErrorVisible(true);
        scanningRef.current = false;
      } finally {
        setValidating(false);
      }
    },
    [navigation, validating]
  );

  const handleDismissError = useCallback(() => {
    setErrorVisible(false);
    scanningRef.current = false;
  }, []);

  // -------------------------------------------------------------------------
  // Permission not yet determined
  // -------------------------------------------------------------------------

  if (!permission) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#FF6B35" />
      </View>
    );
  }

  // -------------------------------------------------------------------------
  // Permission denied
  // -------------------------------------------------------------------------

  if (!permission.granted) {
    return (
      <View style={styles.centered}>
        <Text style={styles.permissionIcon}>📷</Text>
        <Text style={styles.permissionTitle}>Acceso a cámara requerido</Text>
        <Text style={styles.permissionMessage}>
          Necesitamos acceso a tu cámara para escanear el código QR de tu mesa.
        </Text>
        {permission.canAskAgain ? (
          <TouchableOpacity
            style={styles.permissionButton}
            onPress={requestPermission}
            accessibilityLabel="Permitir acceso a la cámara"
            accessibilityRole="button"
          >
            <Text style={styles.permissionButtonText}>Permitir acceso</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.permissionButton}
            onPress={() => Linking.openSettings()}
            accessibilityLabel="Abrir configuración del sistema"
            accessibilityRole="button"
          >
            <Text style={styles.permissionButtonText}>Abrir configuración</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  // -------------------------------------------------------------------------
  // Camera view
  // -------------------------------------------------------------------------

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
        onBarcodeScanned={handleBarcodeScanned}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
      />

      {/* Viewfinder overlay */}
      <View style={styles.overlay}>
        <View style={styles.topOverlay}>
          <SafeAreaView edges={['top']}>
            <TouchableOpacity 
              style={styles.closeButton} 
              onPress={() => navigation.navigate('Customer')}
            >
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </SafeAreaView>
        </View>
        <View style={styles.middleRow}>
          <View style={styles.sideOverlay} />
          <View style={styles.viewfinder}>
            {/* Corner guidelines */}
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />
          </View>
          <View style={styles.sideOverlay} />
        </View>
        <View style={styles.bottomOverlay}>
          <Text style={styles.instructions}>
            {validating
              ? 'Verificando mesa…'
              : 'Apunta la cámara al código QR de tu mesa'}
          </Text>
          {validating && (
            <ActivityIndicator
              size="small"
              color="#fff"
              style={styles.validatingIndicator}
            />
          )}
        </View>
      </View>

      {/* Error modal */}
      <Modal
        visible={errorVisible}
        transparent
        animationType="fade"
        onRequestClose={handleDismissError}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalIcon}>❌</Text>
            <Text style={styles.modalTitle}>{errorMessage}</Text>
            <Text style={styles.modalMessage}>
              Asegúrate de escanear el código QR correcto de tu mesa.
            </Text>
            <TouchableOpacity
              style={styles.modalButton}
              onPress={handleDismissError}
              accessibilityLabel="Cerrar error y reintentar"
              accessibilityRole="button"
            >
              <Text style={styles.modalButtonText}>Reintentar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const VIEWFINDER_SIZE = 260;
const CORNER_SIZE = 24;
const CORNER_THICKNESS = 4;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    padding: 32,
  },
  permissionIcon: {
    fontSize: 56,
    marginBottom: 20,
  },
  permissionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 12,
  },
  permissionMessage: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
  },
  permissionButton: {
    backgroundColor: '#FF6B35',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 32,
  },
  permissionButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'column',
  },
  topOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  closeButton: {
    alignSelf: 'flex-start',
    padding: 16,
    marginTop: 8,
    marginLeft: 8,
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 28,
    fontWeight: 'bold',
  },
  middleRow: {
    flexDirection: 'row',
    height: VIEWFINDER_SIZE,
  },
  sideOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  viewfinder: {
    width: VIEWFINDER_SIZE,
    height: VIEWFINDER_SIZE,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: CORNER_SIZE,
    height: CORNER_SIZE,
    borderColor: '#fff',
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: CORNER_THICKNESS,
    borderLeftWidth: CORNER_THICKNESS,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: CORNER_THICKNESS,
    borderRightWidth: CORNER_THICKNESS,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: CORNER_THICKNESS,
    borderLeftWidth: CORNER_THICKNESS,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: CORNER_THICKNESS,
    borderRightWidth: CORNER_THICKNESS,
  },
  bottomOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    paddingTop: 24,
    gap: 12,
  },
  instructions: {
    color: '#fff',
    fontSize: 15,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  validatingIndicator: {
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 28,
    width: '80%',
    alignItems: 'center',
  },
  modalIcon: {
    fontSize: 40,
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  modalButton: {
    backgroundColor: '#FF6B35',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 28,
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
