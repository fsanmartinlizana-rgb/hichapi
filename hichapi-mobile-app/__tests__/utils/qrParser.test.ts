/**
 * Unit tests for utils/qrParser.ts
 */

import { parseQRCode } from '../../utils/qrParser';

describe('parseQRCode', () => {
  it('parses hichapi:// scheme URL', () => {
    const result = parseQRCode('hichapi://mesa-5?qr_token=abc123');
    expect(result).toEqual({ slug: 'mesa-5', qrToken: 'abc123' });
  });

  it('parses https://hichapi.cl URL', () => {
    const result = parseQRCode('https://hichapi.cl/mesa-5?qr_token=abc123');
    expect(result).toEqual({ slug: 'mesa-5', qrToken: 'abc123' });
  });

  it('returns null when qr_token param is missing', () => {
    expect(parseQRCode('hichapi://mesa-5')).toBeNull();
    expect(parseQRCode('https://hichapi.cl/mesa-5')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(parseQRCode('')).toBeNull();
  });

  it('returns null for non-HiChapi URL', () => {
    expect(parseQRCode('https://example.com/mesa-5?qr_token=abc123')).toBeNull();
    expect(parseQRCode('https://google.com')).toBeNull();
  });

  it('handles URL-encoded tokens correctly', () => {
    const result = parseQRCode('hichapi://mesa-5?qr_token=abc%2B123%3D%3D');
    expect(result).not.toBeNull();
    expect(result?.qrToken).toBe('abc+123==');
  });

  it('handles slugs with hyphens and numbers', () => {
    const result = parseQRCode('hichapi://terraza-2-vip?qr_token=xyz789');
    expect(result).toEqual({ slug: 'terraza-2-vip', qrToken: 'xyz789' });
  });

  it('returns null for malformed URL', () => {
    expect(parseQRCode('not-a-url')).toBeNull();
    expect(parseQRCode('://broken')).toBeNull();
  });

  it('handles www.hichapi.cl domain', () => {
    const result = parseQRCode('https://www.hichapi.cl/mesa-1?qr_token=token123');
    expect(result).toEqual({ slug: 'mesa-1', qrToken: 'token123' });
  });
});
