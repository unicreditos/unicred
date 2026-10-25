'use client'

import { savePayoutAccount } from '@/app/actions/merchant-commerce'
import { btnPrimary, Empty, fieldClass, Figure, fmtDate, Panel, type Commerce } from '@/components/merchant/shared'
import { formatARS, formatCBU } from '@/lib/finance'
import { formatPayDate } from '@/lib/merchant-orders/rules'
import { cn } from '@/lib/utils'
import { BadgeCheck, Loader2, Printer } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'

function PayoutForm({ data }: { data: Commerce }) {
  const router = useRouter()
  const [editing, setEditing] = useState(!data.payout)
  const [cbu, setCbu] = useState(data.payout?.cbu ?? '')
  const [alias, setAlias] = useState(data.payout?.alias ?? '')
  const [pending, start] = useTransition()
  if (!editing && data.payout) {
    return (
      <div className="space-y-2 text-sm">
        <p className="font-mono text-base font-semibold">{formatCBU(data.payout.cbu)}</p>
        <p className="text-muted-foreground">
          {data.payout.holder} · CUIT {data.payout.holderCuit}
          {data.payout.bankName ? ` · ${data.payout.bankName}` : ''}
          {data.payout.alias ? ` · alias ${data.payout.alias}` : ''}
        </p>
        <p className={cn('inline-flex items-center gap-1 text-xs font-semibold', data.payout.verifiedAt ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400')}>
          {data.payout.verifiedAt ? <BadgeCheck className="h-3.5 w-3.5" aria-hidden /> : null}
          {data.payout.verifiedAt ? 'Titularidad verificada' : 'Tesorería verifica la titularidad antes del primer pago'}
        </p>
        <div>
          <button type="button" className="text-xs font-semibold text-brand-primary-700 underline dark:text-brand-primary-300" onClick={() => setEditing(true)}>
            Cambiar cuenta
          </button>
        </div>
      </div>
    )
  }
  return (
    <form
      className="grid gap-3 sm:grid-cols-[1fr_12rem_auto] sm:items-end"
      onSubmit={(e) => {
        e.preventDefault()
        start(async () => {
          const r = await savePayoutAccount({ cbu, alias })
          if (r.ok) {
            toast.success(r.data?.verified ? 'Cuenta guardada y verificada' : 'Cuenta guardada. Tesorería la verifica antes del primer pago.')
            setEditing(false)
            router.refresh()
          } else toast.error(r.error)
        })
      }}
    >
      <label className="text-sm font-medium">
        CBU o CVU (a nombre del CUIT del comercio)
        <input value={cbu} onChange={(e) => setCbu(e.target.value.replace(/\D/g, '').slice(0, 22))} inputMode="numeric" required className={cn(fieldClass, 'mt-1 font-mono')} placeholder="22 dígitos" />
      </label>
      <label className="text-sm font-medium">
        Alias (opcional)
        <input value={alias} onChange={(e) => setAlias(e.target.value)} maxLength={20} className={cn(fieldClass, 'mt-1 font-mono')} />
      </label>
      <button type="submit" disabled={pending || cbu.length !== 22} className={btnPrimary}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
        Guardar
      </button>
    </form>
  )
}

export function SettlementsTab({ data }: { data: Commerce }) {
  const scheduled = data.settlements.filter((s) => s.status === 'scheduled').sort((a, b) => a.payDate.localeCompare(b.payDate))
  const paid = data.settlements.filter((s) => s.status === 'paid')
  const next = scheduled[0]
  const paidTotal = paid.reduce((s, x) => s + Number(x.netAmount), 0)
  const pendingTotal = scheduled.reduce((s, x) => s + Number(x.netAmount), 0)
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <Figure label="Próximo pago" value={next ? formatARS(next.netAmount) : formatARS(0)} hint={next ? formatPayDate(next.payDate) : `Si entregás hoy: ${formatPayDate(data.nextPayDate)}`} tone="accent" />
        <Figure label="A cobrar (programado)" value={formatARS(pendingTotal)} hint={`${scheduled.length} lote${scheduled.length === 1 ? '' : 's'} pendiente${scheduled.length === 1 ? '' : 's'}`} />
        <Figure label="Cobrado" value={formatARS(paidTotal)} hint={`${paid.length} liquidaciones pagadas`} tone="good" />
      </div>

      <Panel eyebrow="Cuenta de cobro" title="Dónde te transferimos">
        <PayoutForm data={data} />
      </Panel>

      <Panel eyebrow="Cómo se liquida" title="Todos los viernes">
        <ul className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-3">
          <li>Cada entrega confirmada con el código del cliente entra en el lote del <b>viernes siguiente</b>. Si ese viernes es feriado, el próximo día hábil.</li>
          <li>Te pagamos el <b>precio de contado completo menos la comisión</b> ({data.commissionRate.toLocaleString('es-AR')}%): el anticipo lo cobró UNICRÉDITOS y el resto lo financia UNICRÉDITOS.</li>
          <li>El riesgo de cobro de las cuotas es de UNICRÉDITOS. Si el cliente se atrasa, a vos ya te pagamos.</li>
        </ul>
      </Panel>

      <Panel eyebrow="Historial" title="Liquidaciones">
        {data.settlements.length ? (
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">Lote</th>
                  <th className="py-2 pr-3 font-medium">Fecha de pago</th>
                  <th className="py-2 pr-3 text-right font-medium">Ventas</th>
                  <th className="py-2 pr-3 text-right font-medium">Bruto</th>
                  <th className="py-2 pr-3 text-right font-medium">Comisión</th>
                  <th className="py-2 pr-3 text-right font-medium">Neto</th>
                  <th className="py-2 pr-3 font-medium">Estado</th>
                  <th className="py-2 font-medium"><span className="sr-only">Detalle</span></th>
                </tr>
              </thead>
              <tbody>
                {data.settlements.map((s) => (
                  <tr key={s.id} className="border-b border-border last:border-0">
                    <td className="py-2.5 pr-3 font-mono text-xs">{s.code}</td>
                    <td className="py-2.5 pr-3">{formatPayDate(s.payDate)}</td>
                    <td className="py-2.5 pr-3 text-right font-mono">{s.orderCount}</td>
                    <td className="py-2.5 pr-3 text-right font-mono">{formatARS(s.grossAmount)}</td>
                    <td className="py-2.5 pr-3 text-right font-mono text-muted-foreground">− {formatARS(s.commissionAmount)}</td>
                    <td className="py-2.5 pr-3 text-right font-mono font-semibold">{formatARS(s.netAmount)}</td>
                    <td className="py-2.5 pr-3">
                      {s.status === 'paid' ? (
                        <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">Pagada {fmtDate(s.paidAt)} · op. {s.transferReference}</span>
                      ) : (
                        <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">Programada</span>
                      )}
                    </td>
                    <td className="py-2.5">
                      <Link href={`/merchant/liquidaciones/${s.id}`} target="_blank" className="inline-flex items-center gap-1 text-xs font-semibold text-brand-primary-700 underline dark:text-brand-primary-300">
                        <Printer className="h-3.5 w-3.5" aria-hidden /> Detalle
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty title="Todavía no hay liquidaciones">Se generan solas cuando confirmás la primera entrega.</Empty>
        )}
      </Panel>
    </div>
  )
}
