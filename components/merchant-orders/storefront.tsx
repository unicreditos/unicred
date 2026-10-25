'use client'

import { requestOnlineOrder } from '@/app/actions/merchant-order-customer'
import { useSession } from '@/lib/auth-client'
import { formatARS, formatPercent } from '@/lib/finance'
import { DOWN_PAYMENT_RATE, quoteOrder } from '@/lib/merchant-orders/rules'
import { cn } from '@/lib/utils'
import { Loader2, Minus, Plus, ShoppingBag } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'

type Product = { id: string; name: string; description: string | null; category: string | null; price: number; stock: number | null; image: string | null }

export function Storefront({
  merchantId,
  merchantName,
  products,
  monthlyRate,
  terms,
}: {
  merchantId: string
  merchantName: string
  products: Product[]
  monthlyRate: number
  terms: number[]
}) {
  const router = useRouter()
  const { data: session, isPending } = useSession()
  const [cart, setCart] = useState<Record<string, number>>({})
  const [term, setTerm] = useState(terms.includes(12) ? 12 : terms[0])
  const [pending, start] = useTransition()
  const lines = products.filter((p) => cart[p.id]).map((p) => ({ productId: p.id, name: p.name, unitPrice: p.price, quantity: cart[p.id] }))
  const quote = quoteOrder({ items: lines, term, monthlyRate, commissionRate: 0 })
  const add = (p: Product, d: number) =>
    setCart((c) => {
      const next = Math.max(0, Math.min((c[p.id] ?? 0) + d, p.stock ?? 9, 9))
      const copy = { ...c }
      if (next) copy[p.id] = next
      else delete copy[p.id]
      return copy
    })
  const signedIn = !isPending && Boolean(session?.user)
  const next = `/red-comercios/${merchantId}`

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {products.map((p) => {
          const qty = cart[p.id] ?? 0
          const one = quoteOrder({ items: [{ productId: p.id, name: p.name, unitPrice: p.price, quantity: 1 }], term, monthlyRate, commissionRate: 0 })
          const out = p.stock != null && p.stock <= 0
          return (
            <li key={p.id} className={cn('flex flex-col overflow-hidden rounded-2xl border bg-white', qty ? 'border-brand-primary shadow-md' : 'border-brand-navy-100')}>
              <div className="aspect-[4/3] bg-brand-navy-50">
                {p.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.image} alt={p.name} className="h-full w-full object-cover" loading="lazy" />
                ) : (
                  <div className="flex h-full items-center justify-center font-display text-5xl font-extrabold text-brand-navy-200">{p.name.slice(0, 1)}</div>
                )}
              </div>
              <div className="flex flex-1 flex-col p-4">
                {p.category ? <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-brand-primary-700">{p.category}</p> : null}
                <h3 className="mt-1 font-semibold leading-snug text-brand-navy-900">{p.name}</h3>
                {p.description ? <p className="mt-1 line-clamp-2 text-xs text-brand-navy-600">{p.description}</p> : null}
                <p className="mt-3 font-display text-2xl font-extrabold tabular-nums text-brand-navy-900">{formatARS(p.price)}</p>
                <p className="text-xs text-brand-navy-600">
                  {formatARS(one.downPayment)} de anticipo + {term} cuotas de <b>{formatARS(one.installmentAmount)}</b>
                </p>
                <div className="mt-auto pt-4">
                  {qty ? (
                    <div className="flex items-center gap-2">
                      <button type="button" aria-label={`Quitar ${p.name}`} onClick={() => add(p, -1)} className="flex h-9 w-9 items-center justify-center rounded-full border border-brand-navy-200"><Minus className="h-4 w-4" /></button>
                      <span className="w-6 text-center font-mono font-semibold">{qty}</span>
                      <button type="button" aria-label={`Sumar ${p.name}`} onClick={() => add(p, 1)} className="flex h-9 w-9 items-center justify-center rounded-full border border-brand-navy-200"><Plus className="h-4 w-4" /></button>
                    </div>
                  ) : (
                    <button type="button" disabled={out} onClick={() => add(p, 1)} className="inline-flex h-10 items-center gap-2 rounded-full bg-brand-navy-900 px-4 text-sm font-semibold text-white disabled:opacity-40">
                      <ShoppingBag className="h-4 w-4" aria-hidden /> {out ? 'Sin stock' : 'Lo quiero en cuotas'}
                    </button>
                  )}
                </div>
              </div>
            </li>
          )
        })}
      </ul>

      <aside className="lg:sticky lg:top-24 lg:self-start">
        <div className="overflow-hidden rounded-2xl bg-brand-navy-900 text-white shadow-xl">
          <div className="p-5">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/55">Tu compra en {merchantName}</p>
            <p className="mt-3 text-sm text-white/70">Cuotas</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {terms.map((t) => (
                <button key={t} type="button" aria-pressed={term === t} onClick={() => setTerm(t)} className={cn('h-9 min-w-10 rounded-full border px-3 font-mono text-sm font-semibold', term === t ? 'border-white bg-white text-brand-navy-900' : 'border-white/25')}>
                  {t}
                </button>
              ))}
            </div>
            <dl className="mt-5 space-y-1.5 text-sm">
              <div className="flex justify-between"><dt>Precio</dt><dd className="font-mono">{formatARS(quote.total)}</dd></div>
              <div className="flex justify-between"><dt>Anticipo {Math.round(DOWN_PAYMENT_RATE * 100)}% (a UNICRÉDITOS)</dt><dd className="font-mono">{formatARS(quote.downPayment)}</dd></div>
              <div className="flex justify-between"><dt>Financiás</dt><dd className="font-mono">{formatARS(quote.financed)}</dd></div>
            </dl>
            {lines.length ? (
              <>
                <p className="mt-4 font-display text-3xl font-extrabold tabular-nums text-signal-amber">{term} × {formatARS(quote.installmentAmount)}</p>
                <p className="text-xs text-white/60">TNA {formatPercent(quote.tna)} · CFT {formatPercent(quote.cft)} con IVA. Sujeto a evaluación.</p>
              </>
            ) : (
              <p className="mt-4 text-sm text-white/70">Elegí uno o más productos para ver tu cuota.</p>
            )}
          </div>
          <div className="border-t border-white/10 p-5">
            {signedIn ? (
              <button
                type="button"
                disabled={!lines.length || pending}
                onClick={() =>
                  start(async () => {
                    const r = await requestOnlineOrder({ merchantId, term, items: lines.map((l) => ({ productId: l.productId, quantity: l.quantity })) })
                    if (r.ok) {
                      toast.success(`Pedido ${r.code} enviado a la mesa de créditos`)
                      router.push('/dashboard/creditos')
                    } else toast.error(r.error, { duration: 9000 })
                  })
                }
                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-brand-primary-300 font-semibold text-brand-navy-900 transition hover:bg-white disabled:opacity-40"
              >
                {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                Pedir financiación
              </button>
            ) : (
              <div className="grid gap-2">
                <Link href={`/sign-in?next=${encodeURIComponent(next)}`} className="inline-flex h-12 items-center justify-center rounded-full bg-brand-primary-300 font-semibold text-brand-navy-900">
                  Ingresá para pedirlo
                </Link>
                <Link href="/sign-up" className="text-center text-sm font-semibold text-white/80 underline">Crear mi cuenta</Link>
              </div>
            )}
            <p className="mt-3 text-[11px] leading-relaxed text-white/55">
              Una persona de la mesa revisa el pedido. Si se aprueba, firmás, pagás el anticipo por QR o transferencia a UNICRÉDITOS y retirás con tu código de entrega.
            </p>
          </div>
        </div>
      </aside>
    </div>
  )
}
