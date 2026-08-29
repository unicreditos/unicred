import assert from 'node:assert/strict'
import { serviceProviderById, SERVICE_PROVIDERS } from '../../lib/services/catalog'

assert.ok(SERVICE_PROVIDERS.length >= 10)
assert.equal(serviceProviderById('claro_recarga')?.kind, 'recharge')
assert.equal(serviceProviderById('edenor')?.kind, 'bill')
assert.ok(serviceProviderById('claro_recarga')?.accountPattern?.test('1112345678'))
assert.equal(serviceProviderById('nope'), null)
console.log('services catalog OK', SERVICE_PROVIDERS.length)
