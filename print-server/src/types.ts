// Shared types between cloud and print agent.
// Mirror of /api/print/jobs payload schema (Zod) — keep in sync.

export type Align    = 'left' | 'center' | 'right'
export type LineSize = 'normal' | 'large'

export interface PrintLine {
  text:    string
  align:   Align
  bold:    boolean
  size:    LineSize
  cut:     boolean
  feed:    number
  divider: boolean
}

export interface PrintPayload {
  header?: string
  footer?: string
  copies:  number
  lines:   PrintLine[]
}

export interface PrintJob {
  id:            string
  restaurant_id: string
  server_id:     string
  job_type:      'receipt' | 'kitchen_ticket' | 'bar_ticket' | 'cash_close' | 'test'
  payload:       PrintPayload
  status:        'pending' | 'printing' | 'completed' | 'failed'
  attempts:      number
}

export interface PrintServerConfig {
  id:            string
  restaurant_id: string
  name:          string
  printer_kind:  'network' | 'usb' | 'serial'
  printer_addr:  string | null
  paper_width:   number
  active:        boolean
}
