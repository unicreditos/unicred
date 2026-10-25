'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { toast } from 'sonner'
import { adminCreateWallet } from '@/app/actions/admin-wallet'
import { WalletAdjustForm } from '@/components/admin/wallet-adjust-form'
import { WalletStatusCard } from '@/components/admin/wallet-status-card'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

type Props = {
  userId: string
  holderName: string
  hasWallet: boolean
  status: string | null
  balance: string
  canMoney: boolean
  canManage: boolean
}

/** Acciones de administración sobre una billetera: ajustar el saldo y cambiar su estado (o crearla si no existe). */
export function WalletActions({ userId, holderName, hasWallet, status, balance, canMoney, canManage }: Props) {
  const router = useRouter()
  const [pending, start] = useTransition()

  if (!hasWallet) {
    return (
      <Card className="p-5 sm:p-6">
        <h2 className="text-base font-semibold">Esta persona no tiene billetera</h2>
        <p className="mt-1 text-[13px] text-muted-foreground">Se crea con su CVU y alias propios. Después vas a poder acreditarle saldo.</p>
        {canManage ? (
          <Button
            className="mt-4 w-full"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const res = await adminCreateWallet(userId)
                if (!res.ok) {
                  toast.error(res.error)
                  return
                }
                toast.success('Billetera creada')
                router.refresh()
              })
            }
          >
            {pending ? 'Creando…' : 'Crear billetera'}
          </Button>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">No tenés permiso para crearla.</p>
        )}
      </Card>
    )
  }

  if (!canMoney && !canManage) return null
  return (
    <div className="flex flex-col gap-5">
      {canMoney ? <WalletAdjustForm userId={userId} holderName={holderName} balance={balance} /> : null}
      {canManage ? <WalletStatusCard userId={userId} blocked={status !== 'active'} /> : null}
    </div>
  )
}
