/**
 * AlertBadge — animated pulse badge for bell and banknote alerts.
 *
 * Displays a pulsing icon badge for two alert types:
 * - 'bell'     → blue background, bell icon (🔔)
 * - 'banknote' → amber background, banknote icon (💵)
 *
 * Optionally shows a numeric count badge when count > 0.
 */

import React, { useEffect, useRef } from 'react';
import { Animated, View, Text, StyleSheet } from 'react-native';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface AlertBadgeProps {
  type: 'bell' | 'banknote';
  count?: number;
}

// ---------------------------------------------------------------------------
// Type configuration
// ---------------------------------------------------------------------------

const TYPE_CONFIG = {
  bell: {
    backgroundColor: '#FF6B35', // blue-500
    icon: '🔔',
  },
  banknote: {
    backgroundColor: '#F59E0B', // amber-500
    icon: '💵',
  },
} as const;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function AlertBadgeComponent({ type, count = 0 }: AlertBadgeProps) {
  const scaleAnim = useRef(new Animated.Value(1.0)).current;

  // Looping pulse animation: 1.0 → 1.2 → 1.0, 1000ms per cycle
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 1.2,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1.0,
          duration: 500,
          useNativeDriver: true,
        }),
      ])
    );

    pulse.start();

    return () => {
      pulse.stop();
    };
  }, [scaleAnim]);

  const { backgroundColor, icon } = TYPE_CONFIG[type];

  return (
    <View style={styles.wrapper}>
      <Animated.View
        style={[
          styles.badge,
          { backgroundColor, transform: [{ scale: scaleAnim }] },
        ]}
      >
        <Text style={styles.icon}>{icon}</Text>
      </Animated.View>

      {count > 0 && (
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{count > 99 ? '99+' : count}</Text>
        </View>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
    alignSelf: 'flex-start',
  },
  badge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    fontSize: 18,
  },
  countBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#EF4444', // red-500
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  countText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
});

// ---------------------------------------------------------------------------
// Export (memoized)
// ---------------------------------------------------------------------------

export const AlertBadge = React.memo(AlertBadgeComponent);
export default AlertBadge;
