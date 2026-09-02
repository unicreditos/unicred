import type { Metadata } from 'next'
import { publicSiteUrl } from '@/lib/site'

const SITE_NAME = 'UNICRÉDITOS'

export function absoluteUrl(path = '/') {
  const base = publicSiteUrl().replace(/\/$/, '')
  if (!path || path === '/') return base
  return `${base}${path.startsWith('/') ? path : `/${path}`}`
}

export function pageMetadata(input: {
  title: string
  description: string
  path: string
  noIndex?: boolean
}): Metadata {
  return {
    title: input.title,
    description: input.description,
    alternates: {
      canonical: input.path,
      languages: { 'es-AR': input.path },
    },
    openGraph: {
      title: `${input.title} · ${SITE_NAME}`,
      description: input.description,
      url: input.path,
      siteName: SITE_NAME,
      locale: 'es_AR',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${input.title} · ${SITE_NAME}`,
      description: input.description,
    },
    robots: input.noIndex
      ? { index: false, follow: false, googleBot: { index: false, follow: false } }
      : undefined,
  }
}

export function organizationJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE_NAME,
    legalName: 'RM International Group S.A.S.',
    parentOrganization: {
      '@type': 'Organization',
      name: 'UNIPAGOS',
      url: 'https://unipagos.com.ar/',
    },
    url: absoluteUrl('/'),
    logo: absoluteUrl('/apple-icon'),
    description:
      'Créditos personales online en Argentina. TNA y CFT informados antes de firmar. Consulta a la Central de Deudores del BCRA con autorización del titular.',
    email: 'soporte@unicreditos.com',
    address: {
      '@type': 'PostalAddress',
      streetAddress: 'Maipú 566, piso 4° “D”',
      addressLocality: 'Ciudad Autónoma de Buenos Aires',
      postalCode: '1006',
      addressCountry: 'AR',
    },
    sameAs: [
      'https://unipagos.com.ar/',
      'https://www.unicreditos.com/',
    ],
  }
}

export function websiteJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    url: absoluteUrl('/'),
    inLanguage: 'es-AR',
    publisher: {
      '@type': 'Organization',
      name: SITE_NAME,
    },
  }
}
