import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

const projectRoot = dirname(fileURLToPath(import.meta.url))

const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
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
  // Nadie puede incrustar el sitio salvo él mismo (los documentos del panel se muestran en un iframe propio).
  "frame-ancestors 'self'",
  'upgrade-insecure-requests',
].join('; ')

const isProd = process.env.NODE_ENV === 'production'

/**
 * Backoffice: nada de terceros. Sin Mercado Pago, sin Didit, sin frames externos y sin conexiones
 * salientes desde el navegador: si un XSS lograra ejecutar código, no tendría adónde mandar los datos.
 * ('unsafe-eval' solo en desarrollo: lo necesita el recargado en caliente.)
 */
const adminCsp = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  `script-src 'self' 'unsafe-inline'${isProd ? '' : " 'unsafe-eval'"}`,
  "connect-src 'self'",
  "frame-src 'self'",
  "media-src 'self'",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "frame-ancestors 'self'",
  'upgrade-insecure-requests',
].join('; ')

/** Paneles autenticados (/admin y /dashboard): aislados del resto del sitio y del navegador. */
const panelIsolation = [
  // No se filtra la URL del panel a ningún otro sitio ni en enlaces ni en recursos.
  { key: 'Referrer-Policy', value: 'no-referrer' },
  // Lo autenticado no se guarda en cachés compartidas ni en el historial offline.
  { key: 'Cache-Control', value: 'private, no-store, max-age=0, must-revalidate' },
  { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive, nosnippet' },
  { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
]

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
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
  // Los íconos se importan de a uno: sin esto el paquete entero entra en el JS de la página.
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
  serverExternalPackages: ['soap', 'node-forge', 'xml2js'],
  compress: true,
  generateEtags: true,
  async redirects() {
    return [
      // Backoffice: cada sección tiene su propia página (rutas del rediseño).
      { source: '/admin/solicitudes', destination: '/admin/originacion/solicitudes', permanent: false },
      { source: '/admin/solicitudes/:id', destination: '/admin/originacion/solicitudes/:id', permanent: false },
      { source: '/admin/kyc', destination: '/admin/originacion/kyc', permanent: false },
      { source: '/admin/clientes', destination: '/admin/clientes/planilla', permanent: false },
      { source: '/admin/creditos', destination: '/admin/creditos/otorgados', permanent: false },
      { source: '/admin/creditos/:id(loan_.*)', destination: '/admin/creditos/otorgados/:id', permanent: false },
      { source: '/admin/pagos', destination: '/admin/cobranzas/pagos', permanent: false },
      { source: '/admin/desembolsos', destination: '/admin/creditos/desembolso', permanent: false },
      { source: '/admin/auditoria', destination: '/admin/sistema/auditoria', permanent: false },
      { source: '/admin/cobranzas', destination: '/admin/cobranzas/mora', permanent: false },
      { source: '/admin/originacion', destination: '/admin/originacion/solicitudes', permanent: false },
      { source: '/admin/finanzas', destination: '/admin/finanzas/resumen', permanent: false },
      { source: '/admin/sistema', destination: '/admin/sistema/productos', permanent: false },
      // Panel del cliente
      { source: '/dashboard/cuotas', destination: '/dashboard/pagos', permanent: false },
      { source: '/dashboard/cuenta', destination: '/dashboard/perfil', permanent: false },
      { source: '/mercado', destination: '/datos-bcra', permanent: false },
      { source: '/directo', destination: '/', permanent: true },
      { source: '/directo/:path*', destination: '/prestamos', permanent: true },
      { source: '/productos', destination: '/prestamos', permanent: true },
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
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
        ],
      },
      { source: '/dashboard/:path*', headers: panelIsolation },
      {
        source: '/admin/:path*',
        headers: [
          ...panelIsolation,
          { key: 'Content-Security-Policy', value: adminCsp },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=(), bluetooth=()',
          },
        ],
      },
    ]
  },
}

export default nextConfig
