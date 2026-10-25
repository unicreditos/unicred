import { Storefront } from '@/components/merchant-orders/storefront'
import { PageSection, PublicPageShell } from '@/components/unicred/public-page-shell'
import { db } from '@/lib/db'
import { loanProduct } from '@/lib/db/schema'
import { catalogByType } from '@/lib/loan-catalog'
import { getPublicStorefront } from '@/lib/merchants/directory'
import { pageMetadata } from '@/lib/seo'
import { eq } from 'drizzle-orm'
import { MapPin, Store } from 'lucide-react'
import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const data = await getPublicStorefront(id).catch(() => null)
  return pageMetadata({
    title: data ? `${data.merchant.businessName} en cuotas` : 'Comercio adherido',
    description: data
      ? `Comprá en ${data.merchant.businessName} en cuotas fijas con UNICRÉDITOS: 30% de anticipo y el resto financiado.`
      : 'Comercio adherido a UNICRÉDITOS.',
    path: `/red-comercios/${id}`,
  })
}

const TERMS = [3, 6, 9, 12, 18, 24]

export default async function StorefrontPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const data = await getPublicStorefront(id)
  if (!data) notFound()
  const catalog = catalogByType('consumo')
  const [product] = await db.select().from(loanProduct).where(eq(loanProduct.id, catalog.id)).limit(1)
  const minTerm = product?.minTerm ?? catalog.minTerm
  const maxTerm = product?.maxTerm ?? catalog.maxTerm
  const { merchant: m, products } = data
  return (
    <PublicPageShell
      eyebrow={m.category ? `Comercio adherido · ${m.category}` : 'Comercio adherido'}
      title={m.businessName}
      description={`Elegí lo que querés, pagá el 30% de anticipo a UNICRÉDITOS y el resto en cuotas fijas. ${[m.address, m.city, m.province].filter(Boolean).join(', ')}`}
      icon={<Store className="h-3.5 w-3.5" />}
    >
      <PageSection eyebrow="Catálogo" title={products.length ? `${products.length} productos en cuotas` : 'Catálogo en preparación'}>
        {products.length ? (
          <Storefront
            merchantId={m.id}
            merchantName={m.businessName}
            products={products}
            monthlyRate={Number(product?.monthlyRate ?? catalog.monthlyRate)}
            terms={TERMS.filter((t) => t >= minTerm && t <= maxTerm)}
          />
        ) : (
          <p className="flex items-center gap-2 text-sm text-brand-navy-600">
            <MapPin className="h-4 w-4" aria-hidden /> Este comercio todavía no publicó productos. Podés comprar en cuotas en el local: el vendedor carga tu CUIL.
          </p>
        )}
      </PageSection>
    </PublicPageShell>
  )
}
