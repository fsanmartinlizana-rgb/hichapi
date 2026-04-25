import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // @react-pdf/renderer debe correr en Node.js puro (no en el bundle de webpack)
  // porque su build browser falla en route handlers del servidor.
  // Al marcarlo como serverExternalPackages, Node.js lo resuelve directamente
  // usando el campo "main" del package.json (react-pdf.js, no react-pdf.browser.js).
  serverExternalPackages: ['bwip-js', '@react-pdf/renderer'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      // Supabase Storage (público) — fotos de restaurantes, galería, avatars
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
  async redirects() {
    return []
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options',    value: 'nosniff' },
          { key: 'X-Frame-Options',           value: 'DENY' },
          { key: 'X-XSS-Protection',          value: '1; mode=block' },
          { key: 'Referrer-Policy',           value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy',        value: 'camera=(), microphone=(), geolocation=(self)' },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
        ],
      },
    ]
  },
}

export default nextConfig
