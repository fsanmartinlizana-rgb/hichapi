// Minimal ESC/POS encoder. Generates raw bytes that you pipe to the printer.
// Supports the subset our PrintLine schema actually uses: align, bold, size,
// dividers, line feeds, and full cut. Compatible with most thermal POS
// printers (Epson TM-T20/T88, Bixolon SRP-275, Xprinter XP-58, etc).

import type { PrintLine, PrintPayload } from './types.js'

const ESC = 0x1b
const GS  = 0x1d
const LF  = 0x0a

// Control sequences
const INIT          = Buffer.from([ESC, 0x40])                       // ESC @
const ALIGN_LEFT    = Buffer.from([ESC, 0x61, 0])
const ALIGN_CENTER  = Buffer.from([ESC, 0x61, 1])
const ALIGN_RIGHT   = Buffer.from([ESC, 0x61, 2])
const BOLD_ON       = Buffer.from([ESC, 0x45, 1])
const BOLD_OFF      = Buffer.from([ESC, 0x45, 0])
const SIZE_NORMAL   = Buffer.from([GS,  0x21, 0x00])
const SIZE_LARGE    = Buffer.from([GS,  0x21, 0x11])                 // 2x width + 2x height
const CUT_FULL      = Buffer.from([GS,  0x56, 0])
const FEED_LINES    = (n: number) => Buffer.from([ESC, 0x64, n])     // ESC d n

// CP437 / Latin-1 transliteration table for the few accented chars we care
// about. Most cheap thermal printers default to CP437; this avoids garbled
// "ñ" and "á" without us needing to negotiate codepages.
const TRANSLIT: Record<string, string> = {
  'á': 'a', 'é': 'e', 'í': 'i', 'ó': 'o', 'ú': 'u',
  'Á': 'A', 'É': 'E', 'Í': 'I', 'Ó': 'O', 'Ú': 'U',
  'ñ': 'n', 'Ñ': 'N',
  'ü': 'u', 'Ü': 'U',
  '¿': '?', '¡': '!',
  '°': 'o',
}

function safeAscii(input: string): string {
  let out = ''
  for (const ch of input) out += TRANSLIT[ch] ?? ch
  // Strip any remaining non-ascii to avoid printer garbage
  return out.replace(/[^\x20-\x7E]/g, '')
}

function lineDivider(width: number): string {
  return '-'.repeat(width)
}

export function encodeJob(payload: PrintPayload, paperWidth: number): Buffer {
  const chunks: Buffer[] = [INIT]

  if (payload.header) {
    chunks.push(ALIGN_CENTER, BOLD_ON, SIZE_LARGE)
    chunks.push(Buffer.from(safeAscii(payload.header) + '\n', 'ascii'))
    chunks.push(SIZE_NORMAL, BOLD_OFF, ALIGN_LEFT, FEED_LINES(1))
  }

  for (const line of payload.lines) {
    chunks.push(...encodeLine(line, paperWidth))
  }

  if (payload.footer) {
    chunks.push(FEED_LINES(1), ALIGN_CENTER)
    chunks.push(Buffer.from(safeAscii(payload.footer) + '\n', 'ascii'))
    chunks.push(ALIGN_LEFT)
  }

  // Always feed + cut at the end
  chunks.push(FEED_LINES(3), CUT_FULL)
  return Buffer.concat(chunks)
}

function encodeLine(line: PrintLine, paperWidth: number): Buffer[] {
  const out: Buffer[] = []

  if (line.divider) {
    out.push(ALIGN_LEFT, Buffer.from(lineDivider(paperWidth) + '\n', 'ascii'))
    return out
  }

  switch (line.align) {
    case 'center': out.push(ALIGN_CENTER); break
    case 'right':  out.push(ALIGN_RIGHT);  break
    default:       out.push(ALIGN_LEFT);   break
  }

  if (line.bold) out.push(BOLD_ON)
  if (line.size === 'large') out.push(SIZE_LARGE)

  out.push(Buffer.from(safeAscii(line.text) + '\n', 'ascii'))

  if (line.size === 'large') out.push(SIZE_NORMAL)
  if (line.bold)             out.push(BOLD_OFF)

  if (line.feed > 0) out.push(FEED_LINES(line.feed))
  if (line.cut)      out.push(CUT_FULL)

  return out
}

// Sentinel exposed for the test job
export { LF }
