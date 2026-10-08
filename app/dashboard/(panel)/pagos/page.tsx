import { Suspense } from 'react'
import { and, desc, eq } from 'drizzle-orm'
import { PagosPanel } from '@/components/dashboard/pagos-panel'
import { ButtonLink, PageHead } from '@/components/uc/blocks'
import { db } from '@/lib/db'
import { savedPaymentMethod } from '@/lib/db/schema'
import { loadCustomer } from '@/lib/customer/load'

export const metadata = { title: 'Pagar una cuota' }

export default async function PagosPage() {
  const { userId, user, installments } = await loadCustomer()
  const savedMethods = await db
    .select()
    .from(savedPaymentMethod)
    .where(and(eq(savedPaymentMethod.userId, userId), eq(savedPaymentMethod.isActive, true)))
    .orderBy(desc(savedPaymentMethod.isDefault), desc(savedPaymentMethod.lastUsedAt))
    .catch(() => [])

  return (
    <>
      <PageHead
        title="Pagar una cuota"
        description="Elegí qué cuotas pagar y cómo. Cada pago genera su comprobante."
        actions={<ButtonLink href="/dashboard/pagos/historial">Ver historial de pagos</ButtonLink>}
      />
      <Suspense fallback={<div className="uc-card uc-pad">Cargando…</div>}>
        <PagosPanel installments={installments} savedMethods={savedMethods} isPending={false} payerEmail={user.email} />
      </Suspense>
    </>
  )
}
