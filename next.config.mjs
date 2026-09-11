import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

const projectRoot = dirname(fileURLToPath(import.meta.url))

const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  "frame-ancestors 'self'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  // Next.js + Mercado Pago Bricks + Didit embed. Nonces require middleware wiring;
  // keep 'unsafe-inline'/'unsafe-eval' until that lands.
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://sdk.mercadopago.com https://www.mercadopago.com https://http2.mlstatic.com https://*.mlstatic.com https://www.google.com https://www.gstatic.com",
  "connect-src 'self' https://api.mercadopago.com https://api.mercadolibre.com https://*.mercadopago.com https://*.mercadolibre.com https://*.mlstatic.com https://verification.didit.me https://*.didit.me https://vitals.vercel-insights.com https://va.vercel-scripts.com",
  "frame-src 'self' https://verify.didit.me https://verification.didit.me https://www.mercadopago.com https://*.mercadopago.com https://www.google.com",
  // Sin esto el admin no puede reproducir el video de prueba de vida de Didit
  // al revisar una identidad: cae en default-src y el bucket queda bloqueado.
  "media-src 'self' https://service-didit-verification-production-a1c5f9b8.s3.amazonaws.com",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  'upgrade-insecure-requests',
].join('; ')

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
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      { protocol: 'https', hostname: 'verification.didit.me' },
      { protocol: 'https', hostname: 'verify.didit.me' },
      { protocol: 'https', hostname: 'www.mercadopago.com' },
      { protocol: 'https', hostname: 'http2.mlstatic.com' },
    ],
  },
  reactStrictMode: true,
  poweredByHeader: false,
  serverExternalPackages: ['soap', 'node-forge', 'xml2js'],
  compress: true,
  generateEtags: true,
  async redirects() {
    return [
      { source: '/mercado', destination: '/datos-bcra', permanent: false },
      { source: '/pedir', destination: '/', permanent: true },
      { source: '/pedir/solicitud', destination: '/sign-up', permanent: true },
      { source: '/pedir/solicitud/:path*', destination: '/sign-up', permanent: true },
      { source: '/pedir/ingresar', destination: '/sign-in', permanent: true },
      { source: '/pedir/ingresar/:path*', destination: '/sign-in', permanent: true },
      { source: '/pedir/faq', destination: '/contacto', permanent: true },
      { source: '/pedir/faq/:path*', destination: '/contacto', permanent: true },
      { source: '/pedir/contacto', destination: '/contacto', permanent: true },
      { source: '/pedir/contacto/:path*', destination: '/contacto', permanent: true },
      { source: '/pedir/ayuda', destination: '/contacto', permanent: true },
      { source: '/pedir/ayuda/:path*', destination: '/contacto', permanent: true },
      { source: '/pedir/cuenta', destination: '/dashboard', permanent: true },
      { source: '/pedir/cuenta/:path*', destination: '/dashboard', permanent: true },
      { source: '/pedir/legal/terminos', destination: '/legal/terminos', permanent: true },
      { source: '/pedir/legal/terminos/:path*', destination: '/legal/terminos', permanent: true },
      { source: '/pedir/legal/privacidad', destination: '/legal/privacidad', permanent: true },
      { source: '/pedir/legal/privacidad/:path*', destination: '/legal/privacidad', permanent: true },
      { source: '/pedir/pagar/:id', destination: '/pagar/:id', permanent: true },
      { source: '/pedir/docs/contrato/:id', destination: '/dashboard/documentos/contrato/:id', permanent: true },
      { source: '/pedir/docs/pagare/:id', destination: '/dashboard/documentos/pagare/:id', permanent: true },
      { source: '/pedir/docs/cuponera/:id', destination: '/dashboard/documentos/cuponera/:id', permanent: true },
      { source: '/pedir/:path*', destination: '/', permanent: true },
    ]
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
          { key: 'X-Permitted-Cross-Domain-Policies', value: 'none' },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          {
            key: 'Permissions-Policy',
            value:
              'camera=(self "https://verify.didit.me" "https://verification.didit.me"), microphone=(self "https://verify.didit.me" "https://verification.didit.me"), geolocation=(), payment=(self)',
          },
          {
            key: 'Content-Security-Policy',
            value: csp,
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
