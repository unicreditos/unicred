import type { Metadata } from 'next'
import { PageWidth, PageTitle } from '@/components/wallet/page-width'
import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { QrCreator } from '@/components/wallet/qr-creator'
import { QrActivate, QrPosCard } from '@/components/wallet/qr-pos'
import {
  QR_ORDER_STATUS_BADGE,
  QR_ORDER_STATUS_LABELS,
  QR_PAYMENT_STATUS_BADGE,
  QR_PAYMENT_STATUS_LABELS,
  label,
} from '@/lib/credit/labels'
import { formatDateTime } from '@/lib/format'
import { mpConfigured } from '@/lib/mercadopago/client'
import { getQrOverview, reconcileQr } from '@/lib/mercadopago/settle'
import { formatMoney } from '@/lib/money'
import { consumeRateLimit } from '@/lib/rate-limit'
import { requireCustomerId } from '@/lib/session'
import { assertIdentityVerified } from '@/lib/wallet/guards'
import { ensureWallet } from '@/lib/wallet/ledger'
import { qrSvg } from '@/lib/wallet/qr'

export const metadata: Metadata = { title: 'Cobrar con QR' }
export const dynamic = 'force-dynamic'

export default async function QrPage() {
  const userId = await requireCustomerId()
  const wallet = await ensureWallet(userId)

  const enabled = mpConfigured()
  let overview = await getQrOverview(userId)

  // Red de seguridad por si Mercado Pago avisó a otra dirección: se concilia al abrir (como mucho cada 30 s).
  if (enabled && overview.pos) {
    const gate = await consumeRateLimit(`wallet-qr-sync:${userId}`, 1, 30_000)
    if (gate.ok) {
      try {
        const r = await reconcileQr({ userId, limit: 10 })
        if (r.orders || r.creditedCents) overview = await getQrOverview(userId)
      } catch (err) {
        console.warn('[mp-qr] conciliación al abrir:', err instanceof Error ? err.message : err)
      }
    }
  }

  let reason: string | undefined
  if (!overview.pos) {
    try {
      await assertIdentityVerified(userId, 'cobrar con QR')
    } catch (err) {
      reason = err instanceof Error ? err.message : 'Verificá tu identidad para cobrar con QR.'
    }
  }
  const { pos } = overview
  const posSvg = pos?.qrCode ? await qrSvg(pos.qrCode) : null

  return (
    <PageWidth>
      <PageTitle
        title="Cobrar con QR"
        description="Cada billetera tiene su propia caja de cobro en Mercado Pago: te pagan desde cualquier banco o billetera y el dinero entra a tu saldo."
      />

      {!enabled ? (
        <Alert variant="warning" className="mb-6">
          El cobro con QR de Mercado Pago todavía no está habilitado en este entorno. Cuando se active vas a poder abrir tu caja desde acá.
        </Alert>
      ) : wallet.status !== 'active' ? (
        <Alert variant="destructive" className="mb-6">Tu billetera está bloqueada. Contactá a soporte para volver a cobrar.</Alert>
      ) : null}

      {enabled && wallet.status === 'active' ? (
        !pos ? (
          <QrActivate canActivate={!reason} reason={reason} />
        ) : (
          <div className="flex flex-col gap-6">
            <QrPosCard
              name={pos.name}
              svg={posSvg}
              imageUrl={pos.qrImageUrl}
              templateUrl={pos.qrTemplateUrl}
              collectedCount={overview.collectedCount}
              collectedTotal={overview.collectedTotal}
            />
            <QrCreator />
          </div>
        )
      ) : null}

      {pos ? (
        <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <section aria-labelledby="qr-pagos" className="min-w-0">
            <h2 id="qr-pagos" className="mb-3 text-lg font-semibold">Pagos recibidos</h2>
            <Card className="overflow-hidden">
              {overview.payments.length === 0 ? (
                <p className="p-5 text-sm text-muted-foreground">Todavía no te pagaron con QR.</p>
              ) : (
                <ul className="divide-y">
                  {overview.payments.map((p) => (
                    <li key={p.mpPaymentId} className="flex items-center justify-between gap-3 px-5 py-3 text-sm sm:px-6">
                      <div className="min-w-0">
                        <p className="tnum font-medium">{formatMoney(p.creditedAmount ?? p.amount)}</p>
                        <p className="truncate text-[13px] text-muted-foreground">
                          {formatDateTime(p.paidAt ?? p.createdAt)} · MP {p.mpPaymentId}
                        </p>
                        {p.note ? <p className="text-[13px] text-warning">{p.note}</p> : null}
                      </div>
                      <Badge variant={QR_PAYMENT_STATUS_BADGE[p.status] ?? 'secondary'}>{label(QR_PAYMENT_STATUS_LABELS, p.status)}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </section>
          <section aria-labelledby="qr-cobros" className="min-w-0">
            <h2 id="qr-cobros" className="mb-3 text-lg font-semibold">QR con importe</h2>
            <Card className="overflow-hidden">
              {overview.orders.length === 0 ? (
                <p className="p-5 text-sm text-muted-foreground">Todavía no generaste QR con importe.</p>
              ) : (
                <ul className="divide-y">
                  {overview.orders.map((o) => (
                    <li key={o.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm sm:px-6">
                      <div className="min-w-0">
                        <p className="tnum font-medium">{formatMoney(o.amount)}</p>
                        <p className="truncate text-[13px] text-muted-foreground">
                          {formatDateTime(o.createdAt)}
                          {o.concept ? ` · ${o.concept}` : ''}
                        </p>
                      </div>
                      <Badge variant={QR_ORDER_STATUS_BADGE[o.status] ?? 'secondary'}>{label(QR_ORDER_STATUS_LABELS, o.status)}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </section>
        </div>
      ) : null}
    </PageWidth>
  )
}
