'use client'

import { PedirAppShell } from '@/components/pedir/app-shell'
import { PayInstallmentDialog } from '@/components/payments/pay-installment-dialog'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

export function PedirPayClient({
  email,
  installment,
}: {
  email: string | null
  installment: {
    id: string
    number: number
    amount: string | number
    dueDate: Date | string
    loanId: string
  }
}) {
  const router = useRouter()
  const [open, setOpen] = useState(true)

  useEffect(() => {
    setOpen(true)
  }, [installment.id])

  return (
    <PedirAppShell title="Pagar cuota" subtitle={`Cuota ${String(installment.number).padStart(2, '0')}`}>
      <div className="lp-app-panel">
        <p className="text-sm text-[var(--lp-muted)]">
          Completá el pago con Mercado Pago o transferencia. Si cerrás el diálogo, volvés al inicio de la app.
        </p>
        <Link href="/pedir/cuenta" className="lp-btn lp-btn-ghost mt-4 text-[var(--lp-ink)]">
          Volver al inicio
        </Link>
      </div>
      <PayInstallmentDialog
        open={open}
        payPathPrefix="/pedir/pagar"
        returnPath="/pedir/cuenta"
        email={email}
        installments={[installment]}
        onClose={() => {
          setOpen(false)
          router.replace('/pedir/cuenta')
          router.refresh()
        }}
      />
    </PedirAppShell>
  )
}
