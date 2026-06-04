export interface ModulesConfig {
  tables:         boolean
  kitchen_display: boolean
  inventory:      boolean
  cash_register:  boolean
  loyalty:        boolean
  waitlist:       boolean
  daily_reports:  boolean
  geofencing:     boolean
  staff_schedule: boolean
  dte:            boolean
  delivery:       boolean
}

export const MODULE_DEFAULTS: Record<string, Partial<ModulesConfig>> = {
  restaurant:   { tables: true,  kitchen_display: true,  inventory: true,  cash_register: true,  loyalty: false, dte: false, delivery: true },
  cafe:         { tables: false, kitchen_display: true,  inventory: true,  cash_register: true,  loyalty: true,  dte: false, delivery: true },
  bar:          { tables: true,  kitchen_display: false, inventory: true,  cash_register: true,  loyalty: false, dte: false, delivery: false },
  dark_kitchen: { tables: false, kitchen_display: true,  inventory: true,  cash_register: false, loyalty: false, dte: false, delivery: true },
  food_truck:   { tables: false, kitchen_display: false, inventory: false, cash_register: true,  loyalty: false, dte: false, delivery: false },
  bakery:       { tables: false, kitchen_display: false, inventory: true,  cash_register: true,  loyalty: true,  dte: false, delivery: true },
  other:        { tables: true,  kitchen_display: true,  inventory: true,  cash_register: true,  loyalty: false, dte: false, delivery: true },
}

export const MODULE_LABELS: Record<keyof ModulesConfig, string> = {
  tables:          'Gestión de mesas',
  kitchen_display: 'Pantalla de cocina',
  inventory:       'Control de inventario',
  cash_register:   'Caja y pagos',
  loyalty:         'Programa de fidelización',
  waitlist:        'Lista de espera',
  daily_reports:   'Reportes diarios automáticos',
  geofencing:      'Geofencing',
  staff_schedule:  'Turnos de personal',
  dte:             'DTE Chile',
  delivery:        'Delivery Propio',
}

export const MODULE_PLAN_REQUIRED: Record<keyof ModulesConfig, string> = {
  tables:          'starter',
  kitchen_display: 'starter',
  inventory:       'pro',
  cash_register:   'starter',
  loyalty:         'pro',
  waitlist:        'starter',
  daily_reports:   'pro',
  geofencing:      'enterprise',
  staff_schedule:  'starter',
  dte:             'starter',
  delivery:        'starter',
}
