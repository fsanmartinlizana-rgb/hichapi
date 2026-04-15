// ── Permisos granulares disponibles ─────────────────────────────────────────
// Cada permiso tiene formato `modulo.accion`.
// Los roles custom asignan un subset de estos.

export interface PermissionDef {
  key: string
  label: string
  module: string
}

export const PERMISSIONS: PermissionDef[] = [
  // Operación diaria
  { module: 'Operación', key: 'dashboard.view',  label: 'Ver dashboard' },
  { module: 'Operación', key: 'comandas.view',   label: 'Ver comandas' },
  { module: 'Operación', key: 'comandas.edit',   label: 'Editar comandas (confirmar, cocinar, entregar)' },
  { module: 'Operación', key: 'comandas.cobrar', label: 'Cobrar comandas' },
  { module: 'Operación', key: 'mesas.view',      label: 'Ver mesas' },
  { module: 'Operación', key: 'mesas.manage',    label: 'Gestionar mesas (crear/editar/limpiar)' },
  { module: 'Operación', key: 'reservas.view',   label: 'Ver reservas' },
  { module: 'Operación', key: 'reservas.manage', label: 'Gestionar reservas' },
  { module: 'Operación', key: 'carta.view',      label: 'Ver carta digital' },
  { module: 'Operación', key: 'carta.edit',      label: 'Editar carta digital' },

  // Inventario y caja
  { module: 'Inventario', key: 'stock.view', label: 'Ver stock' },
  { module: 'Inventario', key: 'stock.edit', label: 'Editar stock / entradas' },
  { module: 'Inventario', key: 'mermas.view', label: 'Ver mermas' },
  { module: 'Inventario', key: 'mermas.edit', label: 'Registrar mermas' },
  { module: 'Caja', key: 'caja.view',  label: 'Ver caja' },
  { module: 'Caja', key: 'caja.open',  label: 'Abrir turno de caja' },
  { module: 'Caja', key: 'caja.close', label: 'Cerrar turno de caja' },

  // Personal
  { module: 'Personal', key: 'turnos.view',   label: 'Ver turnos' },
  { module: 'Personal', key: 'turnos.manage', label: 'Gestionar turnos' },
  { module: 'Personal', key: 'equipo.view',   label: 'Ver equipo' },
  { module: 'Personal', key: 'equipo.manage', label: 'Invitar / editar miembros' },

  // Analítica
  { module: 'Analítica', key: 'reportes.view',  label: 'Ver reporte del día' },
  { module: 'Analítica', key: 'analytics.view', label: 'Ver analytics avanzado' },
  { module: 'Analítica', key: 'insights.view',  label: 'Ver Chapi Insights' },

  // Configuración
  { module: 'Configuración', key: 'config.view',    label: 'Ver configuración' },
  { module: 'Configuración', key: 'config.edit',    label: 'Editar configuración' },
  { module: 'Configuración', key: 'plan.manage',    label: 'Cambiar plan / módulos' },
  { module: 'Configuración', key: 'roles.manage',   label: 'Crear / editar roles custom' },
]

// Presets por rol base (para pre-seleccionar permisos razonables)
export const BASE_ROLE_PRESETS: Record<string, string[]> = {
  owner: PERMISSIONS.map(p => p.key), // owner tiene todo
  admin: PERMISSIONS.filter(p => p.key !== 'plan.manage').map(p => p.key),
  supervisor: [
    'dashboard.view','comandas.view','comandas.edit','comandas.cobrar',
    'mesas.view','mesas.manage','reservas.view','reservas.manage',
    'carta.view','stock.view','stock.edit','mermas.view','mermas.edit',
    'caja.view','caja.open','caja.close','turnos.view','turnos.manage',
    'equipo.view','reportes.view',
  ],
  garzon: [
    'dashboard.view','comandas.view','comandas.edit','comandas.cobrar',
    'mesas.view','mesas.manage','reservas.view','carta.view',
  ],
  cocina: [
    'comandas.view','comandas.edit','stock.view','mermas.view','mermas.edit',
  ],
  anfitrion: [
    'dashboard.view','mesas.view','mesas.manage','reservas.view','reservas.manage',
  ],
}

export function permissionsByModule() {
  const grouped: Record<string, PermissionDef[]> = {}
  for (const p of PERMISSIONS) {
    if (!grouped[p.module]) grouped[p.module] = []
    grouped[p.module].push(p)
  }
  return grouped
}
