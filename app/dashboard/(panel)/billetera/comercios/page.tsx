import type { Metadata } from 'next'
import Link from 'next/link'
import { MapPin, ScanLine, Store } from 'lucide-react'
import { PageWidth, PageTitle } from '@/components/wallet/page-width'
import { buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { requireCustomerId } from '@/lib/session'
import { listAdheredMerchants } from '@/lib/wallet/merchants'

export const metadata: Metadata = { title: 'Comercios adheridos' }

export default async function MerchantsPage() {
  const userId = await requireCustomerId()
  const merchants = await listAdheredMerchants(userId)
  return (
    <PageWidth width="max-w-3xl">
      <PageTitle
        title="Comercios adheridos"
        description="Pagá con el saldo de tu billetera en los comercios de la red: llega al instante y sin costo."
        actions={
          <Link href="/dashboard/billetera/pagar" className={buttonVariants({ variant: 'outline' })}>
            <ScanLine /> Pagar con QR
          </Link>
        }
      />
      {merchants.length === 0 ? (
        <Card className="p-6 text-sm text-muted-foreground">
          Todavía no hay comercios adheridos. Si el comercio te muestra un QR, podés pagarlo desde “Pagar con QR”.
        </Card>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {merchants.map((m) => (
            <li key={m.id}>
              <Card className="flex h-full flex-col gap-3 p-5">
                <div className="flex items-start gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Store className="size-5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <p className="break-words font-semibold">{m.businessName}</p>
                    {m.category ? <p className="text-[13px] capitalize text-muted-foreground">{m.category}</p> : null}
                  </div>
                </div>
                {m.city || m.province ? (
                  <p className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
                    <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
                    {[m.city, m.province].filter(Boolean).join(', ')}
                  </p>
                ) : null}
                <Link
                  href={`/dashboard/billetera/transferir?destino=${encodeURIComponent(m.alias)}`}
                  className={buttonVariants({ className: 'mt-auto w-full' })}
                  aria-label={`Pagar a ${m.businessName}`}
                >
                  Pagar
                </Link>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </PageWidth>
  )
}
