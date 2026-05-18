/**
 * OfflineBanner — displays a banner when the device has no internet connection.
 * Uses useOfflineQueue to monitor connectivity state.
 */

import React from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { useOfflineQueue } from '../hooks/useOfflineQueue';

export function OfflineBanner() {
  const { isOnline, isFlushing } = useOfflineQueue();

  if (isOnline && !isFlushing) return null;

  return (
    <View style={[styles.banner, isFlushing && styles.bannerSyncing]}>
      <Text style={styles.bannerText}>
        {isFlushing
          ? '🔄 Sincronizando cambios pendientes…'
          : '📡 Sin conexión. Los cambios se guardarán localmente.'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: '#374151',
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  bannerSyncing: {
    backgroundColor: '#CC4A1A',
  },
  bannerText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
  },
});

export default OfflineBanner;
