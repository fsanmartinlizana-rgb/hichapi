/**
 * StatusBadge — color-coded badge for displaying an OrderStatus.
 *
 * Uses ORDER_STATUS_LABELS for the human-readable text and
 * ORDER_STATUS_COLORS / ORDER_STATUS_BG_COLORS for the visual styling.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import {
  ORDER_STATUS_LABELS,
  ORDER_STATUS_COLORS,
  ORDER_STATUS_BG_COLORS,
} from '../utils/constants';
import type { OrderStatus } from '../types/models';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface StatusBadgeProps {
  status: OrderStatus;
  size?: 'small' | 'medium' | 'large';
}

// ---------------------------------------------------------------------------
// Size configuration
// ---------------------------------------------------------------------------

const SIZE_CONFIG = {
  small: {
    fontSize: 10,
    paddingVertical: 4,
    paddingHorizontal: 4,
    borderRadius: 4,
  },
  medium: {
    fontSize: 12,
    paddingVertical: 6,
    paddingHorizontal: 6,
    borderRadius: 6,
  },
  large: {
    fontSize: 14,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
} as const;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function StatusBadgeComponent({ status, size = 'medium' }: StatusBadgeProps) {
  const label = ORDER_STATUS_LABELS[status];
  const textColor = ORDER_STATUS_COLORS[status];
  const bgColor = ORDER_STATUS_BG_COLORS[status];
  const sizeStyle = SIZE_CONFIG[size];

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: bgColor,
          paddingVertical: sizeStyle.paddingVertical,
          paddingHorizontal: sizeStyle.paddingHorizontal,
          borderRadius: sizeStyle.borderRadius,
        },
      ]}
      accessibilityLabel={label}
    >
      <Text
        style={[
          styles.text,
          {
            color: textColor,
            fontSize: sizeStyle.fontSize,
          },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
  },
  text: {
    fontWeight: '600',
  },
});

// ---------------------------------------------------------------------------
// Export (memoized)
// ---------------------------------------------------------------------------

export const StatusBadge = React.memo(StatusBadgeComponent);
export default StatusBadge;
