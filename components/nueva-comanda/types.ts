export interface TableOption {
  id: string
  label: string
  status: 'libre' | 'ocupada' | 'reservada' | 'bloqueada'
  zone?: string
  seats?: number
}

export interface MenuItemOption {
  id: string
  name: string
  price: number
  category: string
  destination?: string
}

export interface OrderLine {
  menuItemId: string
  name: string
  unitPrice: number
  qty: number
  note: string
  destination: 'cocina' | 'barra' | 'ninguno'
}

export type FlowStep = 0 | 1 | 2

export interface FlowState {
  step: FlowStep
  selectedTable: TableOption | null
  pax: number
  lines: OrderLine[]
  saving: boolean
  error: string | null
}

export interface NuevaComandaFlowProps {
  onClose: () => void
  onSave: () => void
  tables: TableOption[]
  menuItems: MenuItemOption[]
  restaurantId: string
}

export interface StepMapaMesasProps {
  tables: TableOption[]
  selectedTable: TableOption | null
  pax: number
  onSelectTable: (table: TableOption) => void
  onChangePax: (pax: number) => void
  onConfirm: () => void
}

export interface StepCatalogoVisualProps {
  menuItems: MenuItemOption[]
  lines: OrderLine[]
  onAddItem: (item: MenuItemOption) => void
  onUpdateLine: (menuItemId: string, patch: Partial<OrderLine>) => void
  onRemoveLine: (menuItemId: string) => void
  onContinue: () => void
  onBack: () => void
}

export interface StepConfirmacionProps {
  selectedTable: TableOption
  pax: number
  lines: OrderLine[]
  saving: boolean
  error: string | null
  onConfirm: () => Promise<void>
  onBack: () => void
}
