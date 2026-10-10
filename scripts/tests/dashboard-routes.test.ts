import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { customerDashboardDocUrl } from '../../lib/documents/customer-view'
import { isPanelRoute, legacyDashboardRoute } from '../../lib/dashboard-routes'
import { installmentPosPath, legacyPedirRedirect } from '../../lib/workspace-gate'

describe('rutas del panel del cliente', () => {
  it('lleva las pestañas viejas a su pantalla nueva', () => {
    assert.equal(legacyDashboardRoute('pagos'), '/dashboard/pagos')
    assert.equal(legacyDashboardRoute('cuotas_vigentes'), '/dashboard/pagos')
    assert.equal(legacyDashboardRoute('kyc_biometrico'), '/dashboard/perfil/identidad')
    assert.equal(legacyDashboardRoute('bancos'), '/dashboard/perfil/cuentas')
    assert.equal(legacyDashboardRoute('documentos_contrato'), '/dashboard/documentos')
    assert.equal(legacyDashboardRoute('reclamos'), '/dashboard/ayuda')
    assert.equal(legacyDashboardRoute('overview'), '/dashboard')
  })

  it('ignora pestañas desconocidas o vacías', () => {
    assert.equal(legacyDashboardRoute(null), null)
    assert.equal(legacyDashboardRoute(''), null)
    assert.equal(legacyDashboardRoute('inventada'), null)
    assert.equal(legacyDashboardRoute('__proto__'), null)
  })

  it('no confunde una ruta real con una pestaña vieja', () => {
    for (const leaf of ['solicitar', 'creditos', 'pagos', 'documentos', 'perfil', 'ayuda', 'pagar']) {
      assert.equal(isPanelRoute(leaf), true, leaf)
    }
    assert.equal(isPanelRoute('cuotas'), false)
    assert.equal(isPanelRoute('cuenta'), false)
  })

  it('todos los enlaces que arma el sistema terminan en una pantalla existente', () => {
    // El pago desde un mail o QR va directo a /dashboard/pagos?pay=…
    const pay = new URL(installmentPosPath('inst_1', 'tarjeta_credito'), 'https://x.test')
    assert.equal(pay.pathname, '/dashboard/pagos')
    assert.equal(pay.searchParams.get('pay'), 'inst_1')
    assert.equal(pay.searchParams.get('method'), 'tarjeta_credito')

    const contrato = new URL(legacyPedirRedirect('/pedir/docs/contrato/c1') ?? '', 'https://x.test')
    assert.equal(legacyDashboardRoute(contrato.searchParams.get('tab')), '/dashboard/documentos')
    assert.equal(contrato.searchParams.get('docId'), 'c1')
  })

  it('el visor de documentos vive en /dashboard/documentos', () => {
    assert.equal(customerDashboardDocUrl('contrato', 'c9'), '/dashboard/documentos?doc=contrato&docId=c9')
    assert.equal(customerDashboardDocUrl('arca'), '/dashboard/documentos?doc=arca')
  })
})
