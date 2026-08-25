import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Geist_Mono, Poppins } from 'next/font/google'
import { Toaster } from '@/components/ui/sonner'
import './globals.css'

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-geist-sans',
})

const geistMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-geist-mono',
})

const siteTitle = 'UNICRÉDITOS — Plataforma de Soluciones Financieras'
const siteDescription =
  'Créditos que transforman vidas y negocios. Impulsamos tus proyectos, construimos tu futuro. Préstamos personales, crédito PyME y financiación en comercios. unicreditos.com'

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://unicreditos.com'),
  title: siteTitle,
  description: siteDescription,
  applicationName: 'UNICRÉDITOS',
  authors: [{ name: 'RM International Group S.A.S.' }],
  creator: 'RM International Group S.A.S.',
  alternates: {
    canonical: '/',
  },
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
  themeColor: '#081D3A',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es-AR" className={`${poppins.variable} ${geistMono.variable} bg-background`}>
      <body className="font-sans antialiased">
        {children}
        <Toaster richColors closeButton position="top-right" />
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
