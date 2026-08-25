import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

const projectRoot = dirname(fileURLToPath(import.meta.url))

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Sin esto Turbopack sube hasta el home del usuario buscando el lockfile.
  turbopack: {
    root: projectRoot,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  images: {
    unoptimized: true,
  },
  reactStrictMode: true,
  poweredByHeader: false,
  serverExternalPackages: ['soap', 'node-forge', 'xml2js'],
  compress: true,
  generateEtags: true,
  async redirects() {
    return [{ source: '/mercado', destination: '/datos-bcra', permanent: false }]
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value:
              'camera=(self "https://verify.didit.me" "https://verification.didit.me"), microphone=(self "https://verify.didit.me" "https://verification.didit.me"), geolocation=()',
          },
          {
            key: 'Content-Security-Policy',
            value: "frame-src 'self' https://verify.didit.me https://verification.didit.me",
          },
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
