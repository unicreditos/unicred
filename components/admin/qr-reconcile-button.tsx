'use client'

import { RefreshCw } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { toast } from 'sonner'
import { adminReconcileQr } from '@/app/actions/admin-qr'
import { Button } from '@/components/ui/button'
import { formatMoney } from '@/lib/money'

export function QrReconcileButton() {
  const router = useRouter()
  const [pending, start] = useTransition()
  return (
    <Button
      variant="outline"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await adminReconcileQr()
          if (!r.ok) {
            toast.error(r.error)
            return
          }
          const detail = `${r.orders} órdenes y ${r.pos} cajas revisadas`
          if (Number(r.credited) > 0) toast.success(`Se acreditaron ${formatMoney(r.credited)} · ${detail}`)
          else toast(r.errors ? `${detail}, con ${r.errors} errores de conexión` : `Todo al día · ${detail}`)
          router.refresh()
        })
      }
    >
      <RefreshCw className={pending ? 'animate-spin' : ''} />
      {pending ? 'Conciliando…' : 'Conciliar con Mercado Pago'}
    </Button>
  )
}
