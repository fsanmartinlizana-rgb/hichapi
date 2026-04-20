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
  stock_alerts: number
  open_tables:  number
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
