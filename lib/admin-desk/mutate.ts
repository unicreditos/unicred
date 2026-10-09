import { and, desc, eq, ne } from 'drizzle-orm'
import { recordAudit } from '@/lib/audit'
import { db } from '@/lib/db'
import {
  bankAccount,
  disbursement,
  installment,
  kycVerification,
  loan,
  loanProduct,
  merchant,
  payment,
  paymentReceipt,
  profile,
  supportCase,
} from '@/lib/db/schema'
import { diditApprovedForUser } from '@/lib/didit'
import { assertAdminTransition, canSettleOnCollection } from '@/lib/loan-state'
import {
  activateLoanAfterDisbursement,
  ensurePendingDisbursement,
} from '@/lib/loan-schedule'
import {
  mobileAdminApproveLoan,
  mobileAdminRejectLoan,
} from '@/lib/mobile/ops'
import { newId } from '@/lib/session'
import { computeFrenchAmortization } from '@/lib/finance'
import { requireAcceptedContract } from '@/lib/legal/expediente'

export type DeskMutateAction =
  | 'approveApplication'
  | 'rejectApplication'
  | 'cancelApplication'
  | 'decideKyc'
  | 'markDisbursed'
  | 'failDisbursement'
  | 'retryDisbursement'
  | 'registerPayment'
  | 'matchTransfer'
  | 'rejectTransfer'
  | 'logCollectionContact'
  | 'resolveTicket'
  | 'pauseMerchant'
  | 'activateMerchant'
  | 'createApplication'

export type DeskMutateResult = { ok: true; id?: string } | { ok: false; error: string }

function fail(error: string): DeskMutateResult {
  return { ok: false, error }
}

function ok(id?: string): DeskMutateResult {
  return id ? { ok: true, id } : { ok: true }
}

/** Aplica un pago a una cuota sin depender de sesión cookie (JWT desk). */
async function deskApplyToInstallment(
  paymentId: string,
  installmentId: string,
  amountPaid: number,
  adminUserId: string,
) {
  const [inst] = await db.select().from(installment).where(eq(installment.id, installmentId)).limit(1)
  if (!inst) throw new Error('Cuota no encontrada')
  if (inst.status === 'paid') throw new Error('La cuota ya está pagada')
  const instAmount = Number(inst.amount)
  if (!Number.isFinite(instAmount) || instAmount <= 0) {
    throw new Error('Monto de cuota inválido')
  }
  if (!Number.isFinite(amountPaid) || amountPaid <= 0) {
    throw new Error('Monto abonado inválido: debe ser mayor a cero')
  }
  if (amountPaid < instAmount - 0.01) {
    throw new Error(
      `Monto insuficiente: $${amountPaid.toFixed(2)} es menor a la cuota $${instAmount.toFixed(2)}`,
    )
  }
  const [loanObj] = await db.select().from(loan).where(eq(loan.id, inst.loanId)).limit(1)
  if (!loanObj) throw new Error('Préstamo no encontrado')
  const now = new Date()
  await db.transaction(async (tx) => {
    await tx
      .update(payment)
      .set({ status: 'paid', paidAt: now, processedBy: adminUserId, updatedAt: now })
      .where(eq(payment.id, paymentId))
    await tx
      .update(installment)
      .set({ status: 'paid', paidAt: now })
      .where(eq(installment.id, installmentId))
    const instsAfter = await tx.select().from(installment).where(eq(installment.loanId, inst.loanId))
    const allPaid = instsAfter.every((i) => i.status === 'paid')
    if (allPaid && canSettleOnCollection(loanObj.status)) {
      await tx.update(loan).set({ status: 'paid', updatedAt: now }).where(eq(loan.id, inst.loanId))
    }
    await tx.insert(paymentReceipt).values({
      id: crypto.randomUUID(),
      receiptNumber: `C-${Date.now().toString().slice(-10)}`,
      receiptType: 'payment',
      userId: inst.userId,
      paymentId,
      loanId: inst.loanId,
      installmentId,
      amount: amountPaid.toFixed(2),
      currency: 'ARS',
      paidAt: now,
      issuedAt: now,
      createdAt: now,
    })
  })
}

export async function deskMutate(
  adminUserId: string,
  action: DeskMutateAction,
  payload: Record<string, unknown>,
): Promise<DeskMutateResult> {
  try {
    switch (action) {
      case 'approveApplication': {
        const applicationId = String(payload.applicationId || '')
        const comment = String(payload.comment || payload.note || '').trim()
        if (!applicationId) return fail('Solicitud requerida')
        const [row] = await db.select().from(loan).where(eq(loan.id, applicationId)).limit(1)
        if (!row) return fail('Solicitud no encontrada')
        if (!(await diditApprovedForUser(row.userId))) {
          return fail('No se puede calificar: KYC Didit no verificado')
        }
        await mobileAdminApproveLoan(adminUserId, applicationId, comment)
        await db.transaction(async (tx) => {
          await ensurePendingDisbursement(tx, {
            loanId: applicationId,
            userId: row.userId,
            amount: Number(row.principal),
            now: new Date(),
          })
        })
        await recordAudit({
          actorUserId: adminUserId,
          action: 'LOAN_APPROVED',
          entityType: 'loan',
          entityId: applicationId,
          targetUserId: row.userId,
          summary: comment,
        })
        return ok()
      }

      case 'rejectApplication': {
        const applicationId = String(payload.applicationId || '')
        const comment = String(payload.comment || payload.note || payload.reason || '').trim()
        if (!applicationId) return fail('Solicitud requerida')
        await mobileAdminRejectLoan(adminUserId, applicationId, comment)
        return ok()
      }

      case 'cancelApplication': {
        const id = String(payload.id || payload.applicationId || '')
        const reason = String(payload.reason || 'Anulado')
        if (!id) return fail('Solicitud requerida')
        const [row] = await db.select().from(loan).where(eq(loan.id, id)).limit(1)
        if (!row) return fail('Solicitud no encontrada')
        if (row.status === 'active' || row.status === 'paid') {
          return fail('El crédito ya está vigente o saldado')
        }
        assertAdminTransition(row.status, 'cancelled')
        const now = new Date()
        await db.update(loan).set({ status: 'cancelled', rejectionReason: reason, updatedAt: now }).where(eq(loan.id, id))
        await db
          .update(disbursement)
          .set({ status: 'failed', failureReason: reason, updatedAt: now })
          .where(and(eq(disbursement.loanId, id), ne(disbursement.status, 'credited')))
        await recordAudit({
          actorUserId: adminUserId,
          action: 'LOAN_CANCELLED',
          entityType: 'loan',
          entityId: id,
          targetUserId: row.userId,
          summary: reason,
        })
        return ok()
      }

      case 'decideKyc': {
        const kycId = String(payload.kycId || '')
        const status = payload.status === 'verified' ? 'approved' : 'rejected'
        const notes = String(payload.notes || '')
        if (!kycId) return fail('KYC requerido')
        const [acc] = await db.select().from(kycVerification).where(eq(kycVerification.id, kycId)).limit(1)
        if (!acc) return fail('KYC no encontrado')
        const now = new Date()
        await db
          .update(kycVerification)
          .set({
            status,
            rejectionReason: status === 'rejected' ? notes || 'Rechazado' : null,
            reviewedBy: adminUserId,
            reviewedAt: now,
            updatedAt: now,
            verificationLevel: status === 'approved' ? 'biometric' : acc.verificationLevel,
          })
          .where(eq(kycVerification.id, kycId))
        await db.update(profile).set({ kycStatus: status, updatedAt: now }).where(eq(profile.userId, acc.userId))
        await recordAudit({
          actorUserId: adminUserId,
          action: status === 'approved' ? 'KYC_APPROVED' : 'KYC_REJECTED',
          entityType: 'kyc_verification',
          entityId: kycId,
          targetUserId: acc.userId,
          summary: notes || status,
        })
        return ok()
      }

      case 'markDisbursed': {
        const disbursementId = String(payload.disbursementId || '')
        const reference = String(payload.reference || '')
        if (!disbursementId) return fail('Desembolso requerido')
        const [d] = await db.select().from(disbursement).where(eq(disbursement.id, disbursementId)).limit(1)
        if (!d) return fail('Desembolso no encontrado')
        if (d.status === 'credited' || d.status === 'completed') return fail('Ya acreditado')
        const [loanRow] = await db.select().from(loan).where(eq(loan.id, d.loanId)).limit(1)
        if (!loanRow) return fail('Crédito no encontrado')
        if (loanRow.status !== 'approved' && loanRow.status !== 'active') {
          return fail('El crédito debe estar calificado')
        }
        try {
          await requireAcceptedContract(loanRow.id)
        } catch (err) {
          return fail(err instanceof Error ? err.message : 'Contrato no aceptado')
        }
        let destinationId = d.bankAccountId
        if (!destinationId) {
          const [dest] = await db
            .select({ id: bankAccount.id, cbu: bankAccount.cbu, cvu: bankAccount.cvu })
            .from(bankAccount)
            .where(and(eq(bankAccount.userId, d.userId), eq(bankAccount.isActive, true)))
            .orderBy(desc(bankAccount.isPrimary))
            .limit(1)
          destinationId = dest?.id ?? null
          if (destinationId) {
            await db
              .update(disbursement)
              .set({ bankAccountId: destinationId, updatedAt: new Date() })
              .where(eq(disbursement.id, disbursementId))
          }
        }
        if (!destinationId) {
          return fail(
            'El titular no tiene CBU/CVU de desembolso. Pedile que lo cargue en el panel antes de acreditar.',
          )
        }
        const [bank] = await db.select().from(bankAccount).where(eq(bankAccount.id, destinationId)).limit(1)
        const digits = String(bank?.cbu || bank?.cvu || '').replace(/\D/g, '')
        if (!/^\d{22}$/.test(digits)) {
          return fail('CBU/CVU de desembolso inválido o incompleto.')
        }
        const now = new Date()
        const receiptNumber = `DES-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${d.id.slice(-8).toUpperCase()}`
        await db.transaction(async (tx) => {
          const acquired = await tx
            .update(disbursement)
            .set({
              status: 'credited',
              creditedAt: now,
              receiptNumber,
              referenceNumber: reference || d.referenceNumber,
              processedBy: adminUserId,
              updatedAt: now,
            })
            .where(and(eq(disbursement.id, disbursementId), ne(disbursement.status, 'credited')))
            .returning({ id: disbursement.id })
          if (!acquired.length) throw new Error('Desembolso ya acreditado')
          await activateLoanAfterDisbursement(tx, {
            loanId: loanRow.id,
            userId: d.userId,
            principal: Number(loanRow.principal),
            term: loanRow.term,
            monthlyRate: Number(loanRow.monthlyRate),
            now,
          })
        })
        await recordAudit({
          actorUserId: adminUserId,
          action: 'DISBURSEMENT_CREDITED',
          entityType: 'disbursement',
          entityId: d.id,
          targetUserId: d.userId,
          summary: `Acreditado ${reference || receiptNumber}`,
        })
        return ok()
      }

      case 'failDisbursement': {
        const disbursementId = String(payload.disbursementId || '')
        const reason = String(payload.reason || 'Fallido')
        if (!disbursementId) return fail('Desembolso requerido')
        await db
          .update(disbursement)
          .set({ status: 'failed', failureReason: reason, processedBy: adminUserId, updatedAt: new Date() })
          .where(eq(disbursement.id, disbursementId))
        await recordAudit({
          actorUserId: adminUserId,
          action: 'DISBURSEMENT_FAILED',
          entityType: 'disbursement',
          entityId: disbursementId,
          summary: reason,
        })
        return ok()
      }

      case 'retryDisbursement': {
        const disbursementId = String(payload.disbursementId || '')
        if (!disbursementId) return fail('Desembolso requerido')
        const [d] = await db.select().from(disbursement).where(eq(disbursement.id, disbursementId)).limit(1)
        if (!d || d.status !== 'failed') return fail('Solo se reencolan fallidos')
        await db
          .update(disbursement)
          .set({ status: 'pending', failureReason: null, referenceNumber: null, updatedAt: new Date() })
          .where(eq(disbursement.id, disbursementId))
        await recordAudit({
          actorUserId: adminUserId,
          action: 'DISBURSEMENT_RETRY',
          entityType: 'disbursement',
          entityId: disbursementId,
          summary: 'Reencolado',
        })
        return ok()
      }

      case 'registerPayment': {
        const creditId = String(payload.creditId || '')
        const amount = Number(payload.amount)
        const channel = String(payload.channel || 'mercadopago')
        const notes = String(payload.notes || '')
        if (!creditId || !(amount > 0)) return fail('Crédito e importe requeridos')
        const [loanRow] = await db.select().from(loan).where(eq(loan.id, creditId)).limit(1)
        if (!loanRow || loanRow.status !== 'active') return fail('Crédito no vigente')
        const pendingInsts = await db
          .select()
          .from(installment)
          .where(eq(installment.loanId, creditId))
          .orderBy(installment.number)
        const next = pendingInsts.find((i) => i.status === 'pending' || i.status === 'overdue')
        if (!next) return fail('No hay cuotas pendientes')
        const isTransfer = channel === 'transferencia'
        const instAmount = Number(next.amount)
        if (!isTransfer && amount < instAmount - 0.01) {
          return fail(
            `Monto insuficiente: $${amount.toFixed(2)} es menor a la cuota $${instAmount.toFixed(2)}`,
          )
        }

        const paymentId = newId('pay')
        const method = isTransfer ? 'transferencia_rm' : 'mercado_pago'
        await db.insert(payment).values({
          id: paymentId,
          userId: loanRow.userId,
          loanId: creditId,
          installmentId: next.id,
          amount: amount.toFixed(2),
          currency: 'ARS',
          status: isTransfer ? 'pending_review' : 'pending',
          method,
          source: 'admin',
          notes: notes || (isTransfer ? 'Transferencia a conciliar' : 'Cobro mesa'),
          processedBy: adminUserId,
          createdAt: new Date(),
          updatedAt: new Date(),
          gatewayResponse: { installment_ids: [next.id] },
        })
        if (!isTransfer) {
          await deskApplyToInstallment(paymentId, next.id, amount, adminUserId)
        }
        await recordAudit({
          actorUserId: adminUserId,
          action: 'COLLECTION_REGISTERED',
          entityType: 'payment',
          entityId: paymentId,
          targetUserId: loanRow.userId,
          summary: `Cobro ${channel} ${amount}`,
        })
        return ok(paymentId)
      }

      case 'matchTransfer': {
        const paymentId = String(payload.paymentId || '')
        if (!paymentId) return fail('Pago requerido')
        const [row] = await db.select().from(payment).where(eq(payment.id, paymentId)).limit(1)
        if (!row) return fail('Pago no encontrado')
        if (row.status !== 'pending_review' && row.status !== 'pending') {
          return fail('El pago no está pendiente de conciliación')
        }
        const meta = (row.gatewayResponse ?? {}) as { installment_ids?: string[] }
        let ids = meta.installment_ids?.length
          ? meta.installment_ids
          : row.installmentId
            ? [row.installmentId]
            : []
        if (!ids.length) {
          if (!row.loanId) return fail('Pago sin cuota asociada')
          const insts = await db.select().from(installment).where(eq(installment.loanId, row.loanId))
          const next = insts.find((i) => i.status === 'pending' || i.status === 'overdue')
          if (!next) return fail('Sin cuotas pendientes')
          ids = [next.id]
        }
        for (const iid of ids) {
          const [inst] = await db.select().from(installment).where(eq(installment.id, iid)).limit(1)
          if (inst && inst.status !== 'paid') {
            const payAmt = Number(row.amount)
            const due = Number(inst.amount)
            if (payAmt < due - 0.01) {
              return fail(
                `Monto insuficiente: $${payAmt.toFixed(2)} es menor a la cuota $${due.toFixed(2)}`,
              )
            }
            await deskApplyToInstallment(row.id, inst.id, Math.max(payAmt, due), adminUserId)
          }
        }
        await recordAudit({
          actorUserId: adminUserId,
          action: 'TRANSFER_APPROVED',
          entityType: 'payment',
          entityId: paymentId,
          targetUserId: row.userId,
          summary: 'Transferencia conciliada',
        })
        return ok()
      }

      case 'rejectTransfer': {
        const paymentId = String(payload.paymentId || '')
        const reason = String(payload.reason || 'Rechazado')
        if (!paymentId) return fail('Pago requerido')
        await db
          .update(payment)
          .set({
            status: 'failed',
            failureReason: reason,
            processedBy: adminUserId,
            updatedAt: new Date(),
          })
          .where(eq(payment.id, paymentId))
        await recordAudit({
          actorUserId: adminUserId,
          action: 'TRANSFER_REJECTED',
          entityType: 'payment',
          entityId: paymentId,
          summary: reason,
        })
        return ok()
      }

      case 'logCollectionContact': {
        const caseId = String(payload.caseId || '')
        const note = String(payload.note || '')
        const channel = String(payload.channel || 'otro')
        const nextAction = String(payload.nextAction || note)
        if (!caseId || !note) return fail('Caso y nota requeridos')
        const creditId = caseId.startsWith('col-') ? caseId.slice(4) : caseId
        await recordAudit({
          actorUserId: adminUserId,
          action: 'COLLECTION_CONTACT',
          entityType: 'loan',
          entityId: creditId,
          summary: `${channel}: ${note}`,
          changes: { channel, note, nextAction },
        })
        return ok()
      }

      case 'resolveTicket': {
        const id = String(payload.id || '')
        if (!id) return fail('Ticket requerido')
        await db
          .update(supportCase)
          .set({
            status: 'resolved',
            assignedAdminId: adminUserId,
            response: 'Resuelto desde mesa admin',
            respondedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(supportCase.id, id))
        await recordAudit({
          actorUserId: adminUserId,
          action: 'SUPPORT_RESOLVED',
          entityType: 'support_case',
          entityId: id,
          summary: 'Ticket resuelto',
        })
        return ok()
      }

      case 'pauseMerchant': {
        const id = String(payload.id || '')
        if (!id) return fail('Comercio requerido')
        await db.update(merchant).set({ status: 'paused', updatedAt: new Date() }).where(eq(merchant.id, id))
        await recordAudit({
          actorUserId: adminUserId,
          action: 'MERCHANT_PAUSED',
          entityType: 'merchant',
          entityId: id,
          summary: 'Comercio pausado',
        })
        return ok()
      }

      case 'activateMerchant': {
        const id = String(payload.id || '')
        if (!id) return fail('Comercio requerido')
        await db.update(merchant).set({ status: 'active', updatedAt: new Date() }).where(eq(merchant.id, id))
        await recordAudit({
          actorUserId: adminUserId,
          action: 'MERCHANT_ACTIVATED',
          entityType: 'merchant',
          entityId: id,
          summary: 'Comercio activado',
        })
        return ok()
      }

      case 'createApplication': {
        const clientId = String(payload.clientId || '')
        const productId = String(payload.productId || '')
        const amount = Number(payload.amount)
        const installmentsCount = Number(payload.installments)
        const purpose = String(payload.purpose || 'Crédito personal')
        const merchantId = payload.merchantId ? String(payload.merchantId) : null
        if (!clientId || !productId || !(amount > 0) || !(installmentsCount > 0)) {
          return fail('Datos incompletos')
        }
        const [prod] = await db.select().from(loanProduct).where(eq(loanProduct.id, productId)).limit(1)
        if (!prod || !prod.active) return fail('Producto inválido')
        if (amount < Number(prod.minAmount) || amount > Number(prod.maxAmount)) {
          return fail('Monto fuera de rango')
        }
        if (installmentsCount < prod.minTerm || installmentsCount > prod.maxTerm) {
          return fail('Plazo fuera de rango')
        }
        const monthlyRate = Number(prod.monthlyRate)
        const amort = computeFrenchAmortization(amount, installmentsCount, monthlyRate)
        const id = newId('loan')
        const now = new Date()
        await db.insert(loan).values({
          id,
          userId: clientId,
          productId,
          merchantId,
          type: prod.type || 'personal',
          principal: amount.toFixed(2),
          term: installmentsCount,
          monthlyRate: String(monthlyRate),
          tna: String(prod.tna),
          tea: String(amort.tea),
          cft: String(amort.cft),
          installmentAmount: amort.installmentAmount.toFixed(2),
          totalAmount: amort.totalAmount.toFixed(2),
          status: 'pending',
          purpose,
          createdAt: now,
          updatedAt: now,
        })
        await recordAudit({
          actorUserId: adminUserId,
          action: 'LOAN_CREATED_ADMIN',
          entityType: 'loan',
          entityId: id,
          targetUserId: clientId,
          summary: `Alta mesa ${amount} · ${installmentsCount} cuotas`,
        })
        return ok(id)
      }

      default:
        return fail(`Acción no soportada: ${action}`)
    }
  } catch (err) {
    return fail(err instanceof Error ? err.message : 'Error en mutación')
  }
}
