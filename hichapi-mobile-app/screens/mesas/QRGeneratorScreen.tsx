/**
 * QRGeneratorScreen — displays a QR code for a restaurant table.
 *
 * Features:
 * - Displays QR code using react-native-qrcode-svg
 * - QR value: hichapi://${slug}?qr_token=${qrToken} (uses tableLabel as slug)
 * - Shows table label and QR token text below the QR code
 * - Share button using React Native Share API
 */

import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Share,
  ScrollView,
  Alert,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import type { QRGeneratorScreenProps } from '../../types/navigation';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function QRGeneratorScreen({ route }: QRGeneratorScreenProps) {
  const { tableLabel, qrToken } = route.params;

  // Build the QR value using tableLabel as the slug
  const slug = tableLabel.toLowerCase().replace(/\s+/g, '-');
  const qrValue = `hichapi://${slug}?qr_token=${qrToken}`;

  // -------------------------------------------------------------------------
  // Share handler
  // -------------------------------------------------------------------------

  const handleShare = useCallback(async () => {
    try {
      await Share.share({
        message: `Escanea el código QR para ordenar en ${tableLabel}:\n${qrValue}`,
        title: `QR ${tableLabel}`,
      });
    } catch (err) {
      if (err instanceof Error && err.message !== 'User did not share') {
        Alert.alert('Error', 'No se pudo compartir el código QR.');
      }
    }
  }, [tableLabel, qrValue]);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
    >
      <Text style={styles.title}>{tableLabel}</Text>

      {/* ------------------------------------------------------------------ */}
      {/* QR Code                                                             */}
      {/* ------------------------------------------------------------------ */}
      <View
        style={styles.qrContainer}
        accessibilityLabel={`Código QR para ${tableLabel}`}
      >
        <QRCode
          value={qrValue}
          size={220}
          color="#111827"
          backgroundColor="#fff"
        />
      </View>

      {/* ------------------------------------------------------------------ */}
      {/* Token text                                                          */}
      {/* ------------------------------------------------------------------ */}
      <Text style={styles.tokenLabel}>Token QR</Text>
      <Text style={styles.tokenValue} selectable>
        {qrToken}
      </Text>

      <Text style={styles.urlLabel}>URL</Text>
      <Text style={styles.urlValue} selectable numberOfLines={2}>
        {qrValue}
      </Text>

      {/* ------------------------------------------------------------------ */}
      {/* Share button                                                        */}
      {/* ------------------------------------------------------------------ */}
      <TouchableOpacity
        style={styles.shareButton}
        onPress={handleShare}
        accessibilityLabel={`Compartir código QR de ${tableLabel}`}
        accessibilityRole="button"
      >
        <Text style={styles.shareButtonText}>Compartir QR</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  content: {
    alignItems: 'center',
    padding: 24,
    paddingBottom: 48,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 28,
  },
  qrContainer: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: 28,
  },
  tokenLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  tokenValue: {
    fontSize: 14,
    color: '#111827',
    fontFamily: 'monospace',
    backgroundColor: '#F3F4F6',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignSelf: 'stretch',
    marginBottom: 16,
  },
  urlLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  urlValue: {
    fontSize: 12,
    color: '#374151',
    backgroundColor: '#F3F4F6',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignSelf: 'stretch',
    marginBottom: 28,
  },
  shareButton: {
    backgroundColor: '#FF6B35',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 40,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  shareButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
