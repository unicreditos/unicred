import type { MetadataRoute } from 'next'
import { BRAND } from '@/lib/brand'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: BRAND.company,
    short_name: BRAND.company,
    description: `${BRAND.slogan}. ${BRAND.valueProp}`,
    lang: 'es-AR',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    theme_color: '#0B1D3A',
    background_color: '#F5F7FA',
    categories: ['finance', 'business'],
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
      {
        src: '/icon',
        sizes: '32x32',
        type: 'image/png',
        purpose: 'any',
      },
    ],
  }
}
