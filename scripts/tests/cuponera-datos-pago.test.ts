import assert from 'node:assert/strict'
import test from 'node:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import { CouponBookPrintable } from '@/components/documents/coupon-book-printable'
import {
  COUPON_PAYMENT_REQUIRED,
  couponPaymentMissingLabels,
  qrSvgFromPayload,
  resolveCouponPaymentData,
} from '@/lib/documents/coupon-payment-data'
import type { ContractDocData } from '@/lib/legal/types'

// Datos 100% ficticios (no son la cuenta real).
const SAMPLE = {
  bank: 'Banco Ejemplo S.A.',
  holder: 'EJEMPLO SOCIEDAD S.A.S.',
  cuit: '30-00000000-0',
  accountType: 'Cuenta corriente',
  accountNumber: '0000000000001',
  cbu: '0000000000000000000000',
  alias: 'EJEMPLO.ALIAS.PAGO',
  qrPayload: 'EJEMPLO-QR-PAYLOAD-0001',
}

function sampleContract(n = 6): ContractDocData {
  const installments = Array.from({ length: n }, (_, i) => ({
    id: `inst_${i + 1}`,
    number: i + 1,
    dueDate: new Date(Date.UTC(2026, 10 + i, 10)),
    amount: 48750,
    status: 'pending',
    paidAt: null,
  }))
  return {
    id: 'ctr_ejemplo0001',
    loanId: 'loan_ejemplo0001',
    customer: { name: 'TITULAR DE EJEMPLO', dni: '30111222', cuil: '20301112224', email: 'ejemplo@example.com', phone: '', address: '', city: '', province: '' },
    loan: { term: n, principal: 200000, installmentAmount: 48750, totalAmount: 48750 * n, monthlyRate: 0.1, tna: null, cft: null },
    installments,
  } as unknown as ContractDocData
}

test('resolveCouponPaymentData: todo completo => final', async () => {
  const qr = await qrSvgFromPayload(SAMPLE.qrPayload)
  assert.ok(qr?.startsWith('<svg'))
  const data = resolveCouponPaymentData(SAMPLE, qr)
  assert.deepEqual(data.missing, [])
  assert.equal(data.final, true)
  assert.equal(data.cbu?.length, 22)
})

test('resolveCouponPaymentData: faltantes se informan y bloquean final', async () => {
  const data = resolveCouponPaymentData({ ...SAMPLE, alias: '', qrPayload: '', cbu: '123' }, null)
  assert.deepEqual(data.missing.sort(), ['alias', 'cbu', 'qr'])
  assert.equal(data.final, false)
  assert.deepEqual(couponPaymentMissingLabels(data).sort(), ['Alias', 'CBU', 'QR de transferencia'])
})

test('resolveCouponPaymentData: CUIT/alias inválidos cuentan como faltantes; ejemplo nunca es final', async () => {
  const bad = resolveCouponPaymentData({ ...SAMPLE, cuit: '12', alias: 'a b' }, await qrSvgFromPayload(SAMPLE.qrPayload))
  assert.deepEqual(bad.missing.sort(), ['alias', 'cuit'])
  const ex = resolveCouponPaymentData(SAMPLE, await qrSvgFromPayload(SAMPLE.qrPayload), { example: true })
  assert.equal(ex.missing.length, 0)
  assert.equal(ex.final, false)
  assert.equal(COUPON_PAYMENT_REQUIRED.length, 7)
})

test('cuponera: 2 cupones por hoja y bloque Datos para pagar con marcador pendiente en borrador', () => {
  const pay = resolveCouponPaymentData({ ...SAMPLE, alias: null, qrPayload: null }, null)
  const html = renderToStaticMarkup(createElement(CouponBookPrintable, { contract: sampleContract(6), pay }))
  assert.equal((html.match(/class="cp-sheet"/g) ?? []).length, 3) // 6 cuotas = 2 + 2 + 2
  assert.equal((html.match(/<article class="cp/g) ?? []).length, 6)
  assert.equal((html.match(/Datos para pagar<\/h3>/g) ?? []).length, 6)
  assert.ok(html.includes('data-final="false"'))
  assert.ok(html.includes('DATO PENDIENTE DE CONFIRMAR'))
  assert.ok(html.includes('QR PENDIENTE DE CONFIRMAR'))
  assert.ok(html.includes('BORRADOR'))
  assert.ok(html.includes('cp-print-block'))
})

test('cuponera: definitiva (datos completos) sin marcadores, con QR y sin bloqueo', async () => {
  const pay = resolveCouponPaymentData(SAMPLE, await qrSvgFromPayload(SAMPLE.qrPayload))
  const html = renderToStaticMarkup(createElement(CouponBookPrintable, { contract: sampleContract(4), pay }))
  assert.ok(html.includes('data-final="true"'))
  assert.ok(!html.includes('DATO PENDIENTE DE CONFIRMAR'))
  assert.ok(!html.includes('cp-draft-banner'))
  assert.ok(html.includes('EJEMPLO.ALIAS.PAGO'))
  assert.ok(html.includes('0000 0000 0000 0000 0000 00') || html.includes('00000000 000000 00000000'))
  assert.equal((html.match(/cp-qr-img"/g) ?? []).length, 4)
})
