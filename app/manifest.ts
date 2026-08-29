import type { MetadataRoute } from 'next'
import { BRAND } from '@/lib/brand'

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: BRAND.company,
    short_name: BRAND.company,
    description: `${BRAND.slogan}. ${BRAND.valueProp}`,
    lang: 'es-AR',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    theme_color: '#20BD5A',
    background_color: '#F7F8F6',
    categories: ['finance', 'business'],
    icons: [
      {
        src: '/icon',
        sizes: '32x32',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/apple-icon',
        sizes: '180x180',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/192',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/512',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}
