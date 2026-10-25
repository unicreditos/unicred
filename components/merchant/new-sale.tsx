'use client'

import { createFinancedSale } from '@/app/actions/merchant-commerce'
import { btnGhost, btnPrimary, Empty, fieldClass, Panel, type Commerce } from '@/components/merchant/shared'
import { formatARS, formatPercent } from '@/lib/finance'
import { formatPayDate, quoteOrder } from '@/lib/merchant-orders/rules'
import { cn } from '@/lib/utils'
import { CheckCircle2, Loader2, Minus, Plus, Search, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'

const TERMS = [3, 6, 9, 12, 18, 24]

function Row({ label, value, strong, muted }: { label: string; value: string; strong?: boolean; muted?: boolean }) {
  return (
    <div className={cn('flex items-baseline justify-between gap-3 py-1.5', muted && 'text-white/60')}>
      <dt className="text-sm">{label}</dt>
      <dd className={cn('font-mono tabular-nums', strong ? 'text-lg font-bold' : 'text-sm font-semibold')}>{value}</dd>
    </div>
  )
}

export function NewSaleTab({ data, onGoto }: { data: Commerce; onGoto: (tab: string) => void }) {
  const router = useRouter()
  const products = data.products.filter((p) => p.active)
  const terms = TERMS.filter((t) => t >= data.credit.minTerm && t <= data.credit.maxTerm)
  const [cart, setCart] = useState<Record<string, number>>({})
  const [q, setQ] = useState('')
  const [term, setTerm] = useState(terms.includes(12) ? 12 : terms[0] ?? data.credit.minTerm)
  const [cuil, setCuil] = useState('')
  const [done, setDone] = useState<{ code: string } | null>(null)
  const [pending, start] = useTransition()

  const lines = Object.entries(cart)
    .map(([id, qty]) => ({ p: products.find((x) => x.id === id), qty }))
    .filter((l): l is { p: (typeof products)[number]; qty: number } => Boolean(l.p) && l.qty > 0)
  const quote = quoteOrder({
    items: lines.map((l) => ({ productId: l.p.id, name: l.p.name, unitPrice: l.p.price, quantity: l.qty })),
    term,
    monthlyRate: data.credit.monthlyRate,
    commissionRate: data.commissionRate,
  })
  const filtered = q.trim()
    ? products.filter((p) => `${p.name} ${p.sku ?? ''} ${p.category ?? ''}`.toLowerCase().includes(q.trim().toLowerCase()))
    : products
  const cuilDigits = cuil.replace(/\D/g, '')
  const financedOk = quote.financed >= data.credit.minAmount && quote.financed <= data.credit.maxAmount
  const canSubmit = lines.length > 0 && cuilDigits.length === 11 && financedOk && !pending

  const add = (id: string, delta: number) =>
    setCart((c) => {
      const p = products.find((x) => x.id === id)
      const next = Math.max(0, Math.min((c[id] ?? 0) + delta, p?.stock ?? 99, 99))
      const copy = { ...c }
      if (next === 0) delete copy[id]
      else copy[id] = next
      return copy
    })

  if (done) {
    return (
      <Panel>
        <div className="mx-auto max-w-lg py-6 text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" aria-hidden />
          <h2 className="mt-4 font-display text-2xl font-extrabold">Operación {done.code} enviada</h2>
          <ol className="mx-auto mt-5 max-w-md space-y-2 text-left text-sm text-muted-foreground">
            <li>1. La mesa de créditos de UNICRÉDITOS la revisa y decide (te avisamos por mail).</li>
            <li>2. Si se aprueba, el cliente firma y paga el anticipo de {formatARS(quote.downPayment)} a UNICRÉDITOS por QR o transferencia.</li>
            <li>3. Cuando la operación figure <b>Lista para entregar</b>, entregás el producto y cargás el código de 6 dígitos del cliente.</li>
            <li>4. Te liquidamos {formatARS(quote.netToMerchant)} el viernes siguiente a la entrega.</li>
          </ol>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <button type="button" className={btnPrimary} onClick={() => onGoto('operaciones')}>Ver operaciones</button>
            <button
              type="button"
              className={btnGhost}
              onClick={() => {
                setDone(null)
                setCart({})
                setCuil('')
              }}
            >
              Cargar otra venta
            </button>
          </div>
        </div>
      </Panel>
    )
  }

  if (!products.length) {
    return (
      <Empty title="Primero cargá tu catálogo">
        <p>Las ventas en cuotas se arman con productos de tu catálogo, con su precio de contado.</p>
        <button type="button" className={cn(btnPrimary, 'mt-4')} onClick={() => onGoto('catalogo')}>Ir al catálogo</button>
      </Empty>
    )
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_24rem]">
      <div className="space-y-5">
        <Panel eyebrow="Paso 1" title="Elegí los productos">
          <div className="relative mb-3">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <input value={q} onChange={(e) => setQ(e.target.value)} className={cn(fieldClass, 'pl-9')} placeholder="Buscar en el catálogo" aria-label="Buscar producto" />
          </div>
          <ul className="max-h-[26rem] divide-y divide-border overflow-auto rounded-xl border border-border">
            {filtered.map((p) => {
              const qty = cart[p.id] ?? 0
              const out = p.stock != null && p.stock <= 0
              return (
                <li key={p.id} className="flex items-center gap-3 p-3">
                  <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-muted">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {p.image ? <img src={p.image} alt="" className="h-full w-full object-cover" /> : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{p.name}</p>
                    <p className="font-mono text-xs text-muted-foreground">
                      {formatARS(p.price)} {p.stock != null ? `· stock ${p.stock}` : ''}
                    </p>
                  </div>
                  {qty ? (
                    <div className="flex items-center gap-1">
                      <button type="button" aria-label={`Quitar una unidad de ${p.name}`} className="flex h-8 w-8 items-center justify-center rounded-full border border-border" onClick={() => add(p.id, -1)}>
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="w-6 text-center font-mono text-sm font-semibold">{qty}</span>
                      <button type="button" aria-label={`Sumar una unidad de ${p.name}`} className="flex h-8 w-8 items-center justify-center rounded-full border border-border" onClick={() => add(p.id, 1)}>
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <button type="button" disabled={out} className={btnGhost} onClick={() => add(p.id, 1)}>
                      {out ? 'Sin stock' : 'Agregar'}
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        </Panel>

        <Panel eyebrow="Paso 2" title="Plazo y cliente">
          <p className="mb-2 text-sm font-medium">Cantidad de cuotas</p>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Cuotas">
            {terms.map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={term === t}
                onClick={() => setTerm(t)}
                className={cn(
                  'h-10 min-w-12 rounded-full border px-4 font-mono text-sm font-semibold',
                  term === t ? 'border-brand-navy-900 bg-brand-navy-900 text-white dark:border-brand-primary dark:bg-brand-primary' : 'border-border',
                )}
              >
                {t}
              </button>
            ))}
          </div>
          <label className="mt-5 block text-sm font-medium">
            CUIL del cliente
            <input
              value={cuil}
              onChange={(e) => setCuil(e.target.value)}
              inputMode="numeric"
              maxLength={13}
              className={cn(fieldClass, 'mt-1 font-mono')}
              placeholder="20-12345678-9"
            />
          </label>
          <p className="mt-2 text-xs text-muted-foreground">
            El cliente tiene que tener cuenta en UNICRÉDITOS con la identidad verificada. La consulta al BCRA se hace con su autorización.
          </p>
        </Panel>
      </div>

      <aside className="lg:sticky lg:top-24 lg:self-start">
        <div className="overflow-hidden rounded-2xl bg-brand-navy-900 text-white shadow-xl">
          <div className="border-b border-white/10 p-5">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/55">Resumen de la operación</p>
            {lines.length ? (
              <ul className="mt-3 space-y-1 text-sm">
                {lines.map((l) => (
                  <li key={l.p.id} className="flex justify-between gap-2">
                    <span className="min-w-0 truncate">{l.qty > 1 ? `${l.qty}× ` : ''}{l.p.name}</span>
                    <button type="button" aria-label={`Quitar ${l.p.name}`} onClick={() => add(l.p.id, -l.qty)} className="text-white/50 hover:text-white">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-white/60">Agregá productos para ver la cotización.</p>
            )}
          </div>
          <dl className="p-5">
            <Row label="Precio de contado" value={formatARS(quote.total)} strong />
            <Row label="Anticipo 30% · lo paga a UNICRÉDITOS" value={formatARS(quote.downPayment)} />
            <Row label="Financiado (70%)" value={formatARS(quote.financed)} />
            <div className="my-3 rounded-xl bg-white/5 p-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/55">Cuota del cliente</p>
              <p className="mt-1 font-display text-3xl font-extrabold tabular-nums text-signal-amber">{quote.term} × {formatARS(quote.installmentAmount)}</p>
              <p className="mt-1 text-xs text-white/60">TNA {formatPercent(quote.tna)} · CFT {formatPercent(quote.cft)} (IVA incl.)</p>
            </div>
            <Row label={`Comisión (${formatPercent(data.commissionRate)})`} value={`− ${formatARS(quote.commission)}`} muted />
            <Row label="Cobrás en la liquidación" value={formatARS(quote.netToMerchant)} strong />
            <p className="mt-1 text-xs text-white/55">Si entregás hoy: {formatPayDate(data.nextPayDate)}.</p>
          </dl>
          {lines.length && !financedOk ? (
            <p className="mx-5 mb-3 rounded-lg bg-rose-500/15 p-2 text-xs text-rose-200">
              El monto financiado tiene que estar entre {formatARS(data.credit.minAmount)} y {formatARS(data.credit.maxAmount)}.
            </p>
          ) : null}
          <div className="p-5 pt-0">
            <button
              type="button"
              disabled={!canSubmit}
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-brand-primary-300 text-base font-semibold text-brand-navy-900 transition hover:bg-white disabled:opacity-40"
              onClick={() =>
                start(async () => {
                  const r = await createFinancedSale({
                    customerCuil: cuilDigits,
                    term,
                    items: lines.map((l) => ({ productId: l.p.id, quantity: l.qty })),
                  })
                  if (r.ok && r.data) {
                    setDone({ code: r.data.code })
                    router.refresh()
                  } else if (!r.ok) toast.error(r.error, { duration: 9000 })
                })
              }
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
              Enviar a la mesa de créditos
            </button>
            <p className="mt-2 text-center text-[11px] text-white/50">No entregues el producto hasta que la operación figure “Lista para entregar”.</p>
          </div>
        </div>
      </aside>
    </div>
  )
}
