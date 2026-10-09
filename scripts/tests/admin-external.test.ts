import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

const src = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8')

describe('Panel admin sin depender de paneles externos', () => {
  it('cada API exige permiso y no cachea', () => {
    for (const f of [
      'app/api/admin/didit-webhooks/route.ts',
      'app/api/admin/didit-webhooks/[id]/resend/route.ts',
      'app/api/admin/bcra/[userId]/route.ts',
      'app/api/admin/arca/[userId]/route.ts',
    ]) {
      const s = src(f)
      assert.match(s, /requirePermission\('(kyc\.review|risk\.read)'\)/, f)
      assert.match(s, /adminJson/, f)
    }
  })
  it('reprocesar usa el payload guardado, marca procesado y audita; no llama a Didit', () => {
    const s = src('lib/admin-external.ts')
    assert.match(s, /processDiditWebhook\(payload\)/)
    assert.match(s, /markDiditWebhookProcessed/)
    assert.match(s, /DIDIT_WEBHOOK_REPLAYED/)
  })
  it('actualizar BCRA/ARCA tiene tope por hora y deja auditoria', () => {
    assert.match(src('app/api/admin/bcra/[userId]/route.ts'), /consumeRateLimit/)
    assert.match(src('app/api/admin/arca/[userId]/route.ts'), /consumeRateLimit/)
    const s = src('lib/admin-external.ts')
    assert.match(s, /BCRA_REFRESHED_BY_ADMIN/)
    assert.match(s, /ARCA_REFRESHED_BY_ADMIN/)
    assert.match(s, /arca_name_mismatch/)
  })
  it('las pantallas existen y estan en el menu', () => {
    for (const p of ['webhooks-didit', 'bcra-historial', 'padron-arca']) {
      assert.ok(existsSync(new URL(`../../app/admin/originacion/${p}/page.tsx`, import.meta.url)), p)
      assert.match(src('lib/uc/admin.ts'), new RegExp(`/admin/originacion/${p}`))
    }
  })
  it('cron reconcile-kyc programado en vercel.json', () => {
    const v = JSON.parse(src('vercel.json')) as { crons?: Array<{ path: string; schedule: string }> }
    assert.ok(v.crons?.some((c) => c.path === '/api/cron/reconcile-kyc' && c.schedule))
  })
})
describe('Revision: rutas nuevas del panel', () => {
  it('toda ruta nueva exige permiso o sesion y responde 401/403 sin filtrar NEXT_REDIRECT', () => {
    const fs = ['app/api/admin/didit-webhooks/route.ts', 'app/api/admin/didit-webhooks/[id]/resend/route.ts', 'app/api/admin/bcra/[userId]/route.ts', 'app/api/admin/arca/[userId]/route.ts', 'app/api/admin/kyc-evidence/[userId]/route.ts', 'app/api/admin/kyc-evidence/[userId]/[kind]/route.ts']
    for (const f of fs) { const s = src(f); assert.match(s, /requirePermission\(/, f); assert.match(s, /authFailure\(err\)/, f) }
    assert.match(src('lib/admin-api.ts'), /NEXT_REDIRECT/)
  })
  it('los POST rechazan otro origen y las rutas 2FA tambien', () => {
    for (const f of ['app/api/admin/didit-webhooks/[id]/resend/route.ts', 'app/api/admin/bcra/[userId]/route.ts', 'app/api/admin/arca/[userId]/route.ts']) assert.match(src(f), /rejectCrossOrigin\(req\)/, f)
    const s = src('lib/second-factor-api.ts')
    assert.equal((s.match(/rejectCrossOrigin\(req\)/g) ?? []).length, 2)
  })
  it('actualizar BCRA exige permiso de escritura de riesgo', () => {
    const s = src('app/api/admin/bcra/[userId]/route.ts')
    assert.match(s, /requirePermission\('risk\.score\.write'\)/)
  })
  it('los 500 no devuelven el mensaje interno', () => {
    for (const f of ['app/api/admin/didit-webhooks/route.ts', 'app/api/admin/kyc-evidence/[userId]/route.ts', 'app/api/admin/kyc-evidence/[userId]/[kind]/route.ts']) assert.match(src(f), /serverError\(err/, f)
  })
})
describe('Revision: atomicidad cableada en el codigo', () => {
  it('reproceso de webhook toma el reclamo atomico y lo libera si falla', () => {
    const s = src('lib/admin-external.ts')
    assert.match(s, /claimWebhookReplay\(db, id\)/)
    assert.match(s, /releaseWebhookReplay\(db, id\)/)
  })
  it('ocrData se fusiona en la base (Didit, ARCA, registro), no se reescribe entero', () => {
    assert.match(src('lib/didit.ts'), /ocrMergeSql\(/)
    assert.match(src('lib/admin-external.ts'), /ocrMergeSql\(/)
    assert.match(src('app/actions/register.ts'), /ocrMergeSql\(ocrPatch\)/)
  })
  it('el alta traduce la violacion de CUIL unico a un mensaje, y el SQL 03 existe', () => {
    assert.match(src('app/actions/register.ts'), /isUniqueViolation\(err\)/)
    assert.match(src('scripts/sql/2026-10-09_03_profile_cuil_unique.sql'), /profile_cuil_unique_idx/)
  })
  it('el registro de accesos a evidencia es de solo agregar en la base', () => {
    assert.match(src('scripts/sql/2026-10-09_02_kyc_evidence_and_admin_otp.sql'), /kyc_evidence_access_log_append_only_trg/)
  })
})