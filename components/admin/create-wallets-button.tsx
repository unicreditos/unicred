'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { toast } from 'sonner'
import { adminCreateMissingWallets } from '@/app/actions/admin-wallet'
import { Button } from '@/components/ui/button'

export function CreateWalletsButton({ missing }: { missing: number }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  if (missing === 0) return null
  return (
    <Button
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await adminCreateMissingWallets()
          if (!res.ok) {
            toast.error(res.error)
            return
          }
          toast.success(`${res.created} billetera${res.created === 1 ? '' : 's'} creada${res.created === 1 ? '' : 's'}`)
          router.refresh()
        })
      }
    >
      {pending ? 'Creando…' : `Crear ${missing} billetera${missing === 1 ? '' : 's'} faltante${missing === 1 ? '' : 's'}`}
    </Button>
  )
}
