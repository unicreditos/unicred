import type { MetadataRoute } from 'next'

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://unicreditos.com'

type Route = {
  path: string
  changeFrequency: NonNullable<MetadataRoute.Sitemap[number]['changeFrequency']>
  priority: number
}

const routes: Route[] = [
  { path: '/', changeFrequency: 'weekly', priority: 1 },
  { path: '/simulador', changeFrequency: 'weekly', priority: 0.9 },
  { path: '/productos', changeFrequency: 'weekly', priority: 0.9 },
  { path: '/scoring', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/comercios', changeFrequency: 'weekly', priority: 0.8 },
  { path: '/contacto', changeFrequency: 'monthly', priority: 0.6 },
  { path: '/legal/terminos', changeFrequency: 'yearly', priority: 0.4 },
  { path: '/legal/privacidad', changeFrequency: 'yearly', priority: 0.4 },
  { path: '/sign-in', changeFrequency: 'yearly', priority: 0.3 },
  { path: '/sign-up', changeFrequency: 'yearly', priority: 0.5 },
]

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date()

  return routes.map(({ path, changeFrequency, priority }) => ({
    url: path === '/' ? siteUrl : `${siteUrl}${path}`,
    lastModified,
    changeFrequency,
    priority,
  }))
}
