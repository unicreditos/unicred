'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { cancelWithdrawal } from '@/app/actions/billetera'
import { Button } from '@/components/ui/button'

export function CancelPayoutButton({ payoutId }: { payoutId: string }) {
  const router = useRouter()
  const [confirm, setConfirm] = useState(false)
  const [pending, start] = useTransition()

  if (!confirm) {
    return (
      <Button variant="ghost" size="sm" onClick={() => setConfirm(true)}>
        Cancelar
      </Button>
    )
  }
  return (
    <span className="flex items-center gap-1">
      <Button
        variant="destructive"
        size="sm"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await cancelWithdrawal(payoutId)
            if (!res.ok) {
              toast.error(res.error)
              return
            }
            toast.success('Retiro cancelado: el dinero volvió a tu billetera')
            router.refresh()
          })
        }
      >
        {pending ? 'Cancelando…' : 'Sí, cancelar'}
      </Button>
      <Button variant="ghost" size="sm" onClick={() => setConfirm(false)}>
        No
      </Button>
    </span>
  )
}
