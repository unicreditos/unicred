import assert from 'node:assert/strict'
import test from 'node:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import { CouponBookPrintable } from '@/components/documents/coupon-book-printable'
import { itfBarcodeSvg } from '@/lib/coupon'
import {
  BARCODE_WINDOW_DAYS,
  barcodesAvailableFrom,
  qrSvgFromPayload,
  resolveCouponBook,
  type CouponTalonPay,
} from '@/lib/documents/coupon-payment-data'
import { couponPayToken, couponPayUrl, verifyCouponPayToken } from '@/lib/payments/coupon-link'
import type { ContractDocData } from '@/lib/legal/types'

// Datos 100% ficticios.
const ENV = { BETTER_AUTH_SECRET: 'secreto-de-prueba-0123456789abcdef' }
const BARCODE = '3335008800000000006004835002100020000242462010'
const DAY = 24 * 60 * 60 * 1000
const NOW = new Date('2026-10-10T15:00:00Z')

function sampleContract(n = 6): ContractDocData {
  const installments = Array.from({ length: n }, (_, i) => ({
    id: `inst_${i + 1}`,
    number: i + 1,
    dueDate: new Date(NOW.getTime() + (10 + 30 * i) * DAY),
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

async function talonsFor(contract: ContractDocData, opts: { missingRapipago?: boolean } = {}) {
  const talons: CouponTalonPay[] = []
  for (const row of contract.installments) {
    const id = row.id as string
    const qrUrl = couponPayUrl(id, 'https://www.unicreditos.com', ENV)
    const from = barcodesAvailableFrom(row.dueDate, NOW)
    const code = (network: 'pagofacil' | 'rapipago') => ({
      network,
      label: network === 'pagofacil' ? ('Pago Fácil' as const) : ('Rapipago' as const),
      barcode: BARCODE,
      paymentCode: '1234567890',
      expiresAt: new Date(NOW.getTime() + 30 * DAY).toISOString(),
    })
    talons.push({
      installmentId: id,
      number: row.number,
      qrUrl,
      qrSvg: await qrSvgFromPayload(qrUrl),
      barcodesFrom: from ? from.toISOString() : null,
      pagoFacil: from ? null : code('pagofacil'),
      rapipago: from || opts.missingRapipago ? null : code('rapipago'),
    })
  }
  return talons
}

test('itfBarcodeSvg: 2 de 5 intercalado con inicio, pares y fin', () => {
  const svg = itfBarcodeSvg(BARCODE, { height: 40 })
  assert.ok(svg.startsWith('<svg'))
  // 46 dígitos = 23 pares x 5 barras, + 2 de inicio + 2 de fin.
  assert.equal((svg.match(/<rect /g) ?? []).length, 23 * 5 + 4)
  assert.throws(() => itfBarcodeSvg('123'))
  assert.throws(() => itfBarcodeSvg('12a4'))
})

test('enlace del QR: firmado por cuota y sin secreto no se emite', () => {
  const token = couponPayToken('inst_1', ENV)
  assert.ok(token && token.length === 22)
  assert.equal(verifyCouponPayToken('inst_1', token, ENV), true)
  assert.equal(verifyCouponPayToken('inst_2', token, ENV), false)
  assert.equal(verifyCouponPayToken('inst_1', 'x'.repeat(22), ENV), false)
  assert.equal(verifyCouponPayToken('inst_1', null, ENV), false)
  assert.equal(couponPayUrl('inst_1', 'https://www.unicreditos.com/', ENV), `https://www.unicreditos.com/pagar/inst_1?t=${token}`)
  assert.equal(couponPayToken('inst_1', { BETTER_AUTH_SECRET: 'corto' }), null)
  assert.equal(couponPayUrl('inst_1', undefined, {}), null)
})

test('ventana de códigos: solo cuotas que vencen dentro de 27 días o vencidas', () => {
  assert.equal(BARCODE_WINDOW_DAYS, 27)
  assert.equal(barcodesAvailableFrom(new Date(NOW.getTime() + 10 * DAY), NOW), null)
  assert.equal(barcodesAvailableFrom(new Date(NOW.getTime() - 5 * DAY), NOW), null)
  const later = barcodesAvailableFrom(new Date(NOW.getTime() + 40 * DAY), NOW)
  assert.ok(later && later.getTime() > NOW.getTime())
  assert.ok(later.getTime() <= NOW.getTime() + 14 * DAY)
})

test('resolveCouponBook: definitiva solo con QR en todas y códigos en las de la ventana', async () => {
  const contract = sampleContract(3)
  const ok = resolveCouponBook(await talonsFor(contract))
  assert.deepEqual(ok.problems, [])
  assert.equal(ok.final, true)

  const missing = resolveCouponBook(await talonsFor(contract, { missingRapipago: true }))
  assert.equal(missing.final, false)
  assert.deepEqual(missing.problems, ['Cuota 1: Mercado Pago no emitió el código de Rapipago.'])

  const noQr = (await talonsFor(contract)).map((t) => ({ ...t, qrSvg: null }))
  assert.equal(resolveCouponBook(noQr).problems.length, 3)
  assert.equal(resolveCouponBook(await talonsFor(contract), ['Mercado Pago caído']).final, false)
})

test('cuponera: 2 talones por hoja, QR de Mercado Pago y códigos de red sin datos bancarios', async () => {
  const contract = sampleContract(4)
  const pay = resolveCouponBook(await talonsFor(contract))
  const html = renderToStaticMarkup(createElement(CouponBookPrintable, { contract, pay }))
  assert.equal((html.match(/class="cp-sheet"/g) ?? []).length, 2)
  assert.equal((html.match(/<article class="cp/g) ?? []).length, 4)
  assert.equal((html.match(/cp-qr-img"/g) ?? []).length, 4)
  assert.ok(html.includes('data-final="true"'))
  assert.ok(!html.includes('cp-draft-banner'))
  assert.ok(html.includes('Pagá con Mercado Pago'))
  // Cuota 1 en ventana: código de barras de Pago Fácil y Rapipago con sus dígitos.
  assert.equal((html.match(new RegExp(`class="cp-net-digits">${BARCODE}<`, 'g')) ?? []).length, 2)
  assert.equal((html.match(/class="cp-net-bars"/g) ?? []).length, 2)
  // Cuotas 2 a 4: aviso de cuándo se habilita el código.
  assert.ok(html.includes('Mercado Pago emite este código desde el'))
  for (const banned of ['CBU', 'Alias', 'Cuenta para transferir', 'Código UNICRÉDITOS', 'Datos para pagar']) {
    assert.ok(!html.includes(banned), `no debe aparecer "${banned}"`)
  }
})

test('cuponera: si falta un código queda en borrador y se bloquea la impresión', async () => {
  const contract = sampleContract(2)
  const pay = resolveCouponBook(await talonsFor(contract, { missingRapipago: true }))
  const html = renderToStaticMarkup(createElement(CouponBookPrintable, { contract, pay }))
  assert.ok(html.includes('data-final="false"'))
  assert.ok(html.includes('BORRADOR'))
  assert.ok(html.includes('NO EMITIDO POR MERCADO PAGO'))
  assert.ok(html.includes('cp-print-block'))
})
