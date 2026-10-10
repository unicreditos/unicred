import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { before, describe, it } from 'node:test'
import { sql } from 'drizzle-orm'
import * as schema from '../../lib/db/schema'
import {
  changeOperatorEmail,
  changeOperatorPassword,
  deleteOperator,
  listOperators,
  resendOperatorVerification,
  type OperatorDeps,
  type OperatorsDb,
} from '../../lib/operators/service'

/**
 * Corre contra un Postgres descartable en memoria (PGlite), nunca contra la base real.
 * Si PGlite no esta en node_modules se omite (npm i --no-save @electric-sql/pglite).
 */
const available = existsSync(path.join(process.cwd(), 'node_modules', '@electric-sql', 'pglite'))

const DDL = `
CREATE TABLE "user" (id text PRIMARY KEY, name text NOT NULL, email text NOT NULL UNIQUE, "emailVerified" boolean NOT NULL DEFAULT false, image text, banned boolean DEFAULT false, role text NOT NULL DEFAULT 'customer', "createdAt" timestamptz NOT NULL DEFAULT now(), "updatedAt" timestamptz NOT NULL DEFAULT now());
CREATE TABLE session (id text PRIMARY KEY, "expiresAt" timestamptz NOT NULL DEFAULT now(), token text NOT NULL UNIQUE, "createdAt" timestamptz NOT NULL DEFAULT now(), "updatedAt" timestamptz NOT NULL DEFAULT now(), "userId" text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE);
CREATE TABLE account (id text PRIMARY KEY, "accountId" text NOT NULL, "providerId" text NOT NULL, "userId" text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE, password text, "createdAt" timestamptz NOT NULL DEFAULT now(), "updatedAt" timestamptz NOT NULL DEFAULT now());
CREATE TABLE admin_role (id text PRIMARY KEY, key text NOT NULL UNIQUE, label text NOT NULL, description text, "isSystem" boolean NOT NULL DEFAULT false);
CREATE TABLE admin_permission (id text PRIMARY KEY, key text NOT NULL UNIQUE, label text NOT NULL, category text);
CREATE TABLE admin_role_permission (id text PRIMARY KEY, "roleId" text NOT NULL REFERENCES admin_role(id), "permissionId" text NOT NULL REFERENCES admin_permission(id));
CREATE TABLE profile (id text PRIMARY KEY, "userId" text NOT NULL UNIQUE REFERENCES "user"(id) ON DELETE CASCADE, role text NOT NULL DEFAULT 'customer', "adminRoleId" text REFERENCES admin_role(id), phone text, "updatedAt" timestamptz NOT NULL DEFAULT now());
CREATE TABLE loan (id text PRIMARY KEY, "userId" text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE);
CREATE TABLE support_presence ("userId" text PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE);
CREATE TABLE admin_audit_log (id text PRIMARY KEY, "actorUserId" text REFERENCES "user"(id) ON DELETE SET NULL, "targetUserId" text, action text NOT NULL, "createdAt" timestamptz NOT NULL DEFAULT now());
INSERT INTO admin_role VALUES ('role_super','super_admin','Super Admin',NULL,true), ('role_soporte','soporte','Soporte',NULL,true);
INSERT INTO admin_permission VALUES ('p1','users.manage','Gestionar',NULL);
INSERT INTO admin_role_permission VALUES ('rp1','role_super','p1');
`

describe('operadores: servicio contra Postgres descartable', { skip: available ? false : 'PGlite no instalado' }, () => {
  let db: OperatorsDb
  let exec: (q: string) => Promise<void>
  let audits: Array<{ action: string; changes?: Record<string, unknown>; summary: string }>
  let hashed: string[]
  let mailed: string[]
  let configured = true
  const limits = new Map<string, number>()

  const deps = (): OperatorDeps => ({
    db,
    hashPassword: async (p) => {
      hashed.push(p)
      return `hash:${p.length}`
    },
    sendVerification: async (email) => {
      mailed.push(email)
      return 'sent'
    },
    isEmailConfigured: () => configured,
    rateLimit: async (key, limit) => {
      const n = (limits.get(key) ?? 0) + 1
      limits.set(key, n)
      return { ok: n <= limit }
    },
    audit: async (e) => {
      audits.push({ action: e.action, changes: e.changes, summary: e.summary })
      await exec(`INSERT INTO admin_audit_log (id,"actorUserId","targetUserId",action) VALUES ('${crypto.randomUUID()}','${e.actorUserId}',${e.targetUserId ? `'${e.targetUserId}'` : 'NULL'},'${e.action}')`)
    },
  })

  const mkUser = (id: string, email: string, role: string, opts: { verified?: boolean; adminRole?: string } = {}) =>
    exec(`
      INSERT INTO "user" (id,name,email,"emailVerified",role) VALUES ('${id}','Nombre ${id}','${email}',${opts.verified ?? false},'${role}');
      INSERT INTO profile (id,"userId",role,"adminRoleId") VALUES ('p-${id}','${id}','${role}',${opts.adminRole ? `'${opts.adminRole}'` : 'NULL'});
      INSERT INTO account (id,"accountId","providerId","userId",password) VALUES ('ac-${id}','${id}','credential','${id}','hash:old');
    `)

  before(async () => {
    if (!available) return
    const { PGlite } = await import('@electric-sql/pglite')
    const { drizzle } = await import('drizzle-orm/pglite')
    const client = new PGlite()
    await client.exec(DDL)
    db = drizzle(client, { schema }) as unknown as OperatorsDb
    exec = async (q) => {
      await client.exec(q)
    }
    audits = []
    hashed = []
    mailed = []
    await mkUser('boss', 'boss@unicreditos.com', 'admin', { verified: true, adminRole: 'role_super' })
    await mkUser('boss2', 'boss2@unicreditos.com', 'admin', { verified: true, adminRole: 'role_super' })
    await mkUser('cust', 'cliente@correo.com', 'customer')
  })

  it('clave: la cambia con el mismo hasher, cierra sesiones y audita sin la clave', async () => {
    await mkUser('op1', 'op1@unicreditos.com', 'admin', { adminRole: 'role_soporte' })
    await exec(`INSERT INTO session (id,token,"userId") VALUES ('s1','t1','op1'),('s2','t2','op1'),('s3','t3','boss')`)
    const pw = 'una-clave-muy-larga-77'
    const r = await changeOperatorPassword(deps(), { actorId: 'boss', targetId: 'op1', newPassword: pw })
    assert.ok(r.ok && r.revokedSessions === 2)
    assert.deepEqual(hashed, [pw])
    const acc = await db.execute(sql`select password from account where "userId"='op1'`)
    assert.equal((acc.rows[0] as { password: string }).password, `hash:${pw.length}`)
    const left = await db.execute(sql`select count(*)::int n from session where "userId"='op1'`)
    assert.equal((left.rows[0] as { n: number }).n, 0)
    const keep = await db.execute(sql`select count(*)::int n from session where "userId"='boss'`)
    assert.equal((keep.rows[0] as { n: number }).n, 1)
    const a = audits.at(-1)!
    assert.equal(a.action, 'OPERATOR_PASSWORD_CHANGED')
    assert.ok(!JSON.stringify(a).includes(pw))
  })

  it('clave: rechaza debil, a si mismo y a clientes', async () => {
    const weak = await changeOperatorPassword(deps(), { actorId: 'boss', targetId: 'op1', newPassword: 'corta' })
    assert.ok(!weak.ok && weak.status === 422)
    const self = await changeOperatorPassword(deps(), { actorId: 'boss', targetId: 'boss', newPassword: 'una-clave-muy-larga-77' })
    assert.ok(!self.ok && self.code === 'self')
    const cust = await changeOperatorPassword(deps(), { actorId: 'boss', targetId: 'cust', newPassword: 'una-clave-muy-larga-77' })
    assert.ok(!cust.ok && cust.code === 'not_operator')
    const none = await changeOperatorPassword(deps(), { actorId: 'boss', targetId: 'nadie', newPassword: 'una-clave-muy-larga-77' })
    assert.ok(!none.ok && none.status === 404)
  })

  it('email: valida, 409 si esta en uso (sin importar mayusculas), marca sin verificar y envia', async () => {
    await mkUser('op2', 'op2@unicreditos.com', 'admin', { verified: true, adminRole: 'role_soporte' })
    await exec(`INSERT INTO session (id,token,"userId") VALUES ('s9','t9','op2')`)
    const bad = await changeOperatorEmail(deps(), { actorId: 'boss', targetId: 'op2', newEmail: 'no-es-email' })
    assert.ok(!bad.ok && bad.status === 422)
    const dup = await changeOperatorEmail(deps(), { actorId: 'boss', targetId: 'op2', newEmail: 'CLIENTE@correo.com' })
    assert.ok(!dup.ok && dup.status === 409 && dup.code === 'email_in_use')
    mailed.length = 0
    const ok = await changeOperatorEmail(deps(), { actorId: 'boss', targetId: 'op2', newEmail: '  Nuevo.Op2@Unicreditos.com ' })
    assert.ok(ok.ok && ok.verification === 'sent' && ok.email === 'nuevo.op2@unicreditos.com')
    assert.deepEqual(mailed, ['nuevo.op2@unicreditos.com'])
    const row = (await db.execute(sql`select email, "emailVerified" v from "user" where id='op2'`)).rows[0] as { email: string; v: boolean }
    assert.deepEqual(row, { email: 'nuevo.op2@unicreditos.com', v: false })
    const s = await db.execute(sql`select count(*)::int n from session where "userId"='op2'`)
    assert.equal((s.rows[0] as { n: number }).n, 0)
    const a = audits.at(-1)!
    assert.deepEqual((a.changes as { email: unknown }).email, { antes: 'op2@unicreditos.com', despues: 'nuevo.op2@unicreditos.com' })
  })

  it('email: sin proveedor guarda igual y avisa "email no configurado"', async () => {
    configured = false
    mailed.length = 0
    const r = await changeOperatorEmail(deps(), { actorId: 'boss', targetId: 'op2', newEmail: 'otro.op2@unicreditos.com' })
    configured = true
    assert.ok(r.ok && r.verification === 'not_configured' && /no configurado/i.test(r.message))
    assert.deepEqual(mailed, [])
  })

  it('reenviar: limite 3 por hora, auditoria, y no sirve para verificados ni emails de prueba', async () => {
    await mkUser('op3', 'op3@unicreditos.com', 'admin', { adminRole: 'role_soporte' })
    mailed.length = 0
    for (let i = 0; i < 3; i++) {
      const r = await resendOperatorVerification(deps(), { actorId: 'boss', targetId: 'op3' })
      assert.ok(r.ok, `intento ${i + 1}`)
    }
    const fourth = await resendOperatorVerification(deps(), { actorId: 'boss', targetId: 'op3' })
    assert.ok(!fourth.ok && fourth.status === 429)
    assert.equal(mailed.length, 3)
    assert.equal(audits.filter((a) => a.action === 'OPERATOR_VERIFICATION_RESENT').length, 3)
    const ver = await resendOperatorVerification(deps(), { actorId: 'boss', targetId: 'boss2' })
    assert.ok(!ver.ok && ver.code === 'already_verified')
    await mkUser('op4', 'fake@example.invalid', 'admin')
    const ph = await resendOperatorVerification(deps(), { actorId: 'boss', targetId: 'op4' })
    assert.ok(!ph.ok && ph.code === 'placeholder_email')
    configured = false
    const nc = await resendOperatorVerification(deps(), { actorId: 'boss', targetId: 'op3' })
    configured = true
    assert.ok(!nc.ok && nc.code === 'email_not_configured')
    assert.equal(limits.get('op-verify:op3'), 4, 'sin proveedor no consume cupo')
  })

  it('baja: pide email exacto y motivo; huerfano se borra de verdad', async () => {
    await mkUser('orf', 'azar123@correo-falso.com', 'admin')
    const noReason = await deleteOperator(deps(), { actorId: 'boss', targetId: 'orf', confirmEmail: 'azar123@correo-falso.com', reason: 'corto' })
    assert.ok(!noReason.ok && noReason.code === 'reason_required')
    const mismatch = await deleteOperator(deps(), { actorId: 'boss', targetId: 'orf', confirmEmail: 'otro@x.com', reason: 'creado por error de prueba' })
    assert.ok(!mismatch.ok && mismatch.code === 'confirm_mismatch')
    const ok = await deleteOperator(deps(), { actorId: 'boss', targetId: 'orf', confirmEmail: 'AZAR123@correo-falso.com', reason: 'creado por error de prueba' })
    assert.ok(ok.ok && ok.mode === 'hard')
    const gone = await db.execute(sql`select count(*)::int n from "user" where id='orf'`)
    assert.equal((gone.rows[0] as { n: number }).n, 0)
    assert.equal(audits.at(-1)!.action, 'OPERATOR_DELETED')
  })

  it('baja: con sesiones se desactiva y anonimiza; ya no aparece en el listado', async () => {
    await mkUser('soft', 'soft@unicreditos.com', 'admin', { adminRole: 'role_soporte' })
    await exec(`INSERT INTO session (id,token,"userId") VALUES ('ss','tt','soft')`)
    const ok = await deleteOperator(deps(), { actorId: 'boss', targetId: 'soft', confirmEmail: 'soft@unicreditos.com', reason: 'ya no trabaja en la empresa' })
    assert.ok(ok.ok && ok.mode === 'soft')
    const row = (await db.execute(sql`select email, banned, name from "user" where id='soft'`)).rows[0] as { email: string; banned: boolean; name: string }
    assert.match(row.email, /^eliminado\+[a-z0-9]+@example\.invalid$/)
    assert.equal(row.banned, true)
    const acc = await db.execute(sql`select count(*)::int n from account where "userId"='soft'`)
    assert.equal((acc.rows[0] as { n: number }).n, 0)
    const p = (await db.execute(sql`select "adminRoleId" r from profile where "userId"='soft'`)).rows[0] as { r: string | null }
    assert.equal(p.r, null)
    assert.ok(!(await listOperators(db)).some((o) => o.id === 'soft'))
  })

  it('baja: se bloquea con historial (prestamos), clientes, uno mismo y el ultimo administrador', async () => {
    await mkUser('hist', 'hist@unicreditos.com', 'admin', { adminRole: 'role_soporte' })
    await exec(`INSERT INTO loan (id,"userId") VALUES ('l1','hist')`)
    const h = await deleteOperator(deps(), { actorId: 'boss', targetId: 'hist', confirmEmail: 'hist@unicreditos.com', reason: 'limpieza de usuarios viejos' })
    assert.ok(!h.ok && h.code === 'has_history' && h.message.includes('loan'))
    const stillThere = await db.execute(sql`select count(*)::int n from "user" where id='hist'`)
    assert.equal((stillThere.rows[0] as { n: number }).n, 1)

    const c = await deleteOperator(deps(), { actorId: 'boss', targetId: 'cust', confirmEmail: 'cliente@correo.com', reason: 'intento de borrar cliente' })
    assert.ok(!c.ok && c.code === 'not_operator')
    const s = await deleteOperator(deps(), { actorId: 'boss', targetId: 'boss', confirmEmail: 'boss@unicreditos.com', reason: 'intento de borrarme solo' })
    assert.ok(!s.ok && s.code === 'self')

    // boss2 es el unico otro manager: si boss2 esta bloqueado, boss ya es el ultimo y nadie puede borrarlo.
    await exec(`UPDATE "user" SET banned = true WHERE id='boss2'`)
    const lastTarget = await deleteOperator(deps(), { actorId: 'boss2', targetId: 'boss', confirmEmail: 'boss@unicreditos.com', reason: 'prueba del ultimo admin' })
    assert.ok(!lastTarget.ok && lastTarget.code === 'last_manager')
    await exec(`UPDATE "user" SET banned = false WHERE id='boss2'`)
  })

  it('baja: auditoria de negocio propia bloquea, pero los ingresos no', async () => {
    await mkUser('aud', 'aud@unicreditos.com', 'admin', { adminRole: 'role_soporte' })
    await exec(`INSERT INTO admin_audit_log (id,"actorUserId",action) VALUES ('x1','aud','AUTH_LOGIN')`)
    const okSoft = await deleteOperator(deps(), { actorId: 'boss', targetId: 'aud', confirmEmail: 'aud@unicreditos.com', reason: 'solo ingresos registrados' })
    assert.ok(okSoft.ok && okSoft.mode === 'soft')
    await mkUser('aud2', 'aud2@unicreditos.com', 'admin', { adminRole: 'role_soporte' })
    await exec(`INSERT INTO admin_audit_log (id,"actorUserId",action) VALUES ('x2','aud2','CREDIT_APPROVED')`)
    const blocked = await deleteOperator(deps(), { actorId: 'boss', targetId: 'aud2', confirmEmail: 'aud2@unicreditos.com', reason: 'aprobo un credito antes' })
    assert.ok(!blocked.ok && blocked.code === 'has_history')
  })
})
