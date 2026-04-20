export interface AnalyticsSummary {
  period: 'dia' | 'semana' | 'mes' | '30d'
  range: { start: string; end: string }
  revenue: {
    total_paid:   number
    total_all:    number
    orders_count: number
    avg_ticket:   number
  }
  comparison: {
    prev_total_paid: number
    delta_pct:       number
  }
  top_items:    { name: string; qty: number; revenue: number }[]
  by_hour:      { hour: number; orders: number; revenue: number }[]
  by_day:       { date: string; orders: number; revenue: number }[]
  /** Heatmap por fecha calendario × hora. Array de filas, una por día del período. */
  heatmap_daily?: { date: string; cells: number[] }[]
  stock_alerts: number
  open_tables:  number
  waste?: {
    total_cost:   number
    events_count: number
    top_reasons:  { reason: string; count: number; cost: number }[]
  }
}

export interface WidgetInstance {
  id:     string
  type:   string
  x:      number
  y:      number
  w:      number
  h:      number
  config?: Record<string, unknown>
}
