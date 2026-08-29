import type { MetadataRoute } from 'next'

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://unicreditos.com'

type Route = {
  path: string
  changeFrequency: NonNullable<MetadataRoute.Sitemap[number]['changeFrequency']>
  priority: number
}

const routes: Route[] = [
  { path: '/', changeFrequency: 'weekly', priority: 1 },
  { path: '/prestamos', changeFrequency: 'weekly', priority: 0.95 },
  { path: '/comprar-en-cuotas', changeFrequency: 'weekly', priority: 0.95 },
  { path: '/pagos-servicios', changeFrequency: 'weekly', priority: 0.9 },
  { path: '/red-comercios', changeFrequency: 'weekly', priority: 0.85 },
  { path: '/preguntas-frecuentes', changeFrequency: 'monthly', priority: 0.75 },
  { path: '/simulador', changeFrequency: 'weekly', priority: 0.9 },
  { path: '/productos', changeFrequency: 'weekly', priority: 0.9 },
  { path: '/scoring', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/comercios', changeFrequency: 'weekly', priority: 0.85 },
  { path: '/datos-bcra', changeFrequency: 'weekly', priority: 0.7 },
  { path: '/contacto', changeFrequency: 'monthly', priority: 0.6 },
  { path: '/directo', changeFrequency: 'weekly', priority: 0.7 },
  { path: '/directo/productos', changeFrequency: 'weekly', priority: 0.65 },
  { path: '/legal/terminos', changeFrequency: 'yearly', priority: 0.4 },
  { path: '/legal/privacidad', changeFrequency: 'yearly', priority: 0.4 },
  { path: '/legal/arrepentimiento', changeFrequency: 'yearly', priority: 0.45 },
  { path: '/legal/baja', changeFrequency: 'yearly', priority: 0.45 },
  { path: '/legal/usuario-financiero', changeFrequency: 'yearly', priority: 0.5 },
  { path: '/legal/tasas', changeFrequency: 'monthly', priority: 0.55 },
  { path: '/legal/defensa-consumidor', changeFrequency: 'yearly', priority: 0.45 },
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
