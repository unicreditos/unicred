import { emitFacturaBInterest } from '@/lib/arca/wsfe'
import { getActivePtoVta } from '@/lib/arca/config'
import { db } from '@/lib/db'
import { ensureOriginacionSchema } from '@/lib/db/ensure-originacion'
import { arcaInvoice, installment, loan, paymentReceipt, profile } from '@/lib/db/schema'
import { IVA_INTERESES } from '@/lib/finance'
import { frenchInstallmentSplit } from '@/lib/legal/money-words'
import { newId } from '@/lib/session'
import { desc, eq } from 'drizzle-orm'

function round2(n: number) {
  return Math.round(n * 100) / 100
}

export function interestInvoiceAmounts(opts: {
  principal: number
  monthlyRate: number
  term: number
  installmentNumber: number
}) {
  const split = frenchInstallmentSplit(opts.principal, opts.monthlyRate, opts.term, opts.installmentNumber)
  const impNeto = split.interest
  const impIva = round2(impNeto * IVA_INTERESES)
  return { impNeto, impIva, impTotal: round2(impNeto + impIva) }
}

/**
 * Arma la factura de intereses y la deja en cola ('queued') apenas se cobra la
 * cuota. NO llama a ARCA/AFIP — eso lo dispara un admin a mano desde el panel
 * (emitArcaInvoice), justo como en Emitia: el cálculo es automático, el envío
 * que consume numeración oficial es manual.
 */
export async function queueInterestInvoiceForInstallment(installmentId: string) {
  await ensureOriginacionSchema()
  const [inst] = await db.select().from(installment).where(eq(installment.id, installmentId)).limit(1)
  if (!inst) return { ok: false as const, error: 'Cuota no encontrada.' }
  if (inst.status !== 'paid') {
    return { ok: false as const, error: 'La factura de intereses se pone en cola al cobrar la cuota.' }
  }

  const [existing] = await db
    .select()
    .from(arcaInvoice)
    .where(eq(arcaInvoice.installmentId, installmentId))
    .limit(1)
  if (existing) {
    return { ok: true as const, invoiceId: existing.id, already: true }
  }

  const [loanRow] = await db.select().from(loan).where(eq(loan.id, inst.loanId)).limit(1)
  if (!loanRow) return { ok: false as const, error: 'Crédito no encontrado.' }

  const [prof] = await db.select({ cuil: profile.cuil }).from(profile).where(eq(profile.userId, inst.userId)).limit(1)
  const docNro = String(prof?.cuil ?? '').replace(/\D/g, '')
  if (docNro.length !== 11) {
    return { ok: false as const, error: 'El titular no tiene CUIL para facturar.' }
  }

  const amounts = interestInvoiceAmounts({
    principal: Number(loanRow.principal),
    monthlyRate: Number(loanRow.monthlyRate),
    term: loanRow.term,
    installmentNumber: inst.number,
  })
  if (amounts.impNeto <= 0) {
    return { ok: true as const, invoiceId: null, skipped: true as const }
  }

  const now = new Date()
  const id = newId('fe')
  // Punto de venta informativo al encolar; el real (por si cambió) se relee al emitir.
  const ptoVtaHint = (await getActivePtoVta()) ?? 0
  await db.insert(arcaInvoice).values({
    id,
    userId: inst.userId,
    loanId: inst.loanId,
    installmentId,
    cbteTipo: 6,
    ptoVta: ptoVtaHint,
    docTipo: 80,
    docNro,
    impNeto: String(amounts.impNeto),
    impIva: String(amounts.impIva),
    impTotal: String(amounts.impTotal),
    status: 'queued',
    createdAt: now,
    updatedAt: now,
  })
  return { ok: true as const, invoiceId: id }
}

/**
 * Emite de verdad contra ARCA/AFIP una factura ya encolada ('queued') o que
 * falló antes ('failed'). Siempre disparado a mano por un admin — nunca
 * automático — porque consume un número de comprobante oficial.
 */
export async function emitArcaInvoice(invoiceId: string) {
  await ensureOriginacionSchema()
  const [row] = await db.select().from(arcaInvoice).where(eq(arcaInvoice.id, invoiceId)).limit(1)
  if (!row) return { ok: false as const, error: 'Factura no encontrada.' }
  if (row.status === 'authorized' && row.cae) {
    return { ok: true as const, invoiceId: row.id, already: true }
  }

  const now = new Date()
  try {
    const emitted = await emitFacturaBInterest({
      docNro: row.docNro,
      impNeto: Number(row.impNeto),
      impIva: Number(row.impIva),
    })
    if (emitted.ok) {
      await db
        .update(arcaInvoice)
        .set({
          status: 'authorized',
          cae: emitted.cae,
          caeVto: emitted.caeVto,
          cbteNro: emitted.cbteNro,
          ptoVta: emitted.ptoVta,
          cbteTipo: emitted.cbteTipo,
          arcaError: null,
          issuedAt: now,
          updatedAt: now,
        })
        .where(eq(arcaInvoice.id, invoiceId))
      return { ok: true as const, invoiceId }
    }
    await db
      .update(arcaInvoice)
      .set({ status: 'failed', arcaError: emitted.error, updatedAt: now })
      .where(eq(arcaInvoice.id, invoiceId))
    return { ok: false as const, error: emitted.error, invoiceId }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'ARCA no respondió'
    await db
      .update(arcaInvoice)
      .set({ status: 'failed', arcaError: msg, updatedAt: now })
      .where(eq(arcaInvoice.id, invoiceId))
    return { ok: false as const, error: msg, invoiceId }
  }
}

export function enqueueInterestInvoices(installmentIds: string[]) {
  const ids = installmentIds.filter(Boolean)
  if (!ids.length) return
  void Promise.all(ids.map((id) => queueInterestInvoiceForInstallment(id))).catch((err) => {
    console.warn('[arca-fe]', (err as Error).message)
  })
}

export async function enqueueInvoicesForPayment(paymentId: string) {
  if (!paymentId) return
  const rows = await db
    .select({ installmentId: paymentReceipt.installmentId })
    .from(paymentReceipt)
    .where(eq(paymentReceipt.paymentId, paymentId))
  enqueueInterestInvoices(rows.map((row) => row.installmentId).filter((id): id is string => Boolean(id)))
}

export async function listArcaInvoices(limit = 80) {
  await ensureOriginacionSchema()
  return db.select().from(arcaInvoice).orderBy(desc(arcaInvoice.createdAt)).limit(limit)
}

