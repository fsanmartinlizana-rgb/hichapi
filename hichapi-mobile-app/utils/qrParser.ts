/**
 * QR code parsing utility for HiChapi Mobile App.
 * Parses HiChapi QR codes to extract slug and qr_token.
 */

export interface QRParseResult {
  slug: string;
  qrToken: string;
}

/**
 * Parses a HiChapi QR code URL and extracts slug and qr_token.
 *
 * Supports formats:
 * - hichapi://{slug}?qr_token={token}
 * - https://hichapi.cl/{slug}?qr_token={token}
 *
 * @returns QRParseResult if valid, null otherwise.
 *
 * @example
 * parseQRCode('hichapi://mesa-5?qr_token=abc123')
 * // → { slug: 'mesa-5', qrToken: 'abc123' }
 */
export function parseQRCode(url: string): QRParseResult | null {
  if (!url || typeof url !== 'string') return null;

  try {
    // Normalize custom scheme to https for URL parsing
    const normalized = url.startsWith('hichapi://')
      ? url.replace('hichapi://', 'https://hichapi.cl/')
      : url;

    const parsed = new URL(normalized);

    // 1. Try query parameter (hichapi://{slug}?qr_token={token})
    let qrToken = parsed.searchParams.get('qr_token');
    let slug = '';

    if (qrToken) {
      slug = parsed.pathname.replace(/^\//, '');
    } else {
      // 2. Try path-based (/{slug}/{qrToken})
      const segments = parsed.pathname.split('/').filter(Boolean);
      if (segments.length >= 2) {
        slug = segments[0];
        qrToken = segments[1];
      }
    }

    if (!slug || !qrToken) return null;

    return { slug, qrToken };
  } catch {
    return null;
  }
}
