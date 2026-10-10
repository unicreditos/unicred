import assert from 'node:assert/strict'
import test from 'node:test'
import { documentPreviewFlags } from '../../lib/documents/preview-flags'

test('documentPreviewFlags interpreta embed y print', () => {
  assert.deepEqual(documentPreviewFlags({ embed: '1', print: '0' }), { embed: true, autoPrint: false })
  assert.deepEqual(documentPreviewFlags({ print: '1' }), { embed: false, autoPrint: true })
  assert.deepEqual(documentPreviewFlags({ embed: ['1'] }), { embed: true, autoPrint: false })
  assert.deepEqual(documentPreviewFlags(undefined), { embed: false, autoPrint: false })
})
