import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { parsePage } from '../../lib/page-param'

describe('número de página de la URL', () => {
  it('acepta enteros positivos', () => {
    assert.equal(parsePage('1'), 1)
    assert.equal(parsePage('7'), 7)
    assert.equal(parsePage(['3', '9']), 3)
  })

  it('cualquier otra cosa vale 1 (una base de datos rechaza un desplazamiento fraccionario o enorme)', () => {
    for (const bad of [undefined, '', 'abc', '0', '-5', '1.5', 'NaN', 'Infinity', '1e30', '99999999999', ['x']]) {
      assert.equal(parsePage(bad as string | string[] | undefined), 1, String(bad))
    }
  })

  it('trunca los decimales de una página válida', () => {
    assert.equal(parsePage('2.9'), 2)
  })
})
