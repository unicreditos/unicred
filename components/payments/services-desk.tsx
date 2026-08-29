'use client'

import { payServiceAction, listMyServicePaymentsAction } from '@/app/actions/services'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  SERVICE_CATEGORIES,
  SERVICE_PROVIDERS,
  type ServiceCategoryId,
  type ServiceProvider,
} from '@/lib/services/catalog'
import { formatARS, formatARSDecimal } from '@/lib/finance'
import { CheckCircle2, Download, Loader2, Radio, Receipt, Smartphone, Zap } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useMemo, useState, useTransition } from 'react'
import { toast } from 'sonner'

type HistoryRow = Awaited<ReturnType<typeof listMyServicePaymentsAction>>[number]

type SuccessState = {
  receiptId: string
  operationId: string
  authCode: string
  providerName: string
  accountRef: string
  amount: number
  balanceAfter: number
  paidAt: string
}

export function ServicesDesk() {
  const [category, setCategory] = useState<ServiceCategoryId>('recargas')
  const [providerId, setProviderId] = useState(SERVICE_PROVIDERS[0]?.id ?? '')
  const [accountRef, setAccountRef] = useState('')
  const [amount, setAmount] = useState('')
  const [history, setHistory] = useState<HistoryRow[]>([])
  const [success, setSuccess] = useState<SuccessState | null>(null)
  const [pending, start] = useTransition()

  const providers = useMemo(
    () => SERVICE_PROVIDERS.filter((p) => p.category === category),
    [category],
  )
  const provider: ServiceProvider | undefined =
    providers.find((p) => p.id === providerId) ?? providers[0]

  useEffect(() => {
    if (provider && provider.id !== providerId) setProviderId(provider.id)
  }, [category, provider, providerId])

  useEffect(() => {
    start(async () => {
      try {
        setHistory(await listMyServicePaymentsAction())
      } catch {
        /* sesión */
      }
    })
  }, [])

  function submit() {
    if (!provider) return
    const value = Number(String(amount).replace(',', '.'))
    start(async () => {
      const res = await payServiceAction({
        providerId: provider.id,
        accountRef,
        amount: value,
      })
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success(res.message)
      setSuccess({
        receiptId: res.receiptId,
        operationId: res.operationId,
        authCode: res.authCode,
        providerName: res.providerName,
        accountRef: res.accountRef,
        amount: res.amount,
        balanceAfter: res.balanceAfter,
        paidAt: res.paidAt,
      })
      setAccountRef('')
      setAmount('')
      setHistory(await listMyServicePaymentsAction())
    })
  }

  if (success) {
    const paidLabel = new Date(success.paidAt).toLocaleString('es-AR')
    return (
      <div className="space-y-6">
        <div className="rounded-2xl border-2 border-emerald-400/70 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-col items-center text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg shadow-emerald-500/30">
              <CheckCircle2 className="h-8 w-8" />
            </span>
            <h2 className="mt-4 text-2xl font-bold tracking-tight text-brand-navy">¡Pago exitoso!</h2>
            <p className="mt-1 text-sm text-muted-foreground">Tu pago fue procesado correctamente</p>
          </div>

          <dl className="mt-8 divide-y divide-border/70 rounded-xl border border-border/60 bg-slate-50/50 px-4">
            {[
              { k: 'Operación', v: success.operationId },
              { k: 'Empresa', v: success.providerName },
              { k: 'Cuenta', v: success.accountRef },
              { k: 'Importe', v: formatARSDecimal(success.amount), accent: true },
              { k: 'Fecha', v: paidLabel },
              { k: 'Código de autorización', v: success.authCode, mono: true },
            ].map((row) => (
              <div key={row.k} className="flex items-center justify-between gap-4 py-3 text-sm">
                <dt className="text-muted-foreground">{row.k}</dt>
                <dd
                  className={
                    'font-semibold tabular-nums ' +
                    (row.accent ? 'text-emerald-700' : row.mono ? 'font-mono text-brand-primary' : 'text-brand-navy')
                  }
                >
                  {row.v}
                </dd>
              </div>
            ))}
          </dl>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <Button asChild variant="outline" className="font-semibold">
              <Link href={`/dashboard/documentos/recibo/${success.receiptId}`} target="_blank">
                <Download className="mr-2 h-4 w-4" /> Descargar
              </Link>
            </Button>
            <Button className="font-bold" onClick={() => setSuccess(null)}>
              Nuevo pago
            </Button>
          </div>
        </div>

        <div className="rounded-2xl border border-border/70 bg-card p-5">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Saldo disponible
          </p>
          <p className="mt-1 text-3xl font-bold tabular-nums text-brand-navy">
            {formatARSDecimal(success.balanceAfter)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">ARS · Pesos argentinos</p>
          <Button asChild variant="outline" size="sm" className="mt-3">
            <Link href="/dashboard?tab=billetera">+ Cargar saldo</Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-brand-primary/15 bg-gradient-to-br from-brand-primary/5 via-white to-brand-cian-50/40 p-5 sm:p-6">
        <div className="flex flex-wrap items-start gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-primary text-white">
            <Zap className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold tracking-tight text-brand-navy">Pagos y recargas</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Pagá servicios y recargá celular con saldo de tu billetera UNICRÉDITOS. Al confirmar
              emitimos el comprobante con operación y código de autorización.
            </p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {SERVICE_CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategory(c.id)}
              className={
                'rounded-full px-3 py-1.5 text-xs font-semibold transition ' +
                (category === c.id
                  ? 'bg-brand-primary text-white'
                  : 'bg-white text-muted-foreground ring-1 ring-border hover:text-brand-primary')
              }
            >
              {c.label}
            </button>
          ))}
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Prestador</Label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={provider?.id ?? ''}
              onChange={(e) => setProviderId(e.target.value)}
            >
              {providers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label>{provider?.accountHint ?? 'Referencia'}</Label>
            <Input
              value={accountRef}
              onChange={(e) => setAccountRef(e.target.value)}
              placeholder={provider?.kind === 'recharge' ? '1112345678' : 'Nº de cliente'}
              inputMode="numeric"
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Monto (ARS)</Label>
            <Input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={provider ? String(provider.minAmount) : '0'}
              inputMode="decimal"
            />
            {provider?.presets?.length ? (
              <div className="flex flex-wrap gap-2 pt-1">
                {provider.presets.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setAmount(String(preset))}
                    className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-brand-navy ring-1 ring-border hover:ring-brand-primary"
                  >
                    {formatARS(preset)}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        <Button className="mt-5 font-bold" disabled={pending || !provider} onClick={submit}>
          {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {provider?.kind === 'recharge' ? (
            <>
              <Smartphone className="mr-2 h-4 w-4" /> Confirmar recarga
            </>
          ) : (
            <>
              <Receipt className="mr-2 h-4 w-4" /> Pagar servicio
            </>
          )}
        </Button>
      </div>

      <div className="rounded-3xl border border-border/70 bg-card p-5">
        <div className="flex items-center gap-2 text-sm font-bold text-brand-navy">
          <Radio className="h-4 w-4 text-brand-primary" /> Pagos recientes
        </div>
        {history.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">Todavía no hay pagos de servicios.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border/60">
            {history.map((row) => (
              <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                <div>
                  <div className="font-semibold text-brand-navy">{row.providerName}</div>
                  <div className="text-xs text-muted-foreground">
                    {row.reference} · {row.accountRef} · {row.status}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="font-bold tabular-nums text-rose-600">−{formatARS(row.amount)}</div>
                  {row.receiptId ? (
                    <Link
                      href={`/dashboard/documentos/recibo/${row.receiptId}`}
                      className="text-xs font-semibold text-brand-primary hover:underline"
                      target="_blank"
                    >
                      Recibo
                    </Link>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
