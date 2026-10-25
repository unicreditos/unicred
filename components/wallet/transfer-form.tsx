'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { BookUser, CheckCircle2, Trash2, UserRoundPlus } from 'lucide-react'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { removeContactAction, resolveDestination, saveContactAction, transferToWallet } from '@/app/actions/billetera'
import { Alert } from '@/components/ui/alert'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { formatMoney } from '@/lib/money'
import type { ContactRow } from '@/lib/wallet/contacts'
import { amountProblem, parseAmountText } from '@/lib/wallet/adjustment'

type Payee = { alias: string; holder: string; saved: boolean }
type Done = { reference: string; toAlias: string; amount: string; balance: string; saved: boolean }

export function TransferForm({ balance, canSend, initialDestination = '', contacts = [] }: { balance: string; canSend: boolean; initialDestination?: string; contacts?: ContactRow[] }) {
  const router = useRouter()
  const [destination, setDestination] = useState(initialDestination)
  const [payee, setPayee] = useState<Payee | null>(null)
  const [amount, setAmount] = useState('')
  const [concept, setConcept] = useState('')
  const [attemptId, setAttemptId] = useState(() => crypto.randomUUID())
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<Done | null>(null)
  const [pending, start] = useTransition()
  const cents = parseAmountText(amount)
  const available = `Disponible: ${formatMoney(balance)}`
  const amountHint = !amount.trim() ? available : cents === null ? (amountProblem(amount) ?? '') : `Vas a enviar ${formatMoney(cents / 100)} · ${available}`

  function resolve(value: string) {
    setError(null)
    start(async () => {
      const res = await resolveDestination(value)
      if (!res.ok) return setError(res.error)
      setDestination(value)
      setPayee({ alias: res.alias, holder: res.holder, saved: res.saved })
    })
  }

  function lookup(e: React.FormEvent) {
    e.preventDefault()
    resolve(destination)
  }

  function saveContact(alias: string, onSaved: () => void) {
    start(async () => {
      const res = await saveContactAction({ destination: alias })
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success(`Guardamos a @${alias} en tus contactos`)
      onSaved()
      router.refresh()
    })
  }

  function removeContact(c: ContactRow) {
    start(async () => {
      const res = await removeContactAction(c.id)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success('Quitamos el contacto')
      router.refresh()
    })
  }

  function send(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    start(async () => {
      const res = await transferToWallet({ destination, amount, concept, attemptId })
      if (!res.ok) return setError(res.error)
      setDone({ reference: res.reference, toAlias: res.toAlias, amount: res.amount, balance: res.balance, saved: res.saved })
    })
  }

  if (done) {
    return (
      <Card className="p-6 sm:p-8">
        <CheckCircle2 className="size-10 text-success" aria-hidden="true" />
        <h2 className="mt-4 text-2xl font-semibold">Transferencia enviada</h2>
        <p className="mt-2 text-muted-foreground">
          Enviaste <strong className="text-foreground">{formatMoney(done.amount)}</strong> a @{done.toAlias}. Referencia{' '}
          <span className="tnum">{done.reference}</span>. Tu saldo ahora es {formatMoney(done.balance)}.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/dashboard/billetera" className={buttonVariants()}>
            Volver a mi billetera
          </Link>
          {!done.saved ? (
            <Button variant="outline" disabled={pending} onClick={() => saveContact(done.toAlias, () => setDone({ ...done, saved: true }))}>
              <UserRoundPlus />
              Guardar contacto
            </Button>
          ) : null}
          <Button
            variant="outline"
            onClick={() => {
              setDone(null)
              setPayee(null)
              setDestination('')
              setAmount('')
              setConcept('')
              setAttemptId(crypto.randomUUID())
            }}
          >
            Hacer otra transferencia
          </Button>
        </div>
      </Card>
    )
  }

  return (
    <Card className="p-5 sm:p-6">
      {!canSend ? (
        <Alert variant="warning" className="mb-5">
          Para enviar dinero primero tenés que{' '}
          <Link href="/dashboard/perfil/identidad" className="font-semibold underline">
            verificar tu identidad
          </Link>
          .
        </Alert>
      ) : null}
      {error ? <Alert variant="destructive" className="mb-5">{error}</Alert> : null}

      {!payee ? (
        <form onSubmit={lookup} className="flex flex-col gap-5">
          <Field id="destination" label="CVU o alias de destino" hint="La billetera UNICRÉDITOS de quien recibe.">
            <Input
              id="destination"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              required
              aria-describedby="destination-hint"
              placeholder="unicred.1a2b3c4d o 22 dígitos"
            />
          </Field>
          <Button type="submit" size="lg" disabled={pending || !destination.trim() || !canSend} className="self-start">
            {pending ? 'Buscando…' : 'Continuar'}
          </Button>
          {contacts.length > 0 ? (
            <section aria-labelledby="contactos" className="border-t pt-5">
              <h2 id="contactos" className="flex items-center gap-2 text-sm font-semibold">
                <BookUser className="size-4 text-muted-foreground" aria-hidden="true" />
                Tus contactos
              </h2>
              <ul className="mt-3 divide-y rounded-xl border">
                {contacts.map((c) => (
                  <li key={c.id} className="flex items-center gap-2 pr-2">
                    <button
                      type="button"
                      disabled={pending || !canSend || !c.alias}
                      onClick={() => c.alias && resolve(c.alias)}
                      className="flex min-w-0 flex-1 flex-col gap-0.5 rounded-l-xl px-4 py-3 text-left hover:bg-muted/60 disabled:opacity-60"
                    >
                      <span className="truncate text-sm font-medium">{c.label ? `${c.label} · ${c.name}` : c.name}</span>
                      <span className="tnum truncate text-[13px] text-muted-foreground">@{c.alias ?? c.cvu}</span>
                    </button>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => removeContact(c)}
                      aria-label={`Quitar a ${c.name} de mis contactos`}
                      className="flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-destructive"
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </form>
      ) : (
        <form onSubmit={send} className="flex flex-col gap-5">
          <div className="rounded-xl border bg-muted/50 p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Le enviás a</p>
            <p className="mt-1 text-lg font-semibold">{payee.holder}</p>
            <p className="tnum text-sm text-muted-foreground">@{payee.alias}</p>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
              <button type="button" className="text-[13px] font-medium text-primary hover:underline" onClick={() => setPayee(null)}>
                Cambiar destino
              </button>
              {payee.saved ? (
                <span className="text-[13px] text-muted-foreground">En tus contactos</span>
              ) : (
                <button type="button" disabled={pending} className="text-[13px] font-medium text-primary hover:underline" onClick={() => saveContact(payee.alias, () => setPayee({ ...payee, saved: true }))}>
                  Guardar en mis contactos
                </button>
              )}
            </div>
          </div>
          <Field id="amount" label="Importe" hint={amountHint}>
            <Input
              id="amount"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              autoComplete="off"
              aria-describedby="amount-hint"
              placeholder="0,00"
              className="tnum"
            />
          </Field>
          <Field id="concept" label="Concepto (opcional)">
            <Input id="concept" value={concept} onChange={(e) => setConcept(e.target.value)} maxLength={80} />
          </Field>
          <Button type="submit" size="lg" disabled={pending || cents === null} className="self-start">
            {pending ? 'Enviando…' : 'Enviar dinero'}
          </Button>
        </form>
      )}
    </Card>
  )
}
