// Printer transports — pluggable backends. Network is the default; USB and
// serial are stubs that explain how to wire them up locally.

import { createConnection } from 'node:net'
import { writeFile } from 'node:fs/promises'
import type { PrintServerConfig } from './types.js'

export interface Transport {
  send(bytes: Buffer): Promise<void>
}

export function makeTransport(cfg: PrintServerConfig): Transport {
  const kind = (process.env.PRINTER_KIND ?? cfg.printer_kind) as PrintServerConfig['printer_kind']
  const addr = process.env.PRINTER_ADDR ?? cfg.printer_addr ?? ''

  switch (kind) {
    case 'network': return new NetworkTransport(addr)
    case 'usb':     return new UsbTransport(addr)
    case 'serial':  return new SerialTransport(addr)
  }
}

// ── Network (TCP, port 9100) — most thermal POS printers ────────────────────

class NetworkTransport implements Transport {
  constructor(private addr: string) {
    if (!addr) throw new Error('NetworkTransport requires an addr like "192.168.1.50:9100"')
  }

  send(bytes: Buffer): Promise<void> {
    const [host, portStr] = this.addr.split(':')
    if (!host || !portStr) {
      return Promise.reject(new Error(`addr inválido: ${this.addr}`))
    }
    const port = parseInt(portStr, 10)
    return new Promise((resolve, reject) => {
      const sock = createConnection({ host, port })
      const timer = setTimeout(() => {
        sock.destroy()
        reject(new Error('timeout conectando a la impresora'))
      }, 5000)

      sock.on('connect', () => {
        sock.write(bytes, err => {
          if (err) { clearTimeout(timer); sock.destroy(); reject(err); return }
          sock.end()
        })
      })
      sock.on('end',   () => { clearTimeout(timer); resolve() })
      sock.on('error', err => { clearTimeout(timer); sock.destroy(); reject(err) })
    })
  }
}

// ── USB (raw character device on Linux) ─────────────────────────────────────
//
// On Linux, USB printers usually expose /dev/usb/lp0 (or lp1, lp2 …) which
// accepts raw ESC/POS bytes via a normal file write. On macOS/Windows you
// need a vendor driver — see node-escpos-usb if you need cross-platform.

class UsbTransport implements Transport {
  constructor(private device: string) {
    if (!device) throw new Error('UsbTransport requires a device path like "/dev/usb/lp0"')
  }
  async send(bytes: Buffer): Promise<void> {
    await writeFile(this.device, bytes)
  }
}

// ── Serial (RS-232) — kept as a stub for now ────────────────────────────────

class SerialTransport implements Transport {
  constructor(private device: string) {
    if (!device) throw new Error('SerialTransport requires a device path')
  }
  send(_bytes: Buffer): Promise<void> {
    return Promise.reject(new Error(
      'SerialTransport not implemented yet — install "serialport" and pipe bytes through.'
    ))
  }
}
