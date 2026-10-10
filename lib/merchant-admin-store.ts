/** Acceso a datos del panel de comercios con ejecutor SQL inyectado (la app pasa su db; las pruebas, una base de prueba). */
import { createHash, randomUUID } from 'node:crypto'
import { sql } from 'drizzle-orm'
import type { SqlExecutor } from '@/lib/otp-pg-store'
import { MERCHANT_FLAGS, type MerchantFlag } from '@/lib/merchant-admin-core'

type Row = Record<string, unknown>
const iso = (v: unknown) => (v ? new Date(v as string).toISOString() : null)

export type DocMeta = { id: string; type: string; status: string; fileName: string; mime: string; size: number; sha256: string; createdAt: string; reviewNote: string | null; reviewedBy: string | null; reviewedAt: string | null }
export type DocVersionMeta = { version: number; fileName: string; sha256: string; uploadedAt: string; archivedAt: string; status: string }

/** Documentos vigentes (sin el contenido). */
export async function listMerchantDocsWith(db: SqlExecutor, merchantId: string): Promise<DocMeta[]> {
  const res = await db.execute(sql`SELECT id, type, status, "fileName", mime, size, sha256, "createdAt", "reviewNote", "reviewedBy", "reviewedAt"
    FROM merchant_document WHERE "merchantId" = ${merchantId} ORDER BY type`)
  return (res.rows as Row[]).map((r) => ({
    id: String(r.id), type: String(r.type), status: String(r.status), fileName: String(r.fileName), mime: String(r.mime),
    size: Number(r.size), sha256: String(r.sha256).trim(), createdAt: iso(r.createdAt)!, reviewNote: (r.reviewNote as string) ?? null,
    reviewedBy: (r.reviewedBy as string) ?? null, reviewedAt: iso(r.reviewedAt),
  }))
}

export async function listDocVersionsWith(db: SqlExecutor, merchantId: string, type: string): Promise<DocVersionMeta[]> {
  const res = await db.execute(sql`SELECT version, "fileName", sha256, "uploadedAt", "archivedAt", status FROM merchant_document_version
    WHERE "merchantId" = ${merchantId} AND type = ${type} ORDER BY version DESC`)
  return (res.rows as Row[]).map((r) => ({ version: Number(r.version), fileName: String(r.fileName), sha256: String(r.sha256).trim(), uploadedAt: iso(r.uploadedAt)!, archivedAt: iso(r.archivedAt)!, status: String(r.status) }))
}

/**
 * Archiva la versión vigente antes de reemplazarla (el comercio vuelve a subir el mismo tipo).
 * Devuelve el número de versión que tendrá el documento nuevo.
 */
export async function archiveCurrentDocWith(db: SqlExecutor, merchantId: string, type: string): Promise<number> {
  const cur = await db.execute(sql`SELECT * FROM merchant_document WHERE "merchantId" = ${merchantId} AND type = ${type} LIMIT 1`)
  const r = cur.rows[0] as Row | undefined
  const last = await db.execute(sql`SELECT COALESCE(MAX(version), 0) AS v FROM merchant_document_version WHERE "merchantId" = ${merchantId} AND type = ${type}`)
  const lastV = Number((last.rows[0] as Row).v)
  if (!r) return lastV + 1
  await db.execute(sql`INSERT INTO merchant_document_version (id, "documentId", "merchantId", type, version, "fileName", mime, size, sha256, content, status, "reviewNote", "uploadedAt")
    VALUES (${`mdv_${randomUUID()}`}, ${r.id as string}, ${merchantId}, ${type}, ${lastV + 1}, ${r.fileName as string}, ${r.mime as string}, ${Number(r.size)}, ${String(r.sha256).trim()}, ${r.content as string}, ${r.status as string}, ${(r.reviewNote as string) ?? null}, ${new Date(r.createdAt as string).toISOString()})`)
  return lastV + 2
}

/** Revisión humana de un documento: aprobar u observar (con nota). */
export async function reviewDocWith(db: SqlExecutor, input: { documentId: string; merchantId: string; decision: 'approved' | 'observed'; note: string; actor: string }) {
  if (input.decision === 'observed' && input.note.trim().length < 5) return { ok: false as const, error: 'Indicá qué hay que corregir (mínimo 5 caracteres).' }
  const res = await db.execute(sql`UPDATE merchant_document SET status = ${input.decision}, "reviewNote" = ${input.note.trim() || null}, "reviewedBy" = ${input.actor}, "reviewedAt" = now(), "updatedAt" = now()
    WHERE id = ${input.documentId} AND "merchantId" = ${input.merchantId} RETURNING id, type`)
  const r = res.rows[0] as Row | undefined
  return r ? { ok: true as const, type: String(r.type) } : { ok: false as const, error: 'Documento no encontrado.' }
}

/** Lee el archivo y VERIFICA el hash antes de entregarlo; deja registro en la bitácora de accesos. */
export async function readMerchantDocVerifiedWith(db: SqlExecutor, input: { documentId: string; actor: string; ip?: string | null; userAgent?: string | null }) {
  const res = await db.execute(sql`SELECT * FROM merchant_document WHERE id = ${input.documentId} LIMIT 1`)
  const r = res.rows[0] as Row | undefined
  const log = (outcome: string, merchantId: string | null) =>
    db.execute(sql`INSERT INTO merchant_document_access_log (id, "documentId", "merchantId", "actorUserId", outcome, ip, "userAgent")
      VALUES (${`mdl_${randomUUID()}`}, ${input.documentId}, ${merchantId}, ${input.actor}, ${outcome}, ${input.ip ?? null}, ${(input.userAgent ?? '').slice(0, 300) || null})`)
  if (!r) { await log('not_found', null); return { ok: false as const, reason: 'not_found' as const } }
  const bytes = Buffer.from(String(r.content), 'base64')
  const actual = createHash('sha256').update(bytes).digest('hex')
  if (actual !== String(r.sha256).trim()) { await log('hash_mismatch', String(r.merchantId)); return { ok: false as const, reason: 'hash_mismatch' as const } }
  await log('served', String(r.merchantId))
  return { ok: true as const, bytes, mime: String(r.mime), fileName: String(r.fileName), sha256: actual, merchantId: String(r.merchantId) }
}

export async function listDocAccessWith(db: SqlExecutor, merchantId: string, limit = 30) {
  const res = await db.execute(sql`SELECT l.at, l."documentId", l.outcome, u.email AS "actorEmail", u.name AS "actorName"
    FROM merchant_document_access_log l LEFT JOIN "user" u ON u.id = l."actorUserId" WHERE l."merchantId" = ${merchantId} ORDER BY l.at DESC LIMIT ${limit}`)
  return (res.rows as Row[]).map((r) => ({ at: iso(r.at)!, documentId: (r.documentId as string) ?? null, outcome: String(r.outcome), actor: String(r.actorName || r.actorEmail || '—') }))
}

/* ---------------------------------------------------------------- permisos */
export type MerchantPerms = Record<MerchantFlag, boolean> & { updatedAt: string | null; updatedBy: string | null }

export async function getPermissionsWith(db: SqlExecutor, merchantId: string): Promise<MerchantPerms> {
  const res = await db.execute(sql`SELECT * FROM merchant_permission WHERE "merchantId" = ${merchantId} LIMIT 1`)
  const r = res.rows[0] as Row | undefined
  return { pos: Boolean(r?.posEnabled), qr: Boolean(r?.qrEnabled), virtualAccount: Boolean(r?.virtualAccountEnabled), updatedAt: iso(r?.updatedAt), updatedBy: (r?.updatedBy as string) ?? null }
}

/** Cambia una bandera. Devuelve antes/después para la auditoría. Solo bandera interna. */
export async function setPermissionWith(db: SqlExecutor, input: { merchantId: string; flag: MerchantFlag; value: boolean; actor: string }) {
  const before = await getPermissionsWith(db, input.merchantId)
  const col = MERCHANT_FLAGS[input.flag].column
  await db.execute(sql`INSERT INTO merchant_permission ("merchantId", "updatedBy") VALUES (${input.merchantId}, ${input.actor}) ON CONFLICT ("merchantId") DO NOTHING`)
  await db.execute(sql`UPDATE merchant_permission SET ${sql.raw(`"${col}"`)} = ${input.value}, "updatedBy" = ${input.actor}, "updatedAt" = now() WHERE "merchantId" = ${input.merchantId}`)
  return { before: before[input.flag], after: input.value }
}

/* ---------------------------------------------------------------- mensajes */
export type MessageRow = { id: string; merchantId: string; authorUserId: string; authorRole: 'admin' | 'merchant'; authorName: string; kind: 'request' | 'reply' | 'note'; body: string; requestedDocType: string | null; documentId: string | null; replyToId: string | null; createdAt: string; readAt: string | null }

export async function addMessageWith(db: SqlExecutor, input: { merchantId: string; authorUserId: string; authorRole: 'admin' | 'merchant'; kind: 'request' | 'reply' | 'note'; body: string; requestedDocType?: string | null; documentId?: string | null; replyToId?: string | null }) {
  const id = `mmsg_${randomUUID()}`
  await db.execute(sql`INSERT INTO merchant_message (id, "merchantId", "authorUserId", "authorRole", kind, body, "requestedDocType", "documentId", "replyToId")
    VALUES (${id}, ${input.merchantId}, ${input.authorUserId}, ${input.authorRole}, ${input.kind}, ${input.body}, ${input.requestedDocType ?? null}, ${input.documentId ?? null}, ${input.replyToId ?? null})`)
  return id
}

export async function listMessagesWith(db: SqlExecutor, merchantId: string, opts: { includeNotes?: boolean; limit?: number } = {}): Promise<MessageRow[]> {
  const includeNotes = opts.includeNotes ?? true
  const limit = opts.limit ?? 200
  const res = await db.execute(sql`SELECT m.*, COALESCE(u.name, u.email, '—') AS "authorName" FROM merchant_message m LEFT JOIN "user" u ON u.id = m."authorUserId"
    WHERE m."merchantId" = ${merchantId} AND (${includeNotes} OR m.kind <> 'note') ORDER BY m."createdAt" ASC, m.id ASC LIMIT ${limit}`)
  return (res.rows as Row[]).map((r) => ({
    id: String(r.id), merchantId: String(r.merchantId), authorUserId: String(r.authorUserId), authorRole: r.authorRole as 'admin' | 'merchant', authorName: String(r.authorName),
    kind: r.kind as MessageRow['kind'], body: String(r.body), requestedDocType: (r.requestedDocType as string) ?? null, documentId: (r.documentId as string) ?? null,
    replyToId: (r.replyToId as string) ?? null, createdAt: iso(r.createdAt)!, readAt: iso(r.readAt),
  }))
}

/** Marca como leídos los mensajes del OTRO lado (el admin lee los del comercio y viceversa). Solo escribe readAt/readBy, una vez. */
export async function markReadWith(db: SqlExecutor, input: { merchantId: string; readerRole: 'admin' | 'merchant'; reader: string }) {
  const other = input.readerRole === 'admin' ? 'merchant' : 'admin'
  const res = await db.execute(sql`UPDATE merchant_message SET "readAt" = now(), "readBy" = ${input.reader}
    WHERE "merchantId" = ${input.merchantId} AND "authorRole" = ${other} AND "readAt" IS NULL RETURNING id`)
  return res.rows.length
}

export async function countUnreadWith(db: SqlExecutor, merchantId: string, readerRole: 'admin' | 'merchant') {
  const other = readerRole === 'admin' ? 'merchant' : 'admin'
  const res = await db.execute(sql`SELECT count(*)::int AS n FROM merchant_message WHERE "merchantId" = ${merchantId} AND "authorRole" = ${other} AND "readAt" IS NULL`)
  return Number((res.rows[0] as Row).n)
}

/** Pedidos de documentación todavía sin respuesta (para vincular la respuesta del comercio). */
export async function openRequestForDocWith(db: SqlExecutor, merchantId: string, docType: string): Promise<string | null> {
  const res = await db.execute(sql`SELECT r.id FROM merchant_message r WHERE r."merchantId" = ${merchantId} AND r.kind = 'request' AND r."requestedDocType" = ${docType}
    AND NOT EXISTS (SELECT 1 FROM merchant_message a WHERE a."replyToId" = r.id AND a."documentId" IS NOT NULL) ORDER BY r."createdAt" DESC LIMIT 1`)
  return (res.rows[0] as Row | undefined)?.id as string | null ?? null
}

/* ---------------------------------------------------------------- estado con 409 */
/** Cambia el estado solo si el comercio no cambió desde que el operador lo vio (updatedAt). */
export async function setStatusIfUnchangedWith(db: SqlExecutor, input: { merchantId: string; status: string; kybStatus?: string; expectedUpdatedAt: string }) {
  const res = await db.execute(sql`UPDATE merchant SET status = ${input.status}, "kybStatus" = COALESCE(${input.kybStatus ?? null}, "kybStatus"), "updatedAt" = now()
    WHERE id = ${input.merchantId} AND date_trunc('milliseconds', "updatedAt") = date_trunc('milliseconds', ${input.expectedUpdatedAt}::timestamptz) RETURNING id`)
  return res.rows.length === 1
}

export async function merchantUnchangedWith(db: SqlExecutor, merchantId: string, expectedUpdatedAt: string) {
  const res = await db.execute(sql`SELECT 1 FROM merchant WHERE id = ${merchantId} AND date_trunc('milliseconds', "updatedAt") = date_trunc('milliseconds', ${expectedUpdatedAt}::timestamptz)`)
  return res.rows.length === 1
}
