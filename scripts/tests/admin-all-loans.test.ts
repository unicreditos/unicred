import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import { AUTO_APPROVED_LABEL, LOAN_LIST_STATUS, MANUAL_LABEL, loanOriginLabel, loanStatusBadge } from '../../lib/loan-list'
import { IDENTITY_NOTICE_ACTION, arDayBounds, identityCheck, identityInboxNotice, identityRequiredEmail, maskCuil, maskEmail } from '../../lib/identity-notice'

describe('Listado admin de todos los creditos', () => {
  it('marca los aprobados por puntaje y el resto como manual', () => {
    for (const g of ['auto_score', 'mobile_auto', 'merchant_sale', 'online_consumo']) assert.equal(loanOriginLabel(g), AUTO_APPROVED_LABEL)
    assert.equal(loanOriginLabel('admin_1'), MANUAL_LABEL)
    assert.equal(loanOriginLabel(null), MANUAL_LABEL)
  })
  it('cubre todos los estados del credito', () => {
    for (const s of ['pending', 'approved', 'active', 'paid', 'rejected', 'cancelled']) assert.ok(LOAN_LIST_STATUS[s])
    assert.equal(loanStatusBadge('pending').l, 'En revisi\u00f3n')
    assert.equal(loanStatusBadge('xx').l, 'xx')
  })
  it('la pagina exige credits.read, lista sin filtrar por estado y la grilla tiene filtros y exportacion', () => {
    const p = readFileSync(new URL('../../app/admin/creditos/todos/page.tsx', import.meta.url), 'utf8')
    assert.match(p, /credits\.read/)
    assert.doesNotMatch(p, /\.where\(/)
    assert.match(p, /amountKey/)
    assert.match(p, /exportName/)
    assert.match(p, /dateKey/)
    const g = readFileSync(new URL('../../components/uc/data-grid.tsx', import.meta.url), 'utf8')
    assert.match(g, /-03:00|parseDMY/)
  })
})

describe('Verificacion de identidad y aviso', () => {
  const ok = { provider: 'didit', status: 'approved', expiresAt: null, reviewedAt: new Date(), updatedAt: new Date(), profileKycStatus: 'approved', hasRecord: true }
  it('clasifica el paso de identidad como diditApprovedForUser', () => {
    assert.equal(identityCheck(ok), 'ok')
    assert.equal(identityCheck({ ...ok, hasRecord: false }), 'no_record')
    assert.equal(identityCheck({ ...ok, provider: 'manual' }), 'not_didit')
    assert.equal(identityCheck({ ...ok, status: 'pending' }), 'not_approved')
    assert.equal(identityCheck({ ...ok, expiresAt: new Date(Date.now() - 1000) }), 'expired')
    assert.equal(identityCheck({ ...ok, reviewedAt: new Date('2024-01-01') }), 'expired')
    assert.equal(identityCheck({ ...ok, profileKycStatus: 'pending' }), 'profile_not_approved')
  })
  it('enmascara CUIL y mail', () => {
    assert.equal(maskCuil('20-12345678-3'), '***783')
    assert.equal(maskEmail('juan@mail.com'), 'j***@mail.com')
  })
  it('el dia argentino usa limites -03:00, no UTC', () => {
    assert.deepEqual(arDayBounds('2026-10-09'), { start: '2026-10-09T03:00:00.000Z', end: '2026-10-10T03:00:00.000Z' })
  })
  it('el mail es en espanol, con enlace y sin prometer aprobacion', () => {
    const m = identityRequiredEmail({ to: 'a@b.com', name: 'Ana', verifyUrl: 'https://x.test/dashboard/perfil/identidad' })
    assert.match(m.subject, /identidad/i)
    assert.match(m.html, /dashboard\/perfil\/identidad/)
    assert.match(m.text, /sigue en revisi/)
    assert.doesNotMatch(m.text, /aprobad/i)
  })
  it('el aviso en la app solo aparece con solicitud abierta e identidad pendiente', () => {
    assert.equal(identityInboxNotice('ok', true), null)
    assert.equal(identityInboxNotice('not_approved', false), null)
    assert.equal(identityInboxNotice('not_approved', true)?.href, '/dashboard/perfil/identidad')
  })
  it('el script de aviso es simulacion por defecto, exige confirmacion, audita, es idempotente y con ritmo', () => {
    const s = readFileSync(new URL('../notify-identity-required.ts', import.meta.url), 'utf8')
    assert.match(s, /--send requiere/)
    assert.match(s, /alreadyNotified/)
    assert.match(s, new RegExp(IDENTITY_NOTICE_ACTION.replace(/_/g, '_')))
    assert.match(s, /DELAY_MS/)
    assert.match(s, /readOnly\(/)
  })
})