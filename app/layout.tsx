import type { Metadata, Viewport } from 'next'
import { Geist_Mono, Plus_Jakarta_Sans } from 'next/font/google'
import { AnalyticsGate } from '@/components/analytics-gate'
import { CookieConsent } from '@/components/cookie-consent'
import { SiteJsonLd } from '@/components/json-ld'
import { SkipLink } from '@/components/skip-link'
import { Toaster } from '@/components/ui/sonner'
import './globals.css'

const sans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-geist-sans',
  display: 'swap',
})

const geistMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-geist-mono',
  display: 'swap',
})

const siteTitle = 'UNICRÉDITOS — Créditos, cuotas y pagos'
const siteDescription =
  'Tu manera de comprar en cuotas y pedir préstamos digitales. Billetera, pagos de servicios, KYC y BCRA. TNA y CFT a la vista. unicreditos.com'

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://unicreditos.com'),
  title: {
    default: siteTitle,
    template: '%s · UNICRÉDITOS',
  },
  description: siteDescription,
  applicationName: 'UNICRÉDITOS',
  authors: [{ name: 'RM International Group S.A.S.' }],
  creator: 'RM International Group S.A.S.',
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
  themeColor: '#20BD5A',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es-AR" className={`${sans.variable} ${geistMono.variable} bg-background`}>
      <body className="font-sans antialiased">
        <SkipLink />
        <SiteJsonLd />
        {children}
        <CookieConsent />
        <Toaster richColors closeButton position="top-right" />
        <AnalyticsGate />
      </body>
    </html>
  )
}
