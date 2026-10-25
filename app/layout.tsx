import type { Metadata, Viewport } from 'next'
import dynamic from 'next/dynamic'
import { JetBrains_Mono, Plus_Jakarta_Sans } from 'next/font/google'
import { SiteJsonLd } from '@/components/json-ld'
import { SkipLink } from '@/components/skip-link'
import { maintenanceEnabled } from '@/lib/maintenance'
import { PUBLIC_PATH_REGEX_SOURCE } from '@/lib/public-routes'
import './globals.css'

const CookieConsent = dynamic(() => import('@/components/cookie-consent').then((m) => m.CookieConsent))
const Toaster = dynamic(() => import('@/components/ui/sonner').then((m) => m.Toaster))

// Una sola familia para todo el sitio (público, ingreso, panel y admin): títulos y texto.
const sans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-geist-sans',
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
  'Plataforma de soluciones financieras: préstamos personales online, pagos de servicios, billetera virtual y red de comercios, con el costo completo a la vista.'

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

/* Tema (claro/oscuro): se aplica antes del primer pintado sin parpadeo. */
const THEME_SCRIPT =
  "(function(){try{var t=localStorage.getItem('theme')||localStorage.getItem('uc-theme');if(new RegExp(" +
  JSON.stringify(PUBLIC_PATH_REGEX_SOURCE) +
  ").test(location.pathname)){t='light'}else if(t!=='dark'&&t!=='light'){t=window.matchMedia&&matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}if(t==='dark'){document.documentElement.classList.add('dark')}else{document.documentElement.classList.remove('dark')}document.documentElement.setAttribute('data-theme',t)}catch(e){}})();"

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es-AR" suppressHydrationWarning className={`${sans.variable} ${mono.variable} bg-background`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
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
