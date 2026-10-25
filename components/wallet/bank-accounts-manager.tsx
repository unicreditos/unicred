'use client'

import { AlertTriangle, BadgeCheck, Plus, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { addBankAccount, removeBankAccount } from '@/app/actions/billetera'
import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { formatCbu } from '@/lib/format'

type Account = {
  id: string
  bankName: string
  holderName: string
  cbu: string | null
  cvu: string | null
  alias: string | null
  isPrimary: boolean
  verified: boolean
}

const INPUT = 'h-11 text-base sm:h-10 sm:text-sm'

export function BankAccountsManager({ accounts, canAdd, ownerName }: { accounts: Account[]; canAdd: boolean; ownerName: string }) {
  const router = useRouter()
  const [identifier, setIdentifier] = useState('')
  const [manual, setManual] = useState(false)
  const [bankName, setBankName] = useState('')
  const [holderName, setHolderName] = useState(ownerName)
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const [removing, setRemoving] = useState<string | null>(null)

  function add(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    start(async () => {
      const res = await addBankAccount(identifier, manual ? { bankName, holderName } : undefined)
      if (!res.ok) return setError(res.error)
      if (res.needsManual) {
        // La validación bancaria no respondió: se piden los datos para cargarla a mano.
        setManual(true)
        setError('No pudimos validar la cuenta con la red bancaria en este momento. Completá los datos y la cargamos a mano: administración verifica que sea tuya antes de enviarte dinero.')
        return
      }
      toast.success(res.verified ? `Cuenta de ${res.bankName} agregada` : `Cuenta de ${res.bankName} cargada: pendiente de verificación`)
      setIdentifier('')
      setManual(false)
      setBankName('')
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <Card className="p-5 sm:p-6">
        <h2 className="text-lg font-semibold">Agregar una cuenta propia</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Ingresá el CBU, CVU o alias. Verificamos con la red bancaria que seas el titular: solo se puede retirar a cuentas que estén a tu nombre.
        </p>
        {!canAdd ? (
          <Alert variant="warning" className="mt-4">
            Para agregar cuentas primero tenés que verificar tu identidad.
          </Alert>
        ) : null}
        <form onSubmit={add} className="mt-5 flex flex-col gap-4">
          {error ? <Alert variant={manual ? 'warning' : 'destructive'}>{error}</Alert> : null}
          <Field id="acc" label="CBU, CVU o alias">
            <Input
              id="acc"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              className={`font-mono ${INPUT}`}
              placeholder="0000003100012345678901 o mi.alias"
            />
          </Field>
          {manual ? (
            <>
              <Field id="holder" label="Titular de la cuenta" hint="Tiene que ser tu nombre: administración lo comprueba.">
                <Input id="holder" value={holderName} onChange={(e) => setHolderName(e.target.value)} autoComplete="name" className={INPUT} />
              </Field>
              <Field id="bank" label="Banco o billetera" hint="Si el CBU es de un banco conocido lo completamos solos.">
                <Input id="bank" value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="Ej. Banco Galicia, Mercado Pago" className={INPUT} />
              </Field>
            </>
          ) : null}
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" size="lg" disabled={pending || !identifier.trim() || !canAdd}>
              <Plus />
              {pending ? 'Verificando…' : manual ? 'Cargar a mano' : 'Verificar y agregar'}
            </Button>
            {manual ? (
              <Button type="button" variant="ghost" onClick={() => { setManual(false); setError(null) }}>
                Probar de nuevo con validación
              </Button>
            ) : null}
          </div>
        </form>
      </Card>

      <section aria-labelledby="mis-cuentas">
        <h2 id="mis-cuentas" className="mb-3 text-lg font-semibold">
          Tus cuentas
        </h2>
        {accounts.length === 0 ? (
          <Card className="p-6 text-sm text-muted-foreground">Todavía no agregaste ninguna cuenta.</Card>
        ) : (
          <Card className="divide-y overflow-hidden">
            {accounts.map((a) => (
              <div key={a.id} className="flex flex-wrap items-center gap-3 p-4 sm:px-6">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                    {a.bankName}
                    {a.verified ? (
                      <Badge variant="success">
                        <BadgeCheck className="size-3.5" aria-hidden="true" />
                        Titular verificado
                      </Badge>
                    ) : (
                      <Badge variant="reviewing">
                        <AlertTriangle className="size-3.5" aria-hidden="true" />
                        Pendiente de verificación
                      </Badge>
                    )}
                    {a.isPrimary ? <Badge variant="secondary">Principal</Badge> : null}
                  </p>
                  <p className="tnum break-all text-[13px] text-muted-foreground">
                    {a.cbu || a.cvu ? formatCbu(a.cbu ?? a.cvu) : null}
                    {a.alias ? `${a.cbu || a.cvu ? ' · ' : ''}@${a.alias}` : ''}
                  </p>
                </div>
                {removing === a.id ? (
                  <span className="flex items-center gap-1">
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() =>
                        start(async () => {
                          const res = await removeBankAccount(a.id)
                          setRemoving(null)
                          if (!res.ok) {
                            toast.error(res.error)
                            return
                          }
                          toast.success('Cuenta eliminada')
                          router.refresh()
                        })
                      }
                    >
                      Eliminar
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setRemoving(null)}>
                      No
                    </Button>
                  </span>
                ) : (
                  <Button variant="ghost" size="icon" aria-label={`Eliminar la cuenta de ${a.bankName}`} onClick={() => setRemoving(a.id)}>
                    <Trash2 />
                  </Button>
                )}
              </div>
            ))}
          </Card>
        )}
      </section>
    </div>
  )
}
