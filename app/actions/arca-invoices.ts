'use server'

import { listArcaInvoices, emitArcaInvoice } from '@/lib/arca/invoice'
import { requireAdmin } from '@/lib/session'
import { revalidateOps } from '@/lib/revalidate'

export async function getArcaInvoices() {
  await requireAdmin()
  const rows = await listArcaInvoices(80)
  return rows.map((row) => ({
    id: row.id,
    userId: row.userId,
    loanId: row.loanId,
    installmentId: row.installmentId,
    status: row.status,
    cae: row.cae,
    caeVto: row.caeVto,
    cbteNro: row.cbteNro,
    ptoVta: row.ptoVta,
    impNeto: row.impNeto,
    impIva: row.impIva,
    impTotal: row.impTotal,
    arcaError: row.arcaError,
    createdAt: row.createdAt.toISOString(),
  }))
}

/** Emite (o reintenta) contra ARCA una factura en cola o que falló. Siempre a mano, nunca automático. */
export async function emitArcaInvoiceAdmin(id: string) {
  await requireAdmin()
  const result = await emitArcaInvoice(id)
  revalidateOps()
  return result
}
