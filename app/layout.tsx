import type { Metadata, Viewport } from 'next'
import { Bricolage_Grotesque, Instrument_Sans, JetBrains_Mono } from 'next/font/google'
import { AnalyticsGate } from '@/components/analytics-gate'
import { CookieConsent } from '@/components/cookie-consent'
import { SiteJsonLd } from '@/components/json-ld'
import { SkipLink } from '@/components/skip-link'
import { Toaster } from '@/components/ui/sonner'
import './globals.css'

const sans = Instrument_Sans({
  subsets: ['latin'],
  variable: '--font-geist-sans',
  display: 'swap',
})

const display = Bricolage_Grotesque({
  subsets: ['latin'],
  variable: '--font-display-face',
  display: 'swap',
})

const mono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-geist-mono',
  display: 'swap',
})

const siteTitle = 'UNICRÉDITOS'
const siteDescription =
  'Préstamos personales y comerciales en línea con simulación de cuotas, scoring BCRA y gestión de pagos.'

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

/* Tema de los paneles (claro/oscuro): se aplica antes del primer pintado. Va acá, en el layout raíz, y no
   en los de los paneles: un <script> dentro de un componente que React vuelve a dibujar en el cliente
   (al navegar entre pantallas) genera un aviso y no se ejecuta. Solo marca <html data-theme>; los
   estilos viven bajo .uc, así que el sitio público no cambia. */
const THEME_SCRIPT =
  "(function(){try{var t=localStorage.getItem('uc-theme');if(t!=='dark'&&t!=='light'){t=window.matchMedia&&matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}document.documentElement.setAttribute('data-theme',t)}catch(e){document.documentElement.setAttribute('data-theme','light')}})();"

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es-AR" suppressHydrationWarning className={`${sans.variable} ${display.variable} ${mono.variable} bg-background`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
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
