import type { Metadata, Viewport } from 'next'
import dynamic from 'next/dynamic'
import { Bricolage_Grotesque, Instrument_Sans, JetBrains_Mono } from 'next/font/google'
import { SiteJsonLd } from '@/components/json-ld'
import { SkipLink } from '@/components/skip-link'
import { maintenanceEnabled } from '@/lib/maintenance'
import './globals.css'

const CookieConsent = dynamic(() => import('@/components/cookie-consent').then((m) => m.CookieConsent))
const Toaster = dynamic(() => import('@/components/ui/sonner').then((m) => m.Toaster))

// Texto de todo el sitio (público, ingreso, panel y admin): Instrument Sans, sobria y muy legible en cifras.
const sans = Instrument_Sans({
  subsets: ['latin'],
  variable: '--font-geist-sans',
  display: 'swap',
})

// Títulos: Bricolage Grotesque, con carácter y ancho variable. Se usa con moderación (clase font-display).
const display = Bricolage_Grotesque({
  subsets: ['latin'],
  variable: '--font-bricolage',
  display: 'swap',
})

const mono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-geist-mono',
  display: 'swap',
  preload: false,
})

// Con el sitio cerrado no se publican datos de la empresa: ni autor en el <head> ni JSON-LD.
const closed = maintenanceEnabled()

const siteTitle = 'UNICRÉDITOS · Plataforma de soluciones financieras'
const siteDescription =
  'Plataforma de soluciones financieras: préstamos personales online y financiación para comercios, con el costo completo a la vista antes de firmar.'

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://unicreditos.com'),
  title: {
    default: siteTitle,
    template: '%s · UNICRÉDITOS',
  },
  description: siteDescription,
  applicationName: 'UNICRÉDITOS',
  ...(closed ? {} : { authors: [{ name: 'RM International Group S.A.S.' }], creator: 'RM International Group S.A.S.' }),
  openGraph: {
    type: 'website',
    siteName: 'UNICRÉDITOS',
    locale: 'es_AR',
    url: '/',
    title: siteTitle,
    description: siteDescription,
  },
  twitter: {
    card: 'summary_large_image',
    title: siteTitle,
    description: siteDescription,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
}

export const viewport: Viewport = {
  colorScheme: 'light',
  themeColor: '#0B1E3F',
}

import { AnalyticsGate } from '@/components/analytics-gate'
import { ThemeProvider } from '@/components/theme-provider'

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="es-AR"
      suppressHydrationWarning
      data-scroll-behavior="smooth"
      className={`${sans.variable} ${display.variable} ${mono.variable} bg-background`}
    >
      <body className="font-sans antialiased text-foreground bg-background">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <SkipLink />
          {closed ? null : <SiteJsonLd />}
          {children}
          <CookieConsent />
          <Toaster richColors closeButton position="top-right" />
          <AnalyticsGate />
        </ThemeProvider>
      </body>
    </html>
  )
}
