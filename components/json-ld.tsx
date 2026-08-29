import { organizationJsonLd, websiteJsonLd } from '@/lib/seo'

export function SiteJsonLd() {
  const payload = [organizationJsonLd(), websiteJsonLd()]
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(payload) }}
    />
  )
}
