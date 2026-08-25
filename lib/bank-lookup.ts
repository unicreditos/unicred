import { db } from '@/lib/db'
import { bankAccount, bankDirectory } from '@/lib/db/schema'
import type { ArgenAPIResult } from '@/lib/argenapi'
import { normalizeBankAlias } from '@/lib/finance'
import { and, eq } from 'drizzle-orm'

export type ExtractedBankProfile = {
  cbu?: string
  cvu?: string
  alias?: string
  entidad?: string
  banco?: string
  codigoEntidad?: string
  sucursal?: string
  tipoCuenta?: string
  numeroCuenta?: string
  titular?: string
  titularNombre?: string
  titularApellido?: string
  tipoDocumento?: string
  numeroDocumento?: string
  cuit?: string
  cuil?: string
  fechaNacimiento?: string
  provincia?: string
  localidad?: string
  domicilio?: string
  codigoPostal?: string
  estado?: string
  activa?: boolean
  bloqueada?: boolean
  fechaAlta?: string
  moneda?: string
  scheme?: string
  holders?: unknown
  bank?: unknown
  account?: unknown
  raw?: unknown
}

function pick(v: string | null | undefined) {
  const s = (v ?? '').trim()
  return s ? s : undefined
}

export function toExtractedProfile(best: ArgenAPIResult | null | undefined): ExtractedBankProfile | null {
  if (!best?.data) return null
  const d = best.data
  const raw = best.raw as any
  const payload = raw?.data ?? raw ?? {}
  return {
    ...d,
    scheme: d.cbu ? 'CBU' : d.cvu ? 'CVU' : undefined,
    holders: payload.holders ?? null,
    bank: payload.bank ?? null,
    account: payload.account ?? null,
    raw: payload,
  }
}

export function extractedPatch(existing: typeof bankAccount.$inferSelect, extracted: ExtractedBankProfile) {
  const titular = pick(extracted.titular) || pick(extracted.titularNombre)
  const taxId = (pick(extracted.cuil) || pick(extracted.cuit) || '').replace(/\D/g, '').slice(0, 11)
  const alias = extracted.alias ? normalizeBankAlias(extracted.alias) : undefined
  const bankName = pick(extracted.entidad) || pick(extracted.banco)
  const cbu = pick(extracted.cbu)?.replace(/\D/g, '').slice(0, 22)
  const cvu = pick(extracted.cvu)?.replace(/\D/g, '').slice(0, 22)
  const scheme = extracted.scheme || (cvu && !cbu ? 'CVU' : cbu ? 'CBU' : existing.scheme)
  const accountType =
    alias && !cbu && !cvu
      ? 'alias'
      : scheme === 'CVU'
        ? 'cvu'
        : cbu
          ? 'cbu'
          : existing.accountType

  return {
    bankName: bankName || existing.bankName,
    holderName: titular || existing.holderName,
    holderCuil: taxId || existing.holderCuil,
    holderDocumentType: pick(extracted.tipoDocumento) || existing.holderDocumentType,
    holderDocumentNumber: pick(extracted.numeroDocumento) || existing.holderDocumentNumber,
    accountNumber: pick(extracted.numeroCuenta) || existing.accountNumber,
    cbu: cbu || existing.cbu,
    cvu: cvu || existing.cvu,
    alias: alias || existing.alias,
    accountType,
    bankCode: pick(extracted.codigoEntidad) || existing.bankCode,
    branch: pick(extracted.sucursal) || existing.branch,
    scheme: scheme || existing.scheme,
    currency: pick(extracted.moneda) || existing.currency || 'ARS',
    networkStatus: pick(extracted.estado) || (extracted.activa === false ? 'INACTIVA' : extracted.activa ? 'ACTIVA' : existing.networkStatus),
    networkBlocked: extracted.bloqueada === true,
    extractedProfile: extracted as any,
    extractedAt: new Date(),
  }
}

async function upsertDirectory(extracted: ExtractedBankProfile, source: string) {
  const now = new Date()
  const keys: { identifierType: string; identifier: string }[] = []
  const cbu = pick(extracted.cbu)?.replace(/\D/g, '')
  const cvu = pick(extracted.cvu)?.replace(/\D/g, '')
  const alias = extracted.alias ? normalizeBankAlias(extracted.alias) : ''
  if (cbu && cbu.length === 22) keys.push({ identifierType: 'cbu', identifier: cbu })
  if (cvu && cvu.length === 22 && cvu !== cbu) keys.push({ identifierType: 'cvu', identifier: cvu })
  if (alias) keys.push({ identifierType: 'alias', identifier: alias })

  for (const key of keys) {
    const [row] = await db
      .select({ id: bankDirectory.id })
      .from(bankDirectory)
      .where(and(eq(bankDirectory.identifierType, key.identifierType), eq(bankDirectory.identifier, key.identifier)))
      .limit(1)
    const values = {
      identifier: key.identifier,
      identifierType: key.identifierType,
      cbu: cbu || null,
      cvu: cvu || null,
      alias: alias || null,
      bankName: pick(extracted.entidad) || pick(extracted.banco) || null,
      bankCode: pick(extracted.codigoEntidad) || null,
      entityName: pick(extracted.entidad) || pick(extracted.banco) || null,
      branch: pick(extracted.sucursal) || null,
      holderName: pick(extracted.titular) || null,
      taxId: (pick(extracted.cuil) || pick(extracted.cuit) || '').replace(/\D/g, '').slice(0, 11) || null,
      taxIdType: pick(extracted.tipoDocumento) || 'CUIT',
      accountNumber: pick(extracted.numeroCuenta) || null,
      accountType: pick(extracted.tipoCuenta) || null,
      scheme: extracted.scheme || (cvu && !cbu ? 'CVU' : cbu ? 'CBU' : null),
      currency: pick(extracted.moneda) || 'ARS',
      active: extracted.activa ?? null,
      blocked: extracted.bloqueada === true,
      rawPayload: extracted as any,
      source,
      lookedUpAt: now,
      updatedAt: now,
    }
    if (row) {
      await db.update(bankDirectory).set(values).where(eq(bankDirectory.id, row.id))
    } else {
      await db.insert(bankDirectory).values({ id: crypto.randomUUID(), createdAt: now, ...values })
    }
  }
}

export async function persistBankLookup(opts: {
  bankAccountId?: string
  lookup: { best: ArgenAPIResult | null; cbu?: ArgenAPIResult; cvu?: ArgenAPIResult; alias?: ArgenAPIResult }
  actorUserId: string
  source?: string
}) {
  const best = opts.lookup.best
  const extracted = toExtractedProfile(best)
  const ok = !!(
    best?.ok &&
    best.data &&
    (best.data.titular || best.data.numeroCuenta || best.data.cbu || best.data.cvu) &&
    best.data.bloqueada !== true
  )

  if (extracted) {
    await upsertDirectory(extracted, opts.source || 'unicred_lookup')
  }

  if (!opts.bankAccountId) {
    return { ok, extracted, matchedData: best?.data ?? null }
  }

  const [acc] = await db.select().from(bankAccount).where(eq(bankAccount.id, opts.bankAccountId)).limit(1)
  if (!acc) return { ok: false, extracted, matchedData: null }

  const prev =
    acc.verificationData && typeof acc.verificationData === 'object' ? (acc.verificationData as any) : {}

  const verificationData = {
    ...prev,
    lastMethod: 'unicred_lookup',
    lastStatus: best?.status ?? 'api_error',
    lastMessage: best?.message ?? null,
    lastVerifiedAt: new Date().toISOString(),
    verifiedBy: opts.actorUserId,
    verifications: {
      cbu: opts.lookup.cbu ?? null,
      cvu: opts.lookup.cvu ?? null,
      alias: opts.lookup.alias ?? null,
    },
    best: best ?? null,
    extracted,
    attempts: [
      ...(Array.isArray(prev.attempts) ? prev.attempts : []).slice(-9),
      {
        at: new Date().toISOString(),
        method: 'unicred_lookup',
        status: best?.status,
        ok,
        message: best?.message ?? null,
      },
    ],
  }

  const patch = extracted ? extractedPatch(acc, extracted) : {}

  await db
    .update(bankAccount)
    .set({
      ...patch,
      isVerified: ok,
      verificationMethod: 'unicred_lookup',
      verificationData: verificationData as any,
      verificationAttempts: (acc.verificationAttempts ?? 0) + 1,
      verificationCodeSentAt: new Date(),
      verifiedAt: new Date(),
      verifiedBy: opts.actorUserId,
      updatedAt: new Date(),
    })
    .where(eq(bankAccount.id, acc.id))

  return { ok, extracted, matchedData: best?.data ?? null, message: best?.message }
}
