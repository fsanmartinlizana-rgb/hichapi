/**
 * Utilidades para calcular divisiones de cuenta
 */

export interface Split {
  index: number
  amount: number
  paid: boolean
}

export interface OrderItem {
  id: string
  name: string
  quantity: number
  unit_price: number
}

export interface Order {
  id: string
  order_items: OrderItem[]
}

/**
 * Calcula división en partes iguales
 * Distribuye el resto en la primera división para evitar centavos perdidos
 */
export function calculateEqualSplits(totalAmount: number, numPeople: number): Split[] {
  if (numPeople < 1) {
    throw new Error('Número de personas debe ser mayor a 0')
  }

  if (totalAmount <= 0) {
    throw new Error('Monto total debe ser mayor a 0')
  }

  const amountPerPerson = Math.floor(totalAmount / numPeople)
  const remainder = totalAmount - (amountPerPerson * numPeople)

  return Array.from({ length: numPeople }, (_, i) => ({
    index: i,
    amount: amountPerPerson + (i === 0 ? remainder : 0), // Primera persona paga el resto
    paid: false
  }))
}

/**
 * Calcula división por items
 * Asigna cada item a una persona y calcula el total por persona
 * 
 * @param orders - Array de órdenes con sus items
 * @param assignments - Mapa de order_item_id -> person_index
 * @returns Array de splits con el monto por persona
 */
export function calculateByItemsSplits(
  orders: Order[],
  assignments: Record<string, number>
): Split[] {
  // Validar que todos los items están asignados
  const allItems = orders.flatMap(o => o.order_items)
  const unassignedItems = allItems.filter(item => !(item.id in assignments))
  
  if (unassignedItems.length > 0) {
    throw new Error(`Hay ${unassignedItems.length} items sin asignar`)
  }

  // Calcular monto por persona
  const amountsByPerson: Record<number, number> = {}

  allItems.forEach(item => {
    const personIndex = assignments[item.id]
    const itemTotal = item.quantity * item.unit_price
    
    if (!amountsByPerson[personIndex]) {
      amountsByPerson[personIndex] = 0
    }
    amountsByPerson[personIndex] += itemTotal
  })

  // Convertir a array de splits
  const maxPersonIndex = Math.max(...Object.keys(amountsByPerson).map(Number))
  const splits: Split[] = []

  for (let i = 0; i <= maxPersonIndex; i++) {
    splits.push({
      index: i,
      amount: amountsByPerson[i] || 0,
      paid: false
    })
  }

  return splits.filter(s => s.amount > 0) // Filtrar personas sin items
}

/**
 * Valida división personalizada
 * Verifica que la suma de montos sea igual al total
 */
export function validateCustomSplits(
  amounts: number[],
  totalAmount: number
): { valid: boolean; error?: string; difference?: number } {
  if (amounts.length === 0) {
    return { valid: false, error: 'Debe haber al menos una división' }
  }

  if (amounts.some(a => a <= 0)) {
    return { valid: false, error: 'Todos los montos deben ser mayores a 0' }
  }

  const sum = amounts.reduce((acc, a) => acc + a, 0)
  const difference = sum - totalAmount

  // Tolerancia de 1 centavo por redondeo
  if (Math.abs(difference) > 1) {
    return {
      valid: false,
      error: `La suma (${sum}) no coincide con el total (${totalAmount})`,
      difference
    }
  }

  return { valid: true }
}

/**
 * Crea splits desde montos personalizados
 */
export function createCustomSplits(amounts: number[]): Split[] {
  return amounts.map((amount, index) => ({
    index,
    amount,
    paid: false
  }))
}

/**
 * Calcula el total de todas las órdenes
 */
export function calculateOrdersTotal(orders: Order[]): number {
  return orders.reduce((sum, order) => {
    const orderTotal = order.order_items.reduce(
      (itemSum, item) => itemSum + (item.quantity * item.unit_price),
      0
    )
    return sum + orderTotal
  }, 0)
}

/**
 * Formatea un monto en CLP
 */
export function formatAmount(amount: number): string {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount)
}

/**
 * Obtiene el número de personas sugerido basado en pax
 */
export function getSuggestedNumPeople(pax: number | null | undefined): number {
  return pax && pax > 0 ? pax : 2
}
