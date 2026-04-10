// ════════════════════════════════════════════════════════════════════════════
//  HiChapi Print Agent
//
//  Connects to the cloud, registers itself via bearer token, and listens for
//  print jobs via Supabase Realtime. Each job is encoded to ESC/POS and sent
//  to the configured printer transport. Status is PATCHed back to the cloud.
//
//  Run:  npm install && cp .env.example .env && npm run dev
// ════════════════════════════════════════════════════════════════════════════

import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import { encodeJob } from './escpos.js'
import { makeTransport } from './printer.js'
import type { PrintJob, PrintServerConfig } from './types.js'

// ── Config ──────────────────────────────────────────────────────────────────

const API_URL          = process.env.HICHAPI_API_URL ?? ''
const SUPABASE_URL     = process.env.SUPABASE_URL ?? ''
const SUPABASE_ANON    = process.env.SUPABASE_ANON_KEY ?? ''
const PRINT_TOKEN      = process.env.PRINT_SERVER_TOKEN ?? ''

if (!API_URL || !SUPABASE_URL || !SUPABASE_ANON || !PRINT_TOKEN) {
  console.error('[print-agent] missing env vars — check .env')
  process.exit(1)
}

// ── Cloud calls ─────────────────────────────────────────────────────────────

async function fetchServerConfig(): Promise<PrintServerConfig> {
  const res = await fetch(`${API_URL}/api/print/agent`, {
    headers: { Authorization: `Bearer ${PRINT_TOKEN}` },
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`cloud auth failed: ${res.status} ${body}`)
  }
  const data = await res.json()
  return data.server as PrintServerConfig
}

async function reportStatus(jobId: string, status: 'printing' | 'completed' | 'failed', errorMessage?: string) {
  await fetch(`${API_URL}/api/print/agent`, {
    method:  'PATCH',
    headers: {
      'Content-Type':  'application/json',
      Authorization:    `Bearer ${PRINT_TOKEN}`,
    },
    body: JSON.stringify({ job_id: jobId, status, error_message: errorMessage }),
  }).catch(err => console.error('[print-agent] status report failed:', err))
}

// ── Job processing ──────────────────────────────────────────────────────────

async function handleJob(job: PrintJob, cfg: PrintServerConfig) {
  console.log(`[print-agent] job ${job.id} (${job.job_type})`)
  await reportStatus(job.id, 'printing')

  try {
    const transport = makeTransport(cfg)
    const bytes = encodeJob(job.payload, cfg.paper_width)
    const copies = Math.max(1, job.payload.copies ?? 1)
    for (let i = 0; i < copies; i++) {
      await transport.send(bytes)
    }
    await reportStatus(job.id, 'completed')
    console.log(`[print-agent] job ${job.id} ok`)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown'
    console.error(`[print-agent] job ${job.id} failed:`, msg)
    await reportStatus(job.id, 'failed', msg)
  }
}

// ── Main loop ───────────────────────────────────────────────────────────────

async function main() {
  console.log('[print-agent] starting…')

  const cfg = await fetchServerConfig()
  console.log(`[print-agent] authenticated as "${cfg.name}" (${cfg.printer_kind} → ${cfg.printer_addr ?? '[from env]'})`)

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON)

  // Drain any pending jobs that landed before we connected
  const { data: pending } = await supabase
    .from('print_jobs')
    .select('*')
    .eq('server_id', cfg.id)
    .eq('status',    'pending')
    .order('created_at', { ascending: true })

  if (pending && pending.length > 0) {
    console.log(`[print-agent] draining ${pending.length} pending job(s)`)
    for (const job of pending as PrintJob[]) {
      await handleJob(job, cfg)
    }
  }

  // Subscribe to new jobs
  supabase
    .channel(`print_jobs:${cfg.id}`)
    .on(
      'postgres_changes',
      {
        event:  'INSERT',
        schema: 'public',
        table:  'print_jobs',
        filter: `server_id=eq.${cfg.id}`,
      },
      payload => {
        const job = payload.new as PrintJob
        void handleJob(job, cfg)
      },
    )
    .subscribe(status => {
      if (status === 'SUBSCRIBED') {
        console.log('[print-agent] listening for jobs via Supabase Realtime')
      }
    })

  // Heartbeat every 60s
  setInterval(() => { void fetchServerConfig().catch(() => {}) }, 60_000)
}

main().catch(err => {
  console.error('[print-agent] fatal:', err)
  process.exit(1)
})
