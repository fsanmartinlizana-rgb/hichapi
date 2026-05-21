/**
 * TableCard — card component for displaying a restaurant table.
 *
 * Features:
 * - Table label (large, bold)
 * - Table status badge: libre (green), ocupada (blue), reservada (amber), bloqueada (gray)
 * - Bell badge (blue) when table has any order with status 'pending' or 'confirmed'
 * - Banknote badge (amber) when table has any order with status 'paying'
 * - QR button (small, bottom right)
 * - Seats count
 * - Wrapped with React.memo
 * - accessibilityLabel on all interactive elements
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { AlertBadge } from './AlertBadge';
import type { Table, Order } from '../types/models';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

/** Comensal reconocido en la mesa (solo datos públicos para staff). */
export interface TableCustomerBadge {
  display_name: string;
  visit_count: number;
  loyalty_points: number;
}

export interface TableCardProps {
  table: Table;
  orders?: Order[];
  /** Comensal con cuenta HiChapi en la comanda activa de esta mesa */
  customer?: TableCustomerBadge;
  onPress?: () => void;
  onQRPress?: () => void;
}

// ---------------------------------------------------------------------------
// Table status configuration
// ---------------------------------------------------------------------------

const TABLE_STATUS_CONFIG = {
  libre: {
    label: 'Libre',
    backgroundColor: '#D1FAE5', // green-100
    textColor: '#065F46',       // green-800
    borderColor: '#10B981',     // green-500
  },
  ocupada: {
    label: 'Ocupada',
    backgroundColor: '#FFF3EE', // blue-100
    textColor: '#CC4A1A',       // blue-800
    borderColor: '#FF6B35',     // blue-500
  },
  reservada: {
    label: 'Reservada',
    backgroundColor: '#FEF3C7', // amber-100
    textColor: '#92400E',       // amber-800
    borderColor: '#F59E0B',     // amber-500
  },
  bloqueada: {
    label: 'Bloqueada',
    backgroundColor: '#F3F4F6', // gray-100
    textColor: '#374151',       // gray-700
    borderColor: '#9CA3AF',     // gray-400
  },
} as const;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function TableCardComponent({ table, orders = [], customer, onPress, onQRPress }: TableCardProps) {
  const hasBellAlert = orders.some(
    (o) => o.status === 'pending' || o.status === 'confirmed'
  );
  const hasBanknoteAlert = orders.some((o) => o.status === 'paying');

  const statusConfig = TABLE_STATUS_CONFIG[table.status];

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityLabel={`Mesa ${table.label}, estado ${statusConfig.label}, ${table.seats} asientos`}
      accessibilityRole="button"
    >
      {/* ------------------------------------------------------------------ */}
      {/* Alert badges (top-right)                                            */}
      {/* ------------------------------------------------------------------ */}
      <View style={styles.badgesRow}>
        {hasBellAlert && <AlertBadge type="bell" />}
        {hasBanknoteAlert && <AlertBadge type="banknote" />}
      </View>

      {/* ------------------------------------------------------------------ */}
      {/* Table label                                                         */}
      {/* ------------------------------------------------------------------ */}
      <Text style={styles.tableLabel}>{table.label}</Text>

      {/* ------------------------------------------------------------------ */}
      {/* Seats count                                                         */}
      {/* ------------------------------------------------------------------ */}
      <Text style={styles.seatsText}>
        {table.seats} {table.seats === 1 ? 'asiento' : 'asientos'}
      </Text>

      {/* Comensal reconocido */}
      {customer && (table.status === 'ocupada' || table.status === 'cuenta') && (
        <View style={styles.customerBadge}>
          <Text style={styles.customerName} numberOfLines={1}>
            {customer.display_name}
          </Text>
          <Text style={styles.customerMeta}>
            {customer.visit_count} visitas · {customer.loyalty_points} pts ·{' '}
            {customer.visit_count > 5 ? 'Frecuente' : 'Nuevo'}
          </Text>
        </View>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Status badge                                                        */}
      {/* ------------------------------------------------------------------ */}
      <View
        style={[
          styles.statusBadge,
          {
            backgroundColor: statusConfig.backgroundColor,
            borderColor: statusConfig.borderColor,
          },
        ]}
        accessibilityLabel={`Estado: ${statusConfig.label}`}
      >
        <Text style={[styles.statusText, { color: statusConfig.textColor }]}>
          {statusConfig.label}
        </Text>
      </View>

      {/* ------------------------------------------------------------------ */}
      {/* QR button (bottom-right)                                            */}
      {/* ------------------------------------------------------------------ */}
      <TouchableOpacity
        style={styles.qrButton}
        onPress={onQRPress}
        accessibilityLabel={`Ver código QR de ${table.label}`}
        accessibilityRole="button"
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Text style={styles.qrButtonText}>QR</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    margin: 6,
    flex: 1,
    minHeight: 140,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    position: 'relative',
  },
  badgesRow: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 8,
    minHeight: 36,
  },
  tableLabel: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  seatsText: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 8,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  customerBadge: {
    backgroundColor: '#EDE9FE',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#C4B5FD',
  },
  customerName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#5B21B6',
  },
  customerMeta: {
    fontSize: 10,
    color: '#7C3AED',
    marginTop: 2,
  },
  qrButton: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    backgroundColor: '#F3F4F6',
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  qrButtonText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#374151',
  },
});

// ---------------------------------------------------------------------------
// Export (memoized)
// ---------------------------------------------------------------------------

export const TableCard = React.memo(TableCardComponent);
export default TableCard;
