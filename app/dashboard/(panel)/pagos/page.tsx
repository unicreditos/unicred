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
        actions={
          <div className="uc-cta-row" style={{ gap: 8 }}>
            <ButtonLink href="/dashboard/pagos/pago-parcial">
              Simulador pago parcial
            </ButtonLink>
            <ButtonLink href="/dashboard/pagos/historial">Ver historial de pagos</ButtonLink>
          </div>
        }
      />
      <div style={{ marginBottom: 16 }}>
        <div className="p-3.5 bg-blue-50/80 border border-blue-200 rounded-xl flex items-center justify-between gap-3 text-xs">
          <div className="text-blue-900">
            <b>¿Necesitás realizar un pago parcial o a cuenta?</b> Calculá si cubre los intereses y capital vencido, y su impacto exacto en el saldo pendiente.
          </div>
          <ButtonLink href="/dashboard/pagos/pago-parcial" className="shrink-0 text-xs">
            Calcular ahora →
          </ButtonLink>
        </div>
      </div>
      <Suspense fallback={<div className="uc-card uc-pad">Cargando…</div>}>
        <PagosPanel installments={installments} savedMethods={savedMethods} isPending={false} payerEmail={user.email} />
      </Suspense>
    </>
  )
}
