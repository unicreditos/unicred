'use client'

import { ArrowDownLeft, ArrowUpRight, CheckCircle2, Scale, TriangleAlert } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useId, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { adminAdjustWallet } from '@/app/actions/admin-wallet'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { centsOf, formatMoney, fromCents } from '@/lib/money'
import {
  MAX_REASON,
  REASON_SUGGESTIONS,
  previewAdjustment,
  reasonProblem,
  type AdjustDirection,
} from '@/lib/wallet/adjustment'
import { cn } from '@/lib/utils'

type Props = { userId: string; holderName: string; balance: string }

const DIRECTIONS: Array<{ value: AdjustDirection; title: string; hint: string; icon: typeof ArrowDownLeft; on: string }> = [
  { value: 'credit', title: 'Acreditar', hint: 'Suma al saldo', icon: ArrowDownLeft, on: 'border-success bg-success/10 text-foreground' },
  { value: 'debit', title: 'Debitar', hint: 'Resta del saldo', icon: ArrowUpRight, on: 'border-destructive bg-destructive/10 text-foreground' },
]

/**
 * Ajuste manual de saldo. Dos pasos: se completa y se revisa (con el saldo resultante a la vista) y recién después se
 * confirma. Cada confirmación lleva un identificador propio: un doble clic no duplica el asiento.
 */
export function WalletAdjustForm({ userId, holderName, balance }: Props) {
  const router = useRouter()
  const uid = useId()
  const [direction, setDirection] = useState<AdjustDirection>('credit')
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [touched, setTouched] = useState({ amount: false, reason: false })
  const [step, setStep] = useState<'edit' | 'confirm'>('edit')
  const [attemptId, setAttemptId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<{ direction: AdjustDirection; cents: number; balance: string } | null>(null)
  const [pending, start] = useTransition()

  const balanceCents = centsOf(balance)
  const preview = previewAdjustment({ balanceCents, direction, amountText: amount })
  const reasonError = reasonProblem(reason)
  const canReview = preview.cents !== null && !preview.error && !reasonError
  const credit = direction === 'credit'

  function review(e: React.FormEvent) {
    e.preventDefault()
    setTouched({ amount: true, reason: true })
    if (!canReview) return
    setError(null)
    setDone(null)
    setAttemptId(crypto.randomUUID())
    setStep('confirm')
  }

  function confirm() {
    if (!attemptId || preview.cents === null) return
    setError(null)
    start(async () => {
      const res = await adminAdjustWallet({ userId, direction, amount, reason, attemptId })
      if (!res.ok) {
        setError(res.error)
        return
      }
      toast.success(res.duplicate ? 'Ese ajuste ya estaba registrado' : credit ? 'Saldo acreditado' : 'Saldo debitado')
      setDone({ direction, cents: preview.cents as number, balance: res.balance })
      setAmount('')
      setReason('')
      setTouched({ amount: false, reason: false })
      setAttemptId(null)
      setStep('edit')
      router.refresh()
    })
  }

  return (
    <Card className="overflow-hidden">
      <div className="flex items-start gap-3 border-b px-5 py-4 sm:px-6">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary" aria-hidden="true">
          <Scale className="size-[18px]" />
        </span>
        <div className="min-w-0">
          <h2 className="text-base font-semibold leading-tight">Ajuste de saldo</h2>
          <p className="mt-0.5 text-[13px] text-muted-foreground">Operación crítica. Queda registrada con tu nombre en la auditoría.</p>
        </div>
      </div>

      <div className="px-5 py-5 sm:px-6">
        {done ? (
          <Alert variant="success" className="mb-5 flex items-start gap-2.5">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
            <div>
              <p className="font-medium">{done.direction === 'credit' ? 'Acreditación registrada' : 'Débito registrado'}</p>
              <p className="text-[13px] text-muted-foreground">
                {done.direction === 'credit' ? '+' : '−'} {formatMoney(fromCents(done.cents))} · nuevo saldo {formatMoney(done.balance)}
              </p>
            </div>
          </Alert>
        ) : null}

        {step === 'edit' ? (
          <form onSubmit={review} className="flex flex-col gap-5" noValidate>
            <fieldset>
              <legend className="mb-1.5 text-sm font-medium">Tipo de ajuste</legend>
              <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Tipo de ajuste">
                {DIRECTIONS.map((d) => {
                  const on = direction === d.value
                  return (
                    <label
                      key={d.value}
                      className={cn(
                        'flex cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2.5 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring',
                        on ? d.on : 'bg-card hover:bg-muted',
                      )}
                    >
                      <input type="radio" name={`${uid}-dir`} className="sr-only" checked={on} onChange={() => setDirection(d.value)} />
                      <d.icon className={cn('size-4 shrink-0', on ? (d.value === 'credit' ? 'text-success' : 'text-destructive') : 'text-muted-foreground')} aria-hidden="true" />
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold leading-tight">{d.title}</span>
                        <span className="block text-xs text-muted-foreground">{d.hint}</span>
                      </span>
                    </label>
                  )
                })}
              </div>
            </fieldset>

            <Field
              id={`${uid}-amount`}
              label="Importe"
              hint="Entre $1,00 y $50.000.000,00. Usá coma para los centavos."
              error={touched.amount ? preview.error : null}
            >
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-lg font-medium text-muted-foreground" aria-hidden="true">
                  $
                </span>
                <Input
                  id={`${uid}-amount`}
                  inputMode="decimal"
                  autoComplete="off"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  onBlur={() => setTouched((t) => ({ ...t, amount: true }))}
                  placeholder="0,00"
                  aria-invalid={touched.amount && preview.error ? true : undefined}
                  aria-describedby={preview.error && touched.amount ? `${uid}-amount-error` : `${uid}-amount-hint`}
                  className="tnum h-14 pl-9 text-2xl font-semibold sm:text-2xl"
                />
              </div>
            </Field>

            <dl className="divide-y rounded-xl border bg-muted/40 text-sm" aria-live="polite">
              <div className="flex items-center justify-between gap-3 px-4 py-2.5">
                <dt className="text-muted-foreground">Saldo actual</dt>
                <dd className="tnum font-medium">{formatMoney(balance)}</dd>
              </div>
              <div className="flex items-center justify-between gap-3 px-4 py-2.5">
                <dt className="text-muted-foreground">{credit ? 'Se acredita' : 'Se debita'}</dt>
                <dd className={cn('tnum font-medium', preview.cents === null ? 'text-muted-foreground' : credit ? 'text-success' : 'text-destructive')}>
                  {preview.cents === null ? '—' : `${credit ? '+' : '−'} ${formatMoney(fromCents(preview.cents))}`}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3 px-4 py-3">
                <dt className="font-medium">Saldo resultante</dt>
                <dd className={cn('tnum text-base font-semibold', preview.error && preview.resultingCents !== null && preview.resultingCents < 0 ? 'text-destructive' : '')}>
                  {preview.resultingCents === null ? '—' : formatMoney(fromCents(preview.resultingCents))}
                </dd>
              </div>
            </dl>

            <Field
              id={`${uid}-reason`}
              label="Motivo"
              hint="Queda en la auditoría y en el comprobante del asiento."
              error={touched.reason ? reasonError : null}
            >
              <Textarea
                id={`${uid}-reason`}
                value={reason}
                maxLength={MAX_REASON}
                onChange={(e) => setReason(e.target.value)}
                onBlur={() => setTouched((t) => ({ ...t, reason: true }))}
                placeholder="Contá qué pasó y qué comprobante lo respalda"
                aria-invalid={touched.reason && reasonError ? true : undefined}
                aria-describedby={reasonError && touched.reason ? `${uid}-reason-error` : `${uid}-reason-hint`}
              />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap gap-1.5" role="group" aria-label="Motivos frecuentes">
                  {REASON_SUGGESTIONS[direction].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => {
                        setReason(s)
                        setTouched((t) => ({ ...t, reason: true }))
                      }}
                      className="rounded-full border bg-card px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-ring hover:text-foreground"
                    >
                      {s}
                    </button>
                  ))}
                </div>
                <span className="tnum text-xs text-muted-foreground" aria-hidden="true">
                  {reason.trim().length}/{MAX_REASON}
                </span>
              </div>
            </Field>

            <Button type="submit" size="lg" className="w-full" variant={credit ? 'default' : 'destructive'} disabled={!canReview && (touched.amount || touched.reason) ? true : false}>
              Revisar {credit ? 'acreditación' : 'débito'}
            </Button>
          </form>
        ) : (
          <div className="flex flex-col gap-5">
            <div>
              <h3 className="text-base font-semibold">Confirmá el ajuste</h3>
              <p className="mt-0.5 text-[13px] text-muted-foreground">Revisá los datos. Al confirmar se registra un asiento en la billetera.</p>
            </div>
            <dl className="divide-y rounded-xl border text-sm">
              <div className="flex items-center justify-between gap-3 px-4 py-2.5">
                <dt className="text-muted-foreground">Titular</dt>
                <dd className="min-w-0 truncate font-medium">{holderName}</dd>
              </div>
              <div className="flex items-center justify-between gap-3 px-4 py-2.5">
                <dt className="text-muted-foreground">Operación</dt>
                <dd className={cn('font-semibold', credit ? 'text-success' : 'text-destructive')}>{credit ? 'Acreditar' : 'Debitar'}</dd>
              </div>
              <div className="flex items-center justify-between gap-3 px-4 py-2.5">
                <dt className="text-muted-foreground">Importe</dt>
                <dd className="tnum text-lg font-semibold">{formatMoney(fromCents(preview.cents ?? 0))}</dd>
              </div>
              <div className="flex items-center justify-between gap-3 px-4 py-2.5">
                <dt className="text-muted-foreground">Saldo</dt>
                <dd className="tnum font-medium">
                  {formatMoney(balance)} → <span className="font-semibold">{formatMoney(fromCents(preview.resultingCents ?? 0))}</span>
                </dd>
              </div>
              <div className="px-4 py-2.5">
                <dt className="text-muted-foreground">Motivo</dt>
                <dd className="mt-0.5 break-words">{reason.trim()}</dd>
              </div>
            </dl>
            <Alert variant="warning" className="flex items-start gap-2 text-[13px]">
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
              <span>No se puede deshacer. Si te equivocás, hay que hacer otro ajuste en sentido contrario.</span>
            </Alert>
            {error ? <Alert variant="destructive">{error}</Alert> : null}
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" size="lg" disabled={pending} onClick={() => setStep('edit')}>
                Volver
              </Button>
              <Button size="lg" variant={credit ? 'default' : 'destructive'} disabled={pending} onClick={confirm}>
                {pending ? 'Registrando…' : credit ? 'Confirmar acreditación' : 'Confirmar débito'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </Card>
  )
}
