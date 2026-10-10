/**
 * Huella SHA-256 del contenido congelado del contrato y del registro de firma.
 * Modulo puro (sin base de datos).
 */
import { createHash } from 'node:crypto'

export type ContractSnapshotInput = {
  contractId: string
  loanId: string
  userId: string
  version: string
  templateName: string
  loan: {
    type: string
    principal: string | number
    term: number
    monthlyRate: string | number
    tna: string | number
    tea?: string | number | null
    cft?: string | number | null
    installmentAmount: string | number
    totalAmount: string | number
  }
  signer: { name: string | null; cuil: string | null }
}

/** JSON con claves ordenadas: mismo contenido, mismo hash, sin depender del orden de las propiedades. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value ?? null)
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  const obj = value as Record<string, unknown>
  return `{${Object.keys(obj)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`)
    .join(',')}}`
}

export function sha256Hex(input: string | Buffer): string {
  return createHash('sha256').update(input).digest('hex')
}

const num = (v: string | number | null | undefined) => (v === null || v === undefined ? null : Number(v))

export function contractContentHash(s: ContractSnapshotInput): string {
  return sha256Hex(
    canonicalJson({
      contractId: s.contractId,
      loanId: s.loanId,
      userId: s.userId,
      version: s.version,
      templateName: s.templateName,
      loan: {
        type: s.loan.type,
        principal: num(s.loan.principal),
        term: s.loan.term,
        monthlyRate: num(s.loan.monthlyRate),
        tna: num(s.loan.tna),
        tea: num(s.loan.tea),
        cft: num(s.loan.cft),
        installmentAmount: num(s.loan.installmentAmount),
        totalAmount: num(s.loan.totalAmount),
      },
      signer: { name: s.signer.name, cuil: s.signer.cuil },
    }),
  )
}

/** Ata la huella del contenido al registro de firma (fecha, IP, agente de usuario y CUIL). */
export function signatureRecordHash(input: {
  contentHash: string
  acceptedAt: Date
  ip: string | null | undefined
  userAgent: string | null | undefined
  cuil: string | null | undefined
  userId: string
  signatureType: string
}): string {
  return sha256Hex(
    canonicalJson({
      contentHash: input.contentHash,
      acceptedAt: input.acceptedAt.toISOString(),
      ip: input.ip ?? null,
      userAgent: input.userAgent ?? null,
      cuil: input.cuil ?? null,
      userId: input.userId,
      signatureType: input.signatureType,
    }),
  )
}