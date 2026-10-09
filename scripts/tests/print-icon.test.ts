import test from 'node:test'
import assert from 'node:assert/strict'
import { PATHS } from '@/components/uc/icons'

test('Print icon exists in PATHS and contains SVG path string', () => {
  // @ts-expect-error verifying key existence
  const printIcon = PATHS.print
  assert.ok(printIcon, 'Print icon must exist in PATHS dictionary')
  assert.match(printIcon, /<path|<rect|<svg/, 'Print icon must contain valid SVG elements')
})
