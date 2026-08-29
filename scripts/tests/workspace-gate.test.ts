import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  installmentPosPath,
  isWorkspaceStayPath,
  legacyPedirRedirect,
  publicPayInstallmentId,
  safeInternalPath,
  shouldBounceLoggedInToWorkspace,
} from '../../lib/workspace-gate'

describe('panel autenticado', () => {
  it('manda el cobro público a la caja del dashboard', () => {
    assert.equal(publicPayInstallmentId('/pagar/inst_abc'), 'inst_abc')
    assert.equal(publicPayInstallmentId('/pedir/pagar/inst_abc'), null)
    assert.equal(
      installmentPosPath('inst_f9289afb-394f-4681-9169-161a4bfd9513', 'tarjeta_credito'),
      '/dashboard?tab=pagos&pay=inst_f9289afb-394f-4681-9169-161a4bfd9513&method=tarjeta_credito',
    )
  })

  it('el canal /pedir redirige al sitio único', () => {
    assert.equal(legacyPedirRedirect('/pedir'), '/')
    assert.equal(legacyPedirRedirect('/pedir/solicitud'), '/sign-up')
    assert.equal(legacyPedirRedirect('/pedir/ingresar'), '/sign-in')
    assert.equal(legacyPedirRedirect('/pedir/faq'), '/contacto')
    assert.equal(legacyPedirRedirect('/pedir/contacto'), '/contacto')
    assert.equal(legacyPedirRedirect('/pedir/cuenta'), '/dashboard')
    assert.equal(legacyPedirRedirect('/pedir/legal/terminos'), '/legal/terminos')
    assert.equal(legacyPedirRedirect('/pedir/pagar/inst_abc'), '/pagar/inst_abc')
    assert.equal(legacyPedirRedirect('/pedir/docs/contrato/c1'), '/dashboard/documentos/contrato/c1')
    assert.equal(legacyPedirRedirect('/dashboard'), null)
  })

  it('con sesión no deja el sitio de marketing; el panel sí queda adentro', () => {
    assert.equal(shouldBounceLoggedInToWorkspace('/'), true)
    assert.equal(shouldBounceLoggedInToWorkspace('/sign-in'), true)
    assert.equal(shouldBounceLoggedInToWorkspace('/productos'), false)
    assert.equal(shouldBounceLoggedInToWorkspace('/prestamos'), false)
    assert.equal(shouldBounceLoggedInToWorkspace('/dashboard'), false)
    assert.equal(shouldBounceLoggedInToWorkspace('/dashboard?tab=pagos'), false)
    assert.equal(isWorkspaceStayPath('/dashboard/pagar/inst_1'), true)
    assert.equal(isWorkspaceStayPath('/legal/terminos'), true)
    assert.equal(shouldBounceLoggedInToWorkspace('/pagar/inst_1'), false)
    assert.equal(shouldBounceLoggedInToWorkspace('/directo'), false)
    assert.equal(shouldBounceLoggedInToWorkspace('/directo/productos'), false)
  })

  it('no acepta un next externo', () => {
    assert.equal(safeInternalPath('/dashboard?tab=pagos'), '/dashboard?tab=pagos')
    assert.equal(safeInternalPath('https://evil.example/'), null)
    assert.equal(safeInternalPath('//evil.example'), null)
  })
})
