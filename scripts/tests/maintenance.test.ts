import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { isOpenDuringMaintenance, maintenanceEnabled } from '../../lib/maintenance'

describe('mantenimiento', () => {
  it('solo deja el aviso y los avisos automáticos de pago e identidad', () => {
    for (const path of [
      '/mantenimiento',
      '/api/webhooks/mercadopago',
      '/api/webhooks/didit',
      '/api/cron/reconcile-payments',
      '/api/cron/reconcile-kyc',
    ]) {
      assert.equal(isOpenDuringMaintenance(path), true, path)
    }
  })

  it('cierra ingreso, paneles, cobros, legales y el resto del sitio', () => {
    for (const path of [
      '/',
      '/prestamos',
      '/contacto',
      '/sign-in',
      '/sign-up',
      '/admin',
      '/admin/clientes/planilla',
      '/dashboard',
      '/dashboard/pagos',
      '/merchant',
      '/api/auth/login',
      '/pagar/cuota_1',
      '/legal/arrepentimiento',
      '/legal/baja',
    ]) {
      assert.equal(isOpenDuringMaintenance(path), false, path)
    }
  })

  it('está apagado y ninguna variable de entorno lo enciende', () => {
    const prev = process.env.MAINTENANCE_MODE
    delete process.env.MAINTENANCE_MODE
    assert.equal(maintenanceEnabled(), false)
    process.env.MAINTENANCE_MODE = 'on'
    assert.equal(maintenanceEnabled(), false)
    if (prev === undefined) delete process.env.MAINTENANCE_MODE
    else process.env.MAINTENANCE_MODE = prev
  })
})
