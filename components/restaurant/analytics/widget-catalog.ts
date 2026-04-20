// ── Widget catalog for /analytics "Mi dashboard" ────────────────────────────
// Cada entrada define un widget disponible para el usuario. Type es la key
// canonical que persiste en dashboard_layouts.widgets[].type.
//
// defaultSize: tamaño por defecto al agregarlo (grid 12-col). El usuario
// puede redimensionar luego.

export interface WidgetDef {
  type:         string
  label:        string
  description:  string
  icon:         string            // lucide icon name
  defaultSize:  { w: number; h: number }
  planRequired: 'free' | 'starter' | 'pro' | 'enterprise'
}

export const WIDGET_CATALOG: WidgetDef[] = [
  {
    type:         'revenue_today',
    label:        'Revenue de hoy',
    description:  'Total vendido hoy con delta vs ayer',
    icon:         'DollarSign',
    defaultSize:  { w: 3, h: 2 },
    planRequired: 'pro',
  },
  {
    type:         'revenue_week',
    label:        'Revenue de la semana',
    description:  'Total últimos 7 días con delta',
    icon:         'TrendingUp',
    defaultSize:  { w: 3, h: 2 },
    planRequired: 'pro',
  },
  {
    type:         'avg_ticket',
    label:        'Ticket promedio',
    description:  'Monto promedio por pedido pagado',
    icon:         'Receipt',
    defaultSize:  { w: 3, h: 2 },
    planRequired: 'pro',
  },
  {
    type:         'open_tables_now',
    label:        'Mesas ocupadas ahora',
    description:  'Contador en tiempo real',
    icon:         'Grid3x3',
    defaultSize:  { w: 3, h: 2 },
    planRequired: 'starter',
  },
  {
    type:         'inventory_low_stock',
    label:        'Alertas de stock bajo',
    description:  'Insumos que bajaron del umbral',
    icon:         'AlertTriangle',
    defaultSize:  { w: 3, h: 2 },
    planRequired: 'pro',
  },
  {
    type:         'top_items_week',
    label:        'Top productos de la semana',
    description:  'Los 5 más vendidos',
    icon:         'TrendingUp',
    defaultSize:  { w: 6, h: 4 },
    planRequired: 'pro',
  },
  {
    type:         'occupancy_heatmap',
    label:        'Ocupación por día y hora',
    description:  'Mapa de calor 7×24 para detectar horas valle y picos',
    icon:         'Grid3x3',
    defaultSize:  { w: 12, h: 5 },
    planRequired: 'pro',
  },
  {
    type:         'orders_by_hour',
    label:        'Órdenes por hora (barras)',
    description:  'Vista compacta de barras horarias del período',
    icon:         'BarChart2',
    defaultSize:  { w: 6, h: 4 },
    planRequired: 'pro',
  },
  {
    type:         'chapi_tip_of_the_day',
    label:        'Consejo de Chapi',
    description:  'Insight automático de IA',
    icon:         'Sparkles',
    defaultSize:  { w: 6, h: 3 },
    planRequired: 'pro',
  },
  {
    type:         'waste_cost',
    label:        'Pérdidas por mermas',
    description:  'Costo total y top razones',
    icon:         'Trash2',
    defaultSize:  { w: 3, h: 2 },
    planRequired: 'pro',
  },
  {
    type:         'waste_breakdown',
    label:        'Mermas por razón',
    description:  'Detalle por tipo de pérdida',
    icon:         'Trash2',
    defaultSize:  { w: 6, h: 3 },
    planRequired: 'pro',
  },
]

export function widgetDef(type: string): WidgetDef | undefined {
  return WIDGET_CATALOG.find(w => w.type === type)
}
