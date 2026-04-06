export type WaitlistStatus = 'waiting' | 'notified' | 'seated' | 'cancelled'

export interface WaitlistEntry {
  id: string
  restaurant_id: string
  table_id: string | null
  name: string
  phone: string
  party_size: number
  token: string
  status: WaitlistStatus
  position: number
  joined_at: string
  notified_at: string | null
  seated_at: string | null
  estimated_wait_min: number | null
  notes: string | null
}

export interface OccupiedTable {
  tableId: string
  seatedAt: Date
  status: 'ocupada' | 'cuenta'
}
