import assert from 'node:assert/strict'
import { describe, it, before, after } from 'node:test'

/**
 * Prueba contra una base LOCAL (se saltea si DATABASE_URL no es 127.0.0.1/localhost):
 * el registro de auditoría no se puede editar, borrar ni vaciar.
 */
const url = process.env.DATABASE_URL ?? ''
let host = ''
try {
  host = new URL(url).hostname
} catch {
  // sin URL
}
const isLocal = ['127.0.0.1', 'localhost', '::1'].includes(host)

describe('auditoría de solo agregado', { skip: isLocal ? false : 'requiere DATABASE_URL local' }, () => {
  let db: typeof import('../../lib/db').db
  let pool: typeof import('../../lib/db').pool
  let sqlTag: typeof import('drizzle-orm').sql
  const id = `test-${crypto.randomUUID()}`
  // drizzle envuelve el error de Postgres: el motivo real viene en `cause`.
  const blocked = (e: unknown) => /solo agregado/.test(String((e as { cause?: { message?: string } }).cause?.message ?? (e as Error).message))

  before(async () => {
    ;({ db, pool } = await import('../../lib/db'))
    ;({ sql: sqlTag } = await import('drizzle-orm'))
    const { recordAudit } = await import('../../lib/audit')
    await recordAudit({ actorUserId: '', action: 'TEST_APPEND_ONLY', entityType: 'test', entityId: id, summary: 'fila de prueba' })
  })

  after(async () => {
    await pool.end()
  })

  it('la fila se registró', async () => {
    const r = await db.execute<{ n: number }>(sqlTag`select count(*)::int as n from admin_audit_log where "entityId" = ${id}`)
    assert.equal(r.rows[0].n, 1)
  })

  it('rechaza UPDATE', async () => {
    await assert.rejects(
      () => db.execute(sqlTag`update admin_audit_log set summary = 'alterado' where "entityId" = ${id}`),
      blocked,
    )
  })

  it('rechaza DELETE', async () => {
    await assert.rejects(() => db.execute(sqlTag`delete from admin_audit_log where "entityId" = ${id}`), blocked)
  })

  it('rechaza TRUNCATE', async () => {
    await assert.rejects(() => db.execute(sqlTag`truncate table admin_audit_log`), blocked)
  })
})
