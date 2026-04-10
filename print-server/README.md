# HiChapi Print Agent

Local Node service that listens for print jobs from the HiChapi cloud and
drives an ESC/POS thermal printer (network, USB, or serial).

## Setup

```bash
cd print-server
npm install
cp .env.example .env
# fill in HICHAPI_API_URL, SUPABASE_URL, SUPABASE_ANON_KEY, PRINT_SERVER_TOKEN
npm run dev
```

The bearer token is issued from the admin app under **Inventario → Impresoras**
when you register a new print server. It is shown only once.

## Architecture

```
HiChapi cloud (Next.js)               Local agent (this package)
─────────────────────────             ─────────────────────────────
POST /api/print/jobs   ───┐
                          │ insert
                          ▼
                  print_jobs (Supabase)
                          │
                          │ Realtime INSERT
                          ▼
                                       handleJob() → encodeJob() → transport.send()
                                       PATCH /api/print/agent (status)
```

- **No inbound ports.** The agent only opens an outbound WebSocket to Supabase
  Realtime and HTTPS POSTs to the cloud — runs behind any NAT.
- **Token auth.** Stored as sha256 hash on the cloud, plaintext only in
  `.env` on the local machine.
- **Pluggable transports.** `network` (TCP :9100), `usb` (raw character
  device), `serial` (stub, install `serialport` to wire it up).

## Test print

From the cloud admin you can enqueue a `test` job. The agent prints a single
line + cut so you can verify the printer responds.
