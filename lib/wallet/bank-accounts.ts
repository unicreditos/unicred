import { and, desc, eq, sql } from 'drizzle-orm'
import { validateBankAccountAuto } from '@/lib/argenapi'
import { normalizeCuit } from '@/lib/cuit'
import { db } from '@/lib/db'
import { bankAccount, walletAccount } from '@/lib/db/schema'
import { recordAudit } from '@/lib/audit'
import { newId } from '@/lib/ids'
import { assertIdentityVerified } from '@/lib/wallet/guards'
import { WalletError } from '@/lib/wallet/ledger'
import { bankNameFromCbu } from '@/lib/wallet/banks'
import { parseWalletDestination } from '@/lib/wallet/cvu'

/**
 * Cuentas bancarias PROPIAS para retirar. Solo se aceptan si ArgenAPI confirma que el CUIT/CUIL del titular de la
 * cuenta es el CUIL de la persona: así un retiro nunca puede ir a la cuenta de un tercero.
 */

export async function listOwnBankAccounts(userId: string) {
  return db
    .select()
    .from(bankAccount)
    .where(and(eq(bankAccount.userId, userId), eq(bankAccount.isActive, true)))
    .orderBy(desc(bankAccount.isPrimary), desc(bankAccount.createdAt))
}

/** La validación bancaria externa no respondió (sin crédito, caída, timeout): se puede cargar la cuenta a mano. */
export class LookupUnavailableError extends WalletError {
  constructor() {
    super('No pudimos validar la cuenta con la red bancaria en este momento. Podés cargarla a mano: administración verifica la titularidad antes de enviarte el dinero.')
    this.name = 'LookupUnavailableError'
  }
}

export type ManualAccountDetails = { bankName?: string; holderName?: string }

/**
 * Agrega una cuenta propia. Primero se valida con la red bancaria: si confirma que el titular es la persona, queda
 * verificada. Si el servicio no está disponible, se puede cargar a mano (`manual`): queda sin verificar y
 * administración comprueba la titularidad antes de enviar cualquier retiro. Una cuenta que la red dice que no existe,
 * o que es de otra persona, nunca se acepta.
 */
export async function addOwnBankAccount(userId: string, identifier: string, manual?: ManualAccountDetails) {
  const { cuil } = await assertIdentityVerified(userId)
  const dest = parseWalletDestination(identifier)

  const lookup = await validateBankAccountAuto({
    cbu: dest.kind === 'cbu' ? dest.value : undefined,
    cvu: dest.kind === 'cvu' ? dest.value : undefined,
    alias: dest.kind === 'alias' ? dest.value : undefined,
  })
  const best = lookup.best
  if (best?.status === 'not_found') throw new WalletError('No encontramos esa cuenta. Revisá el CBU, CVU o alias.')
  if (best?.status === 'invalid_format') throw new WalletError('El CBU, CVU o alias no tiene un formato válido.')

  if (!best?.ok || !best.data) {
    if (!manual) throw new LookupUnavailableError()
    return addManualAccount(userId, cuil, dest, manual)
  }
  const data = best.data
  if (data.bloqueada === true || data.activa === false) {
    throw new WalletError('Esa cuenta figura inactiva o bloqueada en la red bancaria.')
  }

  const holderCuit = normalizeCuit(data.cuit || data.cuil || '')
  if (holderCuit.length !== 11) {
    throw new WalletError('No pudimos confirmar quién es el titular de esa cuenta, así que no podemos usarla para retiros.')
  }
  if (holderCuit !== cuil) {
    throw new WalletError('Solo podés retirar a cuentas de las que seas titular. El CUIT del titular no coincide con tu CUIL.')
  }

  const cbu = dest.kind === 'cbu' ? dest.value : data.cbu && data.cbu.length === 22 ? data.cbu : undefined
  const cvu = dest.kind === 'cvu' ? dest.value : data.cvu && data.cvu.length === 22 ? data.cvu : undefined
  const alias = dest.kind === 'alias' ? dest.value : data.alias || undefined
  if (!cbu && !cvu) {
    throw new WalletError('La cuenta no devolvió un CBU/CVU. Ingresá el CBU o CVU de 22 dígitos.')
  }
  // El destino de un retiro es SIEMPRE el CBU/CVU (el alias se puede reasignar a otra cuenta).
  const accountNumber = cbu ?? cvu!

  const existing = await listOwnBankAccounts(userId)
  if (existing.some((a) => (a.cbu ?? a.cvu) === accountNumber)) {
    throw new WalletError('Esa cuenta ya está registrada.')
  }

  const now = new Date()
  const id = newId('bank')
  await db.insert(bankAccount).values({
    id,
    userId,
    accountType: cbu ? 'cbu' : 'cvu',
    bankName: data.entidad || data.banco || 'Entidad bancaria',
    accountNumber,
    cbu: cbu ?? null,
    cvu: cvu ?? null,
    alias: alias ?? null,
    holderName: data.titular || 'Titular',
    holderCuil: holderCuit,
    holderDocumentType: 'CUIL',
    isVerified: true,
    verificationMethod: 'argenapi_cuit_match',
    verifiedBy: 'system',
    verifiedAt: now,
    // Solo una cuenta principal por persona (índice único parcial en la base).
    isPrimary: existing.length === 0,
    isActive: true,
    bankCode: data.codigoEntidad || null,
    scheme: cbu ? 'CBU' : 'CVU',
    currency: 'ARS',
    networkStatus: 'ACTIVA',
    networkBlocked: false,
    verificationData: { source: 'argenapi', checkedAt: now.toISOString() },
    createdAt: now,
    updatedAt: now,
  })
  return { id, bankName: data.entidad || data.banco || 'Entidad bancaria', verified: true }
}

async function addManualAccount(
  userId: string,
  cuil: string,
  dest: ReturnType<typeof parseWalletDestination>,
  manual: ManualAccountDetails,
) {
  const holderName = String(manual.holderName ?? '').trim().slice(0, 120)
  if (holderName.length < 5) throw new WalletError('Ingresá el nombre completo del titular de la cuenta.')
  const cbu = dest.kind === 'cbu' ? dest.value : undefined
  const cvu = dest.kind === 'cvu' ? dest.value : undefined
  const alias = dest.kind === 'alias' ? dest.value : undefined
  const bankName = String(manual.bankName ?? '').trim().slice(0, 80) || bankNameFromCbu(cbu) || ''
  if (bankName.length < 3) throw new WalletError('Indicá el banco o billetera de la cuenta.')

  const identity = cbu ?? cvu ?? alias!
  const existing = await listOwnBankAccounts(userId)
  if (existing.some((a) => (a.cbu ?? a.cvu ?? a.alias) === identity)) {
    throw new WalletError('Esa cuenta ya está registrada.')
  }

  const now = new Date()
  const id = newId('bank')
  await db.insert(bankAccount).values({
    id,
    userId,
    accountType: cbu ? 'cbu' : cvu ? 'cvu' : 'alias',
    bankName,
    accountNumber: identity,
    cbu: cbu ?? null,
    cvu: cvu ?? null,
    alias: alias ?? null,
    holderName,
    // El titular declarado es la propia persona: el CUIL es el suyo, ya verificado.
    holderCuil: cuil,
    holderDocumentType: 'CUIL',
    isVerified: false,
    verificationMethod: 'manual_declared',
    isPrimary: existing.length === 0,
    isActive: true,
    scheme: cbu ? 'CBU' : cvu ? 'CVU' : 'ALIAS',
    currency: 'ARS',
    networkStatus: 'SIN_VERIFICAR',
    networkBlocked: false,
    verificationData: { source: 'manual', reason: 'lookup_unavailable', declaredAt: now.toISOString() },
    createdAt: now,
    updatedAt: now,
  })
  return { id, bankName, verified: false }
}

export async function removeOwnBankAccount(userId: string, accountId: string) {
  const rows = await db
    .update(bankAccount)
    .set({ isActive: false, isPrimary: false, updatedAt: new Date() })
    .where(and(eq(bankAccount.id, accountId), eq(bankAccount.userId, userId)))
    .returning({ id: bankAccount.id })
  if (!rows.length) throw new WalletError('No encontramos esa cuenta.')
}

/** Cuenta propia habilitada para retirar (verificada, activa, titularidad = CUIL de la persona). */
export async function getWithdrawableAccount(userId: string, accountId: string, ownCuil: string) {
  const [row] = await db
    .select()
    .from(bankAccount)
    .where(and(eq(bankAccount.id, accountId), eq(bankAccount.userId, userId), eq(bankAccount.isActive, true)))
    .limit(1)
  if (!row) throw new WalletError('Elegí una de tus cuentas registradas.')
  const manual = row.verificationMethod === 'manual_declared'
  if ((!row.isVerified && !manual) || row.networkBlocked) throw new WalletError('Esa cuenta no está verificada ni habilitada para retirar.')
  if (normalizeCuit(row.holderCuil) !== ownCuil) {
    throw new WalletError('Solo podés retirar a cuentas de las que seas titular.')
  }
  if (!(row.cbu || row.cvu || row.alias)) throw new WalletError('La cuenta no tiene CBU, CVU ni alias.')
  return row
}

export async function walletOf(userId: string) {
  const [w] = await db.select().from(walletAccount).where(eq(walletAccount.userId, userId)).limit(1)
  return w ?? null
}

/* ------------------------------ Administración ------------------------------ */

export async function listBankAccountsForAdmin(userId: string) {
  return db.select().from(bankAccount).where(eq(bankAccount.userId, userId)).orderBy(desc(bankAccount.isActive), desc(bankAccount.createdAt))
}

/**
 * Re-verifica una cuenta contra la red bancaria (ArgenAPI). Si responde y el titular es la propia persona, queda verificada;
 * si responde y es de otra persona, se desactiva; si el servicio no responde, no cambia nada.
 */
export async function adminRecheckBankAccount(adminId: string, accountId: string) {
  const [acc] = await db.select().from(bankAccount).where(eq(bankAccount.id, accountId)).limit(1)
  if (!acc) throw new WalletError('Cuenta no encontrada.')
  const [owner] = await db.execute<{ cuil: string | null }>(sql`select cuil from profile where "userId" = ${acc.userId} limit 1`).then((r) => r.rows)
  const ownerCuil = normalizeCuit(owner?.cuil ?? '')
  const lookup = await validateBankAccountAuto({ cbu: acc.cbu ?? undefined, cvu: acc.cvu ?? undefined, alias: acc.alias ?? undefined })
  const best = lookup.best
  if (!best?.ok || !best.data) {
    if (best?.status === 'not_found') throw new WalletError('La red bancaria no encuentra esa cuenta. Revisá los datos con la persona.')
    throw new WalletError('La validación bancaria no está disponible ahora. Probá más tarde o verificala manualmente.')
  }
  const data = best.data
  const holderCuit = normalizeCuit(data.cuit || data.cuil || '')
  const now = new Date()
  if (holderCuit.length === 11 && ownerCuil.length === 11 && holderCuit !== ownerCuil) {
    await db.update(bankAccount).set({ isActive: false, isPrimary: false, isVerified: false, networkBlocked: true, updatedAt: now }).where(eq(bankAccount.id, accountId))
    await recordAudit({ actorUserId: adminId, action: 'BANK_ACCOUNT_REJECTED', entityType: 'bank_account', entityId: accountId, targetUserId: acc.userId, severity: 'warning', summary: 'La cuenta es de un tercero: se desactivó' })
    return { verified: false, message: 'El titular en la red bancaria no es la persona: la cuenta quedó desactivada.' }
  }
  await db
    .update(bankAccount)
    .set({
      isVerified: holderCuit === ownerCuil,
      verificationMethod: 'argenapi_cuit_match',
      verifiedBy: adminId,
      verifiedAt: now,
      bankName: data.entidad || data.banco || acc.bankName,
      holderName: data.titular || acc.holderName,
      networkStatus: 'ACTIVA',
      verificationData: { source: 'argenapi', checkedAt: now.toISOString(), by: adminId },
      updatedAt: now,
    })
    .where(eq(bankAccount.id, accountId))
  await recordAudit({ actorUserId: adminId, action: 'BANK_ACCOUNT_VERIFIED', entityType: 'bank_account', entityId: accountId, targetUserId: acc.userId, summary: 'Cuenta verificada contra la red bancaria' })
  return { verified: holderCuit === ownerCuil, message: holderCuit === ownerCuil ? 'Titular confirmado: la cuenta quedó verificada.' : 'La red no informó el titular: sigue pendiente.' }
}

/** Verificación manual: administración comprobó la titularidad por otro medio (extracto, comprobante, llamado). */
export async function adminMarkBankAccount(adminId: string, accountId: string, verified: boolean, note: string) {
  const text = String(note ?? '').trim()
  if (text.length < 10) throw new WalletError('Contá cómo lo comprobaste (mínimo 10 caracteres): queda en la auditoría.')
  const [acc] = await db.select().from(bankAccount).where(eq(bankAccount.id, accountId)).limit(1)
  if (!acc) throw new WalletError('Cuenta no encontrada.')
  const now = new Date()
  await db
    .update(bankAccount)
    .set({
      isVerified: verified,
      isActive: verified ? acc.isActive : false,
      isPrimary: verified ? acc.isPrimary : false,
      verificationMethod: 'manual_admin',
      verifiedBy: adminId,
      verifiedAt: now,
      verificationData: { ...((acc.verificationData as Record<string, unknown> | null) ?? {}), manualNote: text, manualBy: adminId, manualAt: now.toISOString() },
      updatedAt: now,
    })
    .where(eq(bankAccount.id, accountId))
  await recordAudit({
    actorUserId: adminId, action: verified ? 'BANK_ACCOUNT_VERIFIED_MANUAL' : 'BANK_ACCOUNT_REJECTED', entityType: 'bank_account', entityId: accountId,
    targetUserId: acc.userId, severity: 'warning', summary: verified ? `Cuenta verificada manualmente: ${text}` : `Cuenta rechazada: ${text}`,
  })
}
