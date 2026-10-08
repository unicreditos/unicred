import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { isOpenDuringMaintenance, maintenanceEnabled } from '../../lib/maintenance'

describe('mantenimiento', () => {
  it('deja abiertos el ingreso, los paneles, los cobros y los legales', () => {
    for (const path of ['/sign-in', '/admin', '/admin/clientes/planilla', '/dashboard', '/dashboard/pagos', '/merchant', '/api/auth/login', '/pagar/cuota_1', '/legal/arrepentimiento', '/mantenimiento']) {
      assert.equal(isOpenDuringMaintenance(path), true, path)
    }
  })

  it('cierra el sitio público', () => {
    for (const path of ['/', '/prestamos', '/contacto', '/preguntas-frecuentes', '/scoring', '/comercios']) {
      assert.equal(isOpenDuringMaintenance(path), false, path)
    }
  })

  it('se apaga solo con MAINTENANCE_MODE=off', () => {
    const prev = process.env.MAINTENANCE_MODE
    delete process.env.MAINTENANCE_MODE
    assert.equal(maintenanceEnabled(), true)
    process.env.MAINTENANCE_MODE = 'off'
    assert.equal(maintenanceEnabled(), false)
    process.env.MAINTENANCE_MODE = '0'
    assert.equal(maintenanceEnabled(), false)
    if (prev === undefined) delete process.env.MAINTENANCE_MODE
    else process.env.MAINTENANCE_MODE = prev
  })
})
