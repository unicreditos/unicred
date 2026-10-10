import { sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  ConfigError,
  OPEN_STATUSES,
  approvalBlocker,
  defaultPublicVisible,
  publishBlocker,
  requiresDualControl,
  valueHash,
  type VersionStatus,
} from './core'
import { getDefinition, type ConfigDefinition } from './registry'
import { SITE_CONFIG_DDL } from './sql'

/** Acceso a datos de "Configuración y contenido". Los permisos y el doble control se validan acá, no solo en la UI. */

export type Actor = { userId: string; email: string | null; perms: ReadonlySet<string> }

export type VersionRow = {
  id: string
  itemKey: string
  version: number
  value: unknown
  valueHash: string
  status: VersionStatus
  publicVisible: boolean
  publicApprovalRef: string | null
  reason: string
  basedOnVersion: number | null
  rollbackOfVersion: number | null
  authorId: string
  authorEmail: string | null
  lastEditorId: string | null
  submittedAt: Date | null
  reviewedById: string | null
  reviewedAt: Date | null
  reviewNote: string | null
  approvedById: string | null
  approvedByEmail: string | null
  approvedAt: Date | null
  publishedById: string | null
  publishedByEmail: string | null
  publishedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

type Exec = Pick<typeof db, 'execute'>

function rowsOf<T>(r: unknown): T[] {
  return ((r as { rows?: T[] }).rows ?? (r as T[])) as T[]
}

let ensured = false
export async function ensureSiteConfigSchema() {
  if (ensured) return
  try {
    const r = await db.execute(sql`SELECT to_regclass('public.site_config_version') AS t`)
    if (rowsOf<{ t: string | null }>(r)[0]?.t) {
      ensured = true
      return
    }
  } catch {
    /* sigue el alta */
  }
  for (const stmt of SITE_CONFIG_DDL) await db.execute(sql.raw(stmt))
  ensured = true
}

/** Solo para pruebas: fuerza que se vuelva a verificar el esquema. */
export function _resetEnsuredForTests() {
  ensured = false
}

function def(key: string): ConfigDefinition {
  const d = getDefinition(key)
  if (!d) throw new ConfigError('Clave de configuración desconocida.', 'not_found')
  return d
}

function need(actor: Actor, perm: string, what: string) {
  if (!actor.perms.has(perm)) throw new ConfigError(`Necesitás el permiso "${perm}" para ${what}.`, 'forbidden')
}

function parseValue(d: ConfigDefinition, value: unknown): unknown {
  const parsed = d.schema.safeParse(value)
  if (parsed.success) return parsed.data
  const fieldErrors: Record<string, string> = {}
  for (const issue of parsed.error.issues) {
    const path = issue.path.map((p) => (typeof p === 'number' ? `[${p + 1}]` : String(p))).join('.').replace(/\.\[/g, '[')
    if (!(path in fieldErrors)) fieldErrors[path || '_'] = issue.message
  }
  const first = Object.entries(fieldErrors)[0]
  throw new ConfigError(`Revisá el formulario: ${first ? `${first[0] === '_' ? '' : `${first[0]}: `}${first[1]}` : 'valor inválido'}`, 'invalid', fieldErrors)
}

function cleanReason(reason: string | undefined, min = 5) {
  const r = (reason ?? '').trim()
  if (r.length < min) throw new ConfigError(`Escribí el motivo del cambio (mínimo ${min} caracteres).`, 'invalid')
  return r.slice(0, 500)
}

async function lockItem(tx: Exec, d: ConfigDefinition) {
  await tx.execute(sql`
    INSERT INTO site_config_item (key, kind, sensitivity, label)
    VALUES (${d.key}, ${d.kind}, ${d.sensitivity}, ${d.label})
    ON CONFLICT (key) DO UPDATE SET label = EXCLUDED.label, sensitivity = EXCLUDED.sensitivity, kind = EXCLUDED.kind`)
  const r = await tx.execute(sql`SELECT key, "publishedVersion" FROM site_config_item WHERE key = ${d.key} FOR UPDATE`)
  return rowsOf<{ key: string; publishedVersion: number | null }>(r)[0]
}

async function openVersion(tx: Exec, key: string): Promise<VersionRow | null> {
  const r = await tx.execute(
    sql`SELECT * FROM site_config_version WHERE "itemKey" = ${key} AND status IN ('draft','in_review','approved') LIMIT 1`,
  )
  return rowsOf<VersionRow>(r)[0] ?? null
}

async function versionById(tx: Exec, key: string, version: number): Promise<VersionRow | null> {
  const r = await tx.execute(sql`SELECT * FROM site_config_version WHERE "itemKey" = ${key} AND version = ${version} LIMIT 1`)
  return rowsOf<VersionRow>(r)[0] ?? null
}

/* ------------------------------ Lecturas ------------------------------ */

export type ItemState = {
  key: string
  publishedVersion: number | null
  publishedAt: Date | null
  publicVisible: boolean
  openStatus: VersionStatus | null
  openVersion: number | null
}

export async function listItemStates(): Promise<Map<string, ItemState>> {
  await ensureSiteConfigSchema()
  const r = await db.execute(sql`
    SELECT i.key, i."publishedVersion",
           p."publishedAt" AS "publishedAt", COALESCE(p."publicVisible", false) AS "publicVisible",
           o.status AS "openStatus", o.version AS "openVersion"
    FROM site_config_item i
    LEFT JOIN site_config_version p ON p."itemKey" = i.key AND p.version = i."publishedVersion"
    LEFT JOIN site_config_version o ON o."itemKey" = i.key AND o.status IN ('draft','in_review','approved')`)
  return new Map(rowsOf<ItemState>(r).map((x) => [x.key, x]))
}

export type ItemDetail = {
  published: VersionRow | null
  open: VersionRow | null
  versions: VersionRow[]
}

export async function getItemDetail(key: string): Promise<ItemDetail> {
  def(key)
  await ensureSiteConfigSchema()
  const r = await db.execute(sql`SELECT * FROM site_config_version WHERE "itemKey" = ${key} ORDER BY version DESC`)
  const versions = rowsOf<VersionRow>(r)
  return {
    published: versions.find((v) => v.status === 'published') ?? null,
    open: versions.find((v) => (OPEN_STATUSES as readonly string[]).includes(v.status)) ?? null,
    versions,
  }
}

export async function listHistory(limit = 100): Promise<VersionRow[]> {
  await ensureSiteConfigSchema()
  const r = await db.execute(sql`SELECT * FROM site_config_version ORDER BY "updatedAt" DESC LIMIT ${limit}`)
  return rowsOf<VersionRow>(r)
}

/** Versión publicada de una clave (la usa la capa de lectura pública). Lanza si la base falla. */
export async function readPublished(key: string): Promise<{ version: number; value: unknown; publicVisible: boolean; publishedAt: Date | null } | null> {
  const r = await db.execute(sql`
    SELECT v.version, v.value, v."publicVisible", v."publishedAt"
    FROM site_config_item i JOIN site_config_version v ON v."itemKey" = i.key AND v.version = i."publishedVersion"
    WHERE i.key = ${key} AND v.status = 'published'`)
  return rowsOf<{ version: number; value: unknown; publicVisible: boolean; publishedAt: Date | null }>(r)[0] ?? null
}

/* ------------------------------ Escritura ------------------------------ */

type DraftOpts = { publicVisible?: boolean; basedOnVersion?: number | null; rollbackOfVersion?: number | null }

async function insertDraft(tx: Exec, d: ConfigDefinition, actor: Actor, value: unknown, reason: string, opts: DraftOpts, publishedVersion: number | null) {
  const nextR = await tx.execute(sql`SELECT COALESCE(MAX(version), 0) + 1 AS n FROM site_config_version WHERE "itemKey" = ${d.key}`)
  const version = Number(rowsOf<{ n: number }>(nextR)[0].n)
  const id = `scv_${crypto.randomUUID()}`
  const publicVisible = d.sensitivity === 'normal' ? true : opts.publicVisible === true
  await tx.execute(sql`
    INSERT INTO site_config_version (id, "itemKey", version, value, "valueHash", status, "publicVisible", reason,
      "basedOnVersion", "rollbackOfVersion", "authorId", "authorEmail", "lastEditorId")
    VALUES (${id}, ${d.key}, ${version}, ${JSON.stringify(value)}::jsonb, ${valueHash(value)}, 'draft', ${publicVisible}, ${reason},
      ${opts.basedOnVersion ?? publishedVersion}, ${opts.rollbackOfVersion ?? null}, ${actor.userId}, ${actor.email}, ${actor.userId})`)
  const row = await versionById(tx, d.key, version)
  return row!
}

/** Crea el borrador de una clave. Una sola versión en curso por clave. */
export async function createDraft(actor: Actor, key: string, value: unknown, reason: string, opts: DraftOpts = {}): Promise<VersionRow> {
  const d = def(key)
  need(actor, 'content.edit', 'editar contenido')
  const parsed = parseValue(d, value)
  const why = cleanReason(reason)
  await ensureSiteConfigSchema()
  return db.transaction(async (tx) => {
    const item = await lockItem(tx, d)
    if (await openVersion(tx, key)) {
      throw new ConfigError('Ya hay una versión en curso para esta clave. Editala o descartala antes de crear otra.', 'conflict')
    }
    return insertDraft(tx, d, actor, parsed, why, opts, item.publishedVersion)
  })
}

/** Edita el borrador (solo en estado borrador). Quien edita queda registrado: para el doble control cuenta como autor. */
export async function updateDraft(actor: Actor, key: string, value: unknown, reason: string, opts: { publicVisible?: boolean } = {}): Promise<VersionRow> {
  const d = def(key)
  need(actor, 'content.edit', 'editar contenido')
  const parsed = parseValue(d, value)
  const why = cleanReason(reason)
  await ensureSiteConfigSchema()
  return db.transaction(async (tx) => {
    await lockItem(tx, d)
    const cur = await openVersion(tx, key)
    if (!cur) throw new ConfigError('No hay borrador para editar.', 'not_found')
    if (cur.status !== 'draft') throw new ConfigError('Solo se edita un borrador. Devolvelo a borrador para modificarlo.', 'state')
    const publicVisible = d.sensitivity === 'normal' ? true : opts.publicVisible === true
    await tx.execute(sql`
      UPDATE site_config_version
      SET value = ${JSON.stringify(parsed)}::jsonb, "valueHash" = ${valueHash(parsed)}, reason = ${why}, "publicVisible" = ${publicVisible},
          "lastEditorId" = ${actor.userId}, "reviewNote" = NULL, "updatedAt" = now()
      WHERE id = ${cur.id}`)
    return (await versionById(tx, key, cur.version))!
  })
}

export async function submitForReview(actor: Actor, key: string): Promise<VersionRow> {
  const d = def(key)
  need(actor, 'content.edit', 'enviar a revisión')
  await ensureSiteConfigSchema()
  return db.transaction(async (tx) => {
    await lockItem(tx, d)
    const cur = await openVersion(tx, key)
    if (!cur || cur.status !== 'draft') throw new ConfigError('No hay un borrador para enviar a revisión.', 'state')
    parseValue(d, cur.value)
    await tx.execute(sql`UPDATE site_config_version SET status = 'in_review', "submittedAt" = now(), "updatedAt" = now() WHERE id = ${cur.id}`)
    return (await versionById(tx, key, cur.version))!
  })
}

/** Devuelve una versión en revisión o aprobada a borrador, con el motivo. */
export async function returnToDraft(actor: Actor, key: string, note: string): Promise<VersionRow> {
  const d = def(key)
  const perm = d.sensitivity === 'pricing' ? 'pricing.publish' : 'content.publish'
  if (!actor.perms.has(perm) && !actor.perms.has('content.edit')) throw new ConfigError(`Necesitás el permiso "${perm}" o "content.edit".`, 'forbidden')
  const why = cleanReason(note, 5)
  await ensureSiteConfigSchema()
  return db.transaction(async (tx) => {
    await lockItem(tx, d)
    const cur = await openVersion(tx, key)
    if (!cur || (cur.status !== 'in_review' && cur.status !== 'approved')) throw new ConfigError('No hay una versión en revisión para devolver.', 'state')
    await tx.execute(sql`
      UPDATE site_config_version
      SET status = 'draft', "reviewedById" = ${actor.userId}, "reviewedAt" = now(), "reviewNote" = ${why},
          "approvedById" = NULL, "approvedByEmail" = NULL, "approvedAt" = NULL, "updatedAt" = now()
      WHERE id = ${cur.id}`)
    return (await versionById(tx, key, cur.version))!
  })
}

/** Segunda firma. En claves sensibles la hace otro administrador distinto del autor y del último editor. */
export async function approve(actor: Actor, key: string, note: string, publicApprovalRef?: string): Promise<VersionRow> {
  const d = def(key)
  const why = cleanReason(note, 5)
  await ensureSiteConfigSchema()
  return db.transaction(async (tx) => {
    await lockItem(tx, d)
    const cur = await openVersion(tx, key)
    if (!cur) throw new ConfigError('No hay una versión para aprobar.', 'not_found')
    const blocker = approvalBlocker(d.sensitivity, cur, actor)
    if (blocker) throw new ConfigError(blocker, cur.status === 'in_review' ? (blocker.startsWith('Doble') ? 'dual_control' : 'forbidden') : 'state')
    const ref = (publicApprovalRef ?? '').trim()
    if (cur.publicVisible && d.sensitivity !== 'normal' && ref.length < 10) {
      throw new ConfigError('Para mostrarlo en la web pública hay que dejar constancia de quién lo aprobó (dirección y asesoría legal), mínimo 10 caracteres.', 'invalid')
    }
    await tx.execute(sql`
      UPDATE site_config_version
      SET status = 'approved', "approvedById" = ${actor.userId}, "approvedByEmail" = ${actor.email}, "approvedAt" = now(),
          "reviewedById" = ${actor.userId}, "reviewedAt" = now(), "reviewNote" = ${why},
          "publicApprovalRef" = ${cur.publicVisible && d.sensitivity !== 'normal' ? ref : null}, "updatedAt" = now()
      WHERE id = ${cur.id}`)
    return (await versionById(tx, key, cur.version))!
  })
}

/** Publica la versión. La re-autenticación (clave actual) la verifica quien llama, antes de esta función. */
export async function publish(actor: Actor, key: string): Promise<VersionRow> {
  const d = def(key)
  await ensureSiteConfigSchema()
  return db.transaction(async (tx) => {
    const item = await lockItem(tx, d)
    const cur = await openVersion(tx, key)
    if (!cur) throw new ConfigError('No hay una versión para publicar.', 'not_found')
    const blocker = publishBlocker(d.sensitivity, cur, actor)
    if (blocker) throw new ConfigError(blocker, blocker.startsWith('Doble') || blocker.startsWith('Este contenido es sensible') ? 'dual_control' : 'forbidden')
    parseValue(d, cur.value)
    if (item.publishedVersion != null) {
      await tx.execute(sql`UPDATE site_config_version SET status = 'superseded', "updatedAt" = now() WHERE "itemKey" = ${key} AND status = 'published'`)
    }
    await tx.execute(sql`
      UPDATE site_config_version
      SET status = 'published', "publishedById" = ${actor.userId}, "publishedByEmail" = ${actor.email}, "publishedAt" = now(), "updatedAt" = now()
      WHERE id = ${cur.id}`)
    await tx.execute(sql`UPDATE site_config_item SET "publishedVersion" = ${cur.version}, "updatedAt" = now() WHERE key = ${key}`)
    return (await versionById(tx, key, cur.version))!
  })
}

/** Retira lo publicado: la web vuelve a los valores del código. Reduce exposición, por eso no pide doble control. */
export async function unpublish(actor: Actor, key: string, reason: string): Promise<void> {
  const d = def(key)
  need(actor, d.sensitivity === 'pricing' ? 'pricing.publish' : 'content.publish', 'dejar de publicar')
  cleanReason(reason)
  await ensureSiteConfigSchema()
  await db.transaction(async (tx) => {
    const item = await lockItem(tx, d)
    if (item.publishedVersion == null) throw new ConfigError('No hay nada publicado para retirar.', 'state')
    await tx.execute(sql`UPDATE site_config_version SET status = 'superseded', "updatedAt" = now() WHERE "itemKey" = ${key} AND status = 'published'`)
    await tx.execute(sql`UPDATE site_config_item SET "publishedVersion" = NULL, "updatedAt" = now() WHERE key = ${key}`)
  })
}

export async function discardDraft(actor: Actor, key: string): Promise<void> {
  const d = def(key)
  need(actor, 'content.edit', 'descartar borradores')
  await ensureSiteConfigSchema()
  await db.transaction(async (tx) => {
    await lockItem(tx, d)
    const cur = await openVersion(tx, key)
    if (!cur || cur.status !== 'draft') throw new ConfigError('Solo se puede descartar un borrador.', 'state')
    await tx.execute(sql`DELETE FROM site_config_version WHERE id = ${cur.id}`)
  })
}

/** Vuelta atrás: no reescribe el historial; crea un borrador nuevo con el contenido de una versión anterior, que sigue el mismo flujo. */
export async function createRollbackDraft(actor: Actor, key: string, fromVersion: number, reason: string): Promise<VersionRow> {
  const d = def(key)
  need(actor, 'content.edit', 'restaurar versiones')
  const why = cleanReason(reason)
  await ensureSiteConfigSchema()
  return db.transaction(async (tx) => {
    const item = await lockItem(tx, d)
    const src = await versionById(tx, key, fromVersion)
    if (!src) throw new ConfigError('La versión a restaurar no existe.', 'not_found')
    if (await openVersion(tx, key)) throw new ConfigError('Ya hay una versión en curso para esta clave. Descartala antes de restaurar otra.', 'conflict')
    const parsed = parseValue(d, src.value)
    return insertDraft(
      tx,
      d,
      actor,
      parsed,
      `Restaura la versión ${fromVersion}: ${why}`,
      { publicVisible: src.publicVisible && !requiresDualControl(d.sensitivity) ? true : false, rollbackOfVersion: fromVersion },
      item.publishedVersion,
    )
  })
}

export { defaultPublicVisible }
