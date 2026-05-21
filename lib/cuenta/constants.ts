/** Pedidos delivery con tracking activo */
export const ACTIVE_DELIVERY_STATUSES = new Set([
  'pending_assignment',
  'assigned',
  'picked_up',
  'in_transit',
])

export function isActiveDelivery(status: string): boolean {
  return ACTIVE_DELIVERY_STATUSES.has(status)
}

export function canRateOrder(status: string, orderType: 'delivery' | 'presencial'): boolean {
  if (orderType === 'delivery') return status === 'delivered'
  return status === 'paid'
}

export const ORDER_STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  confirmed: 'Confirmado',
  preparing: 'Preparando',
  ready: 'Listo',
  paying: 'Pidiendo cuenta',
  paid: 'Pagado',
  cancelled: 'Cancelado',
  pending_assignment: 'Pendiente',
  assigned: 'Asignado',
  picked_up: 'Recogido',
  in_transit: 'En camino',
  delivered: 'Entregado',
  failed: 'Fallido',
}
