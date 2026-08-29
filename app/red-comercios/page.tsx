import { PageSection, PublicPageShell } from '@/components/unicred/public-page-shell'
import { Button } from '@/components/ui/button'
import { countActiveMerchants, listPublicMerchants } from '@/lib/merchants/directory'
import { pageMetadata } from '@/lib/seo'
import { MapPin, Store } from 'lucide-react'
import Link from 'next/link'

export const metadata = pageMetadata({
  title: 'Red de comercios',
  description:
    'Comercios adheridos a UNICRÉDITOS donde podés comprar en cuotas sin tarjeta de crédito.',
  path: '/red-comercios',
})

export default async function RedComerciosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const { q } = await searchParams
  const [merchants, total] = await Promise.all([
    listPublicMerchants({ q, limit: 80 }),
    countActiveMerchants(),
  ])

  return (
    <PublicPageShell
      eyebrow="Red UNICRÉDITOS"
      title="Comercios donde comprás en cuotas"
      description={
        total > 0
          ? `${total} comercios activos. Buscá por rubro, ciudad o nombre y financiá sin tarjeta.`
          : 'La red está en expansión. Adherí tu local o pedí financiación cuando haya comercios activos.'
      }
      icon={<Store className="h-3.5 w-3.5" />}
      primaryAction={{ href: '/comprar-en-cuotas', label: 'Comprar en cuotas' }}
      secondaryAction={{ href: '/comercios', label: 'Adherí tu comercio' }}
    >
      <form className="mb-8 flex flex-wrap gap-2" action="/red-comercios" method="get">
        <input
          name="q"
          defaultValue={q ?? ''}
          placeholder="Buscar comercio, rubro o ciudad"
          className="h-11 min-w-[220px] flex-1 rounded-xl border border-border bg-white px-4 text-sm shadow-sm outline-none ring-brand-primary/30 focus:ring-2"
        />
        <Button type="submit" className="h-11 px-6 font-bold">
          Buscar
        </Button>
      </form>

      <PageSection title={merchants.length ? 'Resultados' : total === 0 ? 'Red en crecimiento' : 'Sin resultados'}>
        {merchants.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-brand-primary/25 bg-brand-primary/5 p-8 text-center">
            <Store className="mx-auto h-10 w-10 text-brand-primary" />
            <p className="mt-4 text-sm font-semibold text-brand-navy">
              {total === 0
                ? 'Todavía no hay comercios activos publicados.'
                : 'No hay comercios con ese criterio.'}
            </p>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              Si tenés un local, adherite y empezá a vender en cuotas. Si sos cliente, pedí un préstamo
              digital mientras la red crece.
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-3">
              <Button asChild className="font-bold">
                <Link href="/comercios">Adherí tu comercio</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/prestamos">Pedir préstamo</Link>
              </Button>
            </div>
          </div>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {merchants.map((m) => (
              <li
                key={m.id}
                className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm transition hover:border-brand-primary/30 hover:shadow-md"
              >
                <div className="text-sm font-bold text-brand-navy">{m.businessName}</div>
                {m.category ? (
                  <div className="mt-1 text-xs font-semibold uppercase tracking-wide text-brand-primary">
                    {m.category}
                  </div>
                ) : null}
                {(m.city || m.province) && (
                  <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5" />
                    {[m.city, m.province].filter(Boolean).join(', ')}
                  </div>
                )}
                <Link
                  href={`/comprar-en-cuotas?merchant=${m.id}#online`}
                  className="mt-4 inline-block text-xs font-semibold text-brand-primary hover:underline"
                >
                  Financiar compra →
                </Link>
              </li>
            ))}
          </ul>
        )}
      </PageSection>
    </PublicPageShell>
  )
}
