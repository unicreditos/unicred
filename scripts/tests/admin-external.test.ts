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