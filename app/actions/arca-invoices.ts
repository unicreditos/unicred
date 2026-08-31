'use server'

import { listArcaInvoices, retryArcaInvoice } from '@/lib/arca/invoice'
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

export async function retryArcaInvoiceAdmin(id: string) {
  await requireAdmin()
  const result = await retryArcaInvoice(id)
  revalidateOps()
  return result
}
