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
}

export const MODULE_DEFAULTS: Record<string, Partial<ModulesConfig>> = {
  restaurant:   { tables: true,  kitchen_display: true,  inventory: true,  cash_register: true,  loyalty: false },
  cafe:         { tables: false, kitchen_display: true,  inventory: true,  cash_register: true,  loyalty: true  },
  bar:          { tables: true,  kitchen_display: false, inventory: true,  cash_register: true,  loyalty: false },
  dark_kitchen: { tables: false, kitchen_display: true,  inventory: true,  cash_register: false, loyalty: false },
  food_truck:   { tables: false, kitchen_display: false, inventory: false, cash_register: true,  loyalty: false },
  bakery:       { tables: false, kitchen_display: false, inventory: true,  cash_register: true,  loyalty: true  },
  other:        { tables: true,  kitchen_display: true,  inventory: true,  cash_register: true,  loyalty: false },
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
}

export const MODULE_PLAN_REQUIRED: Record<keyof ModulesConfig, string> = {
  tables:          'free',
  kitchen_display: 'free',
  inventory:       'starter',
  cash_register:   'free',
  loyalty:         'pro',
  waitlist:        'free',
  daily_reports:   'pro',
  geofencing:      'enterprise',
  staff_schedule:  'starter',
}
