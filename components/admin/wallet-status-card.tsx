'use client'

import { ShieldAlert, ShieldCheck } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useId, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { adminSetWalletStatus } from '@/app/actions/admin-wallet'
import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Field } from '@/components/ui/field'
import { Textarea } from '@/components/ui/textarea'
import { MAX_REASON, reasonProblem } from '@/lib/wallet/adjustment'
import { cn } from '@/lib/utils'

/** Estado de la billetera: bloquear o reactivar, siempre con un motivo que queda en la auditoría. */
export function WalletStatusCard({ userId, blocked }: { userId: string; blocked: boolean }) {
  const router = useRouter()
  const uid = useId()
  const [reason, setReason] = useState('')
  const [touched, setTouched] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const problem = reasonProblem(reason)

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setTouched(true)
    if (problem) return
    setError(null)
    start(async () => {
      const res = await adminSetWalletStatus({ userId, status: blocked ? 'active' : 'blocked', reason })
      if (!res.ok) {
        setError(res.error)
        return
      }
      toast.success(blocked ? 'Billetera reactivada' : 'Billetera bloqueada')
      setReason('')
      setTouched(false)
      router.refresh()
    })
  }

  return (
    <Card className={cn('overflow-hidden', blocked ? 'border-warning/50' : '')}>
      <div className="flex items-start gap-3 border-b px-5 py-4 sm:px-6">
        <span
          className={cn('flex size-9 shrink-0 items-center justify-center rounded-lg', blocked ? 'bg-warning/15 text-warning' : 'bg-success/12 text-success')}
          aria-hidden="true"
        >
          {blocked ? <ShieldAlert className="size-[18px]" /> : <ShieldCheck className="size-[18px]" />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold leading-tight">Estado de la billetera</h2>
            <Badge variant={blocked ? 'warning' : 'success'}>{blocked ? 'Bloqueada' : 'Activa'}</Badge>
          </div>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            {blocked
              ? 'No puede enviar ni recibir dinero. Reactivala cuando se resuelva el motivo.'
              : 'Bloquearla impide enviar y recibir dinero. Los retiros pendientes se pueden devolver.'}
          </p>
        </div>
      </div>
      <form onSubmit={submit} className="flex flex-col gap-4 px-5 py-5 sm:px-6" noValidate>
        <Field id={`${uid}-reason`} label="Motivo" hint="Queda en la auditoría." error={touched ? problem : null}>
          <Textarea
            id={`${uid}-reason`}
            rows={2}
            value={reason}
            maxLength={MAX_REASON}
            onChange={(e) => setReason(e.target.value)}
            onBlur={() => setTouched(true)}
            placeholder={blocked ? 'Qué se resolvió para reactivarla' : 'Por qué se bloquea'}
            aria-invalid={touched && problem ? true : undefined}
            aria-describedby={touched && problem ? `${uid}-reason-error` : `${uid}-reason-hint`}
          />
        </Field>
        {error ? <Alert variant="destructive">{error}</Alert> : null}
        <Button type="submit" variant={blocked ? 'default' : 'outline'} disabled={pending} className={cn('w-full', !blocked && 'border-destructive/50 text-destructive hover:bg-destructive/10')}>
          {pending ? 'Guardando…' : blocked ? 'Reactivar billetera' : 'Bloquear billetera'}
        </Button>
      </form>
    </Card>
  )
}
