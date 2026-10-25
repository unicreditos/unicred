'use client'

import Link from 'next/link'
import { AlertTriangle, ArrowRight, BadgeCheck, CheckCircle2, Printer } from 'lucide-react'
import { useMemo, useState, useTransition } from 'react'
import { requestWithdrawal } from '@/app/actions/billetera'
import { Alert } from '@/components/ui/alert'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { formatCbu, formatDateTime } from '@/lib/format'
import { formatMoney } from '@/lib/money'
import { amountProblem, parseAmountText } from '@/lib/wallet/adjustment'
import { TRANSFER_CONCEPTS, conceptLabel } from '@/lib/wallet/concepts'

export type WithdrawAccount = {
  id: string
  bankName: string
  holderName: string
  cbu: string | null
  cvu: string | null
  alias: string | null
  verified: boolean
}
type Done = { reference: string; amount: string; balance: string; at: string }

const MIN = 100
const SELECT =
  'h-11 w-full rounded-xl border border-input bg-card px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 sm:h-10 sm:text-sm'

function routing(a: WithdrawAccount) {
  return a.cbu ? { scheme: 'CBU', value: formatCbu(a.cbu) } : a.cvu ? { scheme: 'CVU', value: formatCbu(a.cvu) } : { scheme: 'Alias', value: `@${a.alias}` }
}

/** "1.250,50" o "1250.5" → número; NaN si no es un importe válido (misma regla que el servidor). */
function parseAmount(raw: string) {
  const cents = parseAmountText(raw)
  return cents === null ? NaN : cents / 100
}

/**
 * Retiro a una cuenta propia, con el recorrido de una transferencia bancaria: elegir la cuenta de destino, importe,
 * concepto y detalle → revisar y confirmar → comprobante. Nada sale hasta que administración aprueba y envía.
 */
export function WithdrawForm({ accounts, balance, canSend }: { accounts: WithdrawAccount[]; balance: string; canSend: boolean }) {
  const [step, setStep] = useState<'form' | 'review' | 'done'>('form')
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? '')
  const [amount, setAmount] = useState('')
  const [conceptCode, setConceptCode] = useState('VAR')
  const [detail, setDetail] = useState('')
  const [attemptId] = useState(() => crypto.randomUUID())
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<Done | null>(null)
  const [pending, start] = useTransition()

  const account = useMemo(() => accounts.find((a) => a.id === accountId), [accounts, accountId])
  const available = Number(balance)
  const value = parseAmount(amount)
  const amountError = !amount.trim()
    ? null
    : Number.isNaN(value) || value <= 0
      ? (amountProblem(amount) ?? 'Ingresá un importe válido.')
      : value < MIN
        ? `El mínimo es ${formatMoney(MIN)}.`
        : value > available
          ? 'El importe supera tu saldo disponible.'
          : null

  if (step === 'done' && done) {
    const route = account ? routing(account) : null
    return (
      <Card className="p-5 sm:p-8 print:border-0 print:shadow-none">
        <CheckCircle2 className="size-10 text-success" aria-hidden="true" />
        <h2 className="mt-4 text-2xl font-semibold">Retiro solicitado</h2>
        <p className="mt-2 text-muted-foreground">
          Retuvimos <strong className="text-foreground">{formatMoney(done.amount)}</strong> de tu saldo. Un administrador revisa el retiro, envía la
          transferencia a tu cuenta y te avisa por correo.
        </p>
        <dl className="mt-5 divide-y rounded-xl border text-sm">
          {[
            ['Referencia', done.reference],
            ['Fecha', done.at],
            ['Importe', formatMoney(done.amount)],
            ['Concepto', `${conceptCode} · ${conceptLabel(conceptCode)}${detail.trim() ? ` — ${detail.trim()}` : ''}`],
            ['Banco', account?.bankName ?? '—'],
            ['Titular', account?.holderName ?? '—'],
            [route?.scheme ?? 'Cuenta', route?.value ?? '—'],
            ['Estado', 'Pendiente de aprobación'],
            ['Saldo disponible', formatMoney(done.balance)],
          ].map(([k, v]) => (
            <div key={k} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 px-4 py-2.5">
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="tnum break-all text-right font-medium">{v}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-6 flex flex-wrap gap-2 print:hidden">
          <Link href="/dashboard/billetera" className={buttonVariants()}>
            Volver a mi billetera
          </Link>
          <Button variant="outline" onClick={() => window.print()}>
            <Printer /> Imprimir comprobante
          </Button>
        </div>
      </Card>
    )
  }

  if (accounts.length === 0) {
    return (
      <Card className="p-6">
        <p className="text-sm text-muted-foreground">Primero agregá una cuenta bancaria a tu nombre.</p>
        <Link href="/dashboard/billetera/cuentas" className={buttonVariants({ className: 'mt-4' })}>
          Agregar una cuenta
        </Link>
      </Card>
    )
  }

  const route = account ? routing(account) : null

  if (step === 'review' && account && route) {
    return (
      <Card className="p-5 sm:p-6">
        <h2 className="text-lg font-semibold">Revisá y confirmá</h2>
        <p className="mt-1 text-sm text-muted-foreground">Verificá los datos: una vez enviado, el importe queda retenido hasta que se resuelva.</p>
        {error ? (
          <Alert variant="destructive" className="mt-4">
            {error}
          </Alert>
        ) : null}
        <dl className="mt-4 divide-y rounded-xl border text-sm">
          {[
            ['Desde', 'Mi billetera UNICRÉDITOS'],
            ['Hacia', `${account.bankName}`],
            ['Titular', account.holderName],
            [route.scheme, route.value],
            ['Importe', formatMoney(Number.isNaN(value) ? 0 : value)],
            ['Concepto', `${conceptCode} · ${conceptLabel(conceptCode)}`],
            ['Detalle', detail.trim() || '—'],
            ['Costo', 'Sin costo'],
          ].map(([k, v]) => (
            <div key={k} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 px-4 py-2.5">
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="tnum break-all text-right font-medium">{v}</dd>
            </div>
          ))}
        </dl>
        {!account.verified ? (
          <Alert variant="warning" className="mt-4">
            Esta cuenta se cargó a mano: administración verifica que sea tuya antes de enviar el dinero. Si no coincide, se rechaza y el importe vuelve a tu billetera.
          </Alert>
        ) : null}
        <div className="mt-5 flex flex-wrap gap-2">
          <Button
            size="lg"
            disabled={pending}
            onClick={() => {
              setError(null)
              start(async () => {
                const res = await requestWithdrawal({ accountId, amount, conceptCode, concept: detail, attemptId })
                if (!res.ok) return setError(res.error)
                setDone({
                  reference: res.reference,
                  amount: res.amount,
                  balance: res.balance,
                  at: formatDateTime(new Date()),
                })
                setStep('done')
              })
            }}
          >
            {pending ? 'Solicitando…' : 'Confirmar retiro'}
          </Button>
          <Button size="lg" variant="outline" disabled={pending} onClick={() => setStep('form')}>
            Volver y editar
          </Button>
        </div>
      </Card>
    )
  }

  return (
    <Card className="p-5 sm:p-6">
      {!canSend ? (
        <Alert variant="warning" className="mb-5">
          Para retirar necesitás{' '}
          <Link href="/dashboard/perfil/identidad" className="font-semibold underline">
            verificar tu identidad
          </Link>
          .
        </Alert>
      ) : null}
      <form
        onSubmit={(e) => {
          e.preventDefault()
          setError(null)
          setStep('review')
        }}
        className="flex flex-col gap-5"
      >
        <div className="rounded-xl bg-muted/60 p-4">
          <p className="text-[13px] text-muted-foreground">Saldo disponible</p>
          <p className="tnum text-2xl font-semibold">{formatMoney(balance)}</p>
        </div>

        <Field id="account" label="Cuenta de destino">
          <select id="account" value={accountId} onChange={(e) => setAccountId(e.target.value)} className={SELECT}>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.bankName} · {a.cbu || a.cvu ? `…${(a.cbu ?? a.cvu ?? '').slice(-6)}` : `@${a.alias}`}
              </option>
            ))}
          </select>
        </Field>
        {account && route ? (
          <div className="-mt-2 rounded-xl border p-3 text-sm">
            <p className="flex flex-wrap items-center gap-2 font-medium">
              {account.holderName}
              {account.verified ? (
                <span className="inline-flex items-center gap-1 text-[12px] font-medium text-success">
                  <BadgeCheck className="size-3.5" aria-hidden="true" /> Titular verificado
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[12px] font-medium text-warning">
                  <AlertTriangle className="size-3.5" aria-hidden="true" /> Titularidad a verificar por administración
                </span>
              )}
            </p>
            <p className="tnum mt-0.5 break-all text-muted-foreground">
              {account.bankName} · {route.scheme} {route.value}
            </p>
          </div>
        ) : null}

        <Field id="amount" label="Importe" hint={`Mínimo ${formatMoney(MIN)}. Sin costo.`} error={amountError ?? undefined}>
          <Input
            id="amount"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
            placeholder="0,00"
            className="tnum h-11 text-base sm:h-10 sm:text-sm"
            aria-invalid={Boolean(amountError)}
          />
        </Field>
        <div className="-mt-3 flex flex-wrap gap-2">
          {[1000, 5000, 10000].filter((n) => n <= available).map((n) => (
            <Button key={n} type="button" size="sm" variant="outline" onClick={() => setAmount(String(n))}>
              {formatMoney(n)}
            </Button>
          ))}
          <Button type="button" size="sm" variant="outline" disabled={available < MIN} onClick={() => setAmount(String(available).replace('.', ','))}>
            Todo el saldo
          </Button>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="concept-code" label="Concepto">
            <select id="concept-code" value={conceptCode} onChange={(e) => setConceptCode(e.target.value)} className={SELECT}>
              {TRANSFER_CONCEPTS.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} · {c.label}
                </option>
              ))}
            </select>
          </Field>
          <Field id="detail" label="Detalle (opcional)">
            <Input id="detail" value={detail} onChange={(e) => setDetail(e.target.value)} maxLength={60} className="h-11 text-base sm:h-10 sm:text-sm" />
          </Field>
        </div>

        <Button type="submit" size="lg" disabled={!amount.trim() || Boolean(amountError) || !canSend} className="self-start">
          Continuar <ArrowRight />
        </Button>
        <p className="text-[13px] text-muted-foreground">
          El importe se retiene de tu saldo al confirmar. Si el administrador lo rechaza o lo cancelás antes de que se envíe, vuelve a tu billetera.
        </p>
      </form>
    </Card>
  )
}
