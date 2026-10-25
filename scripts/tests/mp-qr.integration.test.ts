import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { after, before, describe, it } from 'node:test'

/**
 * Cobros con QR de Mercado Pago, contra Postgres LOCAL y una Mercado Pago SIMULADA (nunca se llama a la real).
 * Mismas reglas que las otras pruebas de integración: solo corre con WALLET_TEST_DATABASE_URL apuntando a localhost.
 */
const url = process.env.WALLET_TEST_DATABASE_URL
const local = (() => {
  try {
    const h = new URL(url ?? '').hostname
    return h === 'localhost' || h === '127.0.0.1'
  } catch {
    return false
  }
})()
if (url && !local) throw new Error('WALLET_TEST_DATABASE_URL tiene que ser una base local. Se aborta para no tocar datos reales.')

const run = url && local ? describe : describe.skip

type Rec = Record<string, unknown>
const EMV = '00020101021243650016com.mercadolibre0201306363a0b5e5-0000-4000-8000-0000000000005204000053030325802AR5910UNICREDITO6304ABCD'

/** Mercado Pago de mentira: guarda sucursales, cajas, órdenes y pagos en memoria y responde como la API. */
function fakeMp() {
  const st = {
    stores: [] as Rec[],
    pos: [] as Rec[],
    orders: new Map<string, Rec>(),
    payments: new Map<string, Rec>(),
    calls: [] as string[],
    seq: 1000 + Math.floor(Math.random() * 1_000_000),
  }
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
  const handler = async (input: string, init?: RequestInit) => {
    const u = new URL(input)
    const path = u.pathname + u.search
    const method = (init?.method ?? 'GET').toUpperCase()
    const body = init?.body ? (JSON.parse(String(init.body)) as Rec) : {}
    st.calls.push(`${method} ${u.pathname}`)

    if (method === 'GET' && /\/users\/\d+\/stores\/search/.test(path)) {
      const ext = u.searchParams.get('external_id')
      const found = st.stores.filter((s) => !ext || s.external_id === ext)
      // Comportamiento real: sin coincidencias responde 404, no una lista vacía.
      if (ext && !found.length) return json({ message: 'Store not found', error: 'not_found', status: 404 }, 404)
      return json({ results: found })
    }
    if (method === 'POST' && /\/users\/\d+\/stores$/.test(u.pathname)) {
      const s = { id: ++st.seq, external_id: body.external_id, name: body.name }
      st.stores.push(s)
      return json(s, 201)
    }
    if (method === 'GET' && u.pathname === '/pos') {
      const ext = u.searchParams.get('external_id')
      const found = st.pos.filter((p) => !ext || p.external_id === ext)
      if (ext && !found.length) return json({ message: 'POS not found', status: 404 }, 404)
      return json({ paging: { total: found.length }, results: found })
    }
    if (method === 'POST' && u.pathname === '/pos') {
      const dup = st.pos.find((p) => p.external_id === body.external_id)
      if (dup) return json(dup, 200)
      const p = {
        id: ++st.seq,
        name: body.name,
        external_id: body.external_id,
        store_id: String(body.store_id),
        qr: { image: `https://mp.test/qr/${body.external_id}.png`, template_document: `https://mp.test/qr/${body.external_id}.pdf`, template_image: 'x' },
      }
      st.pos.push(p)
      return json(p, 201)
    }
    if (method === 'POST' && u.pathname === '/v1/orders') {
      const id = `ORD${++st.seq}`
      const isStatic = ((body.config as Rec)?.qr as Rec)?.mode === 'static'
      const o: Rec = { id, status: 'created', external_reference: body.external_reference, total_amount: body.total_amount, config: body.config, transactions: { payments: [] as Rec[] } }
      // Comportamiento de la API: el modo static no devuelve código propio (se escanea el QR fijo de la caja).
      if (!isStatic) o.qr_data = EMV
      st.orders.set(id, o)
      return json(o, 201)
    }
    const ord = /^\/v1\/orders\/([^/]+)(\/cancel)?$/.exec(u.pathname)
    if (ord) {
      const o = st.orders.get(ord[1])
      if (!o) return json({ message: 'not found' }, 404)
      if (ord[2] && method === 'POST') {
        if (o.status !== 'created') return json({ message: 'order cannot be canceled' }, 409)
        o.status = 'canceled'
        return json(o)
      }
      return json(o)
    }
    const pay = /^\/v1\/payments\/(\d+)$/.exec(u.pathname)
    if (pay) {
      const p = st.payments.get(pay[1])
      return p ? json(p) : json({ message: 'not found' }, 404)
    }
    if (method === 'GET' && u.pathname === '/v1/payments/search') {
      // La API real puede ignorar el filtro: devuelve todo y la app tiene que filtrar por su cuenta.
      return json({ results: [...st.payments.values()] })
    }
    return json({ message: `sin simular: ${method} ${path}` }, 404)
  }

  let pid = 7_000_000_000 + Math.floor(Math.random() * 1_000_000_000)
  return {
    st,
    handler,
    payment(over: Rec = {}): Rec {
      const id = String(++pid)
      const p: Rec = {
        id: Number(id),
        status: 'approved',
        status_detail: 'accredited',
        transaction_amount: 1500,
        transaction_amount_refunded: 0,
        currency_id: 'ARS',
        external_reference: null,
        pos_id: null,
        store_id: null,
        payment_method_id: 'account_money',
        payment_type_id: 'account_money',
        order: null,
        fee_details: [{ type: 'mercadopago_fee', amount: 12 }],
        transaction_details: { net_received_amount: 1488 },
        date_approved: new Date().toISOString(),
        ...over,
      }
      st.payments.set(id, p)
      return p
    },
  }
}

run('cobros con QR de Mercado Pago (integración)', () => {
  let m: {
    db: typeof import('../../lib/db').db
    pool: typeof import('../../lib/db').pool
    schema: typeof import('../../lib/db/schema')
    client: typeof import('../../lib/mercadopago/client')
    qr: typeof import('../../lib/mercadopago/qr')
    settle: typeof import('../../lib/mercadopago/settle')
    ledger: typeof import('../../lib/wallet/ledger')
    integrity: typeof import('../../lib/integrity')
    eq: typeof import('drizzle-orm').eq
  }
  const mp = fakeMp()
  const tag = crypto.randomUUID().slice(0, 8)
  const u = { a: `mq_a_${tag}`, b: `mq_b_${tag}`, c: `mq_c_${tag}` }

  async function newUser(id: string, name: string) {
    const now = new Date()
    await m.db.insert(m.schema.user).values({ id, name, email: `${id}@example.test`, createdAt: now, updatedAt: now })
    await m.db.insert(m.schema.profile).values({ id: `p_${id}`, userId: id, cuil: '20301234563', dni: '30123456', kycStatus: 'approved', createdAt: now, updatedAt: now })
  }
  async function balance(userId: string) {
    const [w] = await m.db.select().from(m.schema.walletAccount).where(m.eq(m.schema.walletAccount.userId, userId))
    return m.ledger.centsOf(w.balance)
  }
  async function payRow(id: string) {
    const [r] = await m.db.select().from(m.schema.mpQrPayment).where(m.eq(m.schema.mpQrPayment.mpPaymentId, id))
    return r
  }

  before(async () => {
    process.env.DATABASE_URL = url
    process.env.BETTER_AUTH_SECRET = 'test-secret-0123456789-abcdefghijklmnopqrstuvwxyz'
    process.env.MERCADO_PAGO_ACCESS_TOKEN = 'APP_USR-test'
    process.env.MERCADO_PAGO_USER_ID = '123456789'
    process.env.MERCADO_PAGO_WEBHOOK_SECRET = 'whsec_test'
    delete process.env.MERCADO_PAGO_QR_CREDIT
    const [{ db, pool }, schema, client, qr, settle, ledger, integrity, drizzle] = await Promise.all([
      import('../../lib/db'),
      import('../../lib/db/schema'),
      import('../../lib/mercadopago/client'),
      import('../../lib/mercadopago/qr'),
      import('../../lib/mercadopago/settle'),
      import('../../lib/wallet/ledger'),
      import('../../lib/integrity'),
      import('drizzle-orm'),
    ])
    m = { db, pool, schema, client, qr, settle, ledger, integrity, eq: drizzle.eq }
    m.client._setMpFetch(mp.handler)
    await newUser(u.a, 'María Lucía Gómez')
    await newUser(u.b, 'Ñandú Pérez')
    await newUser(u.c, 'Carla Díaz')
  })

  after(async () => {
    m?.client._setMpFetch(null)
    if (m) await m.pool.end()
  })

  it('sin credenciales de Mercado Pago no se emite ningún QR', async () => {
    const saved = process.env.MERCADO_PAGO_ACCESS_TOKEN
    process.env.MERCADO_PAGO_ACCESS_TOKEN = ''
    try {
      assert.equal(m.client.mpConfigured(), false)
      assert.throws(() => m.qr.assertMpReady(), /todavía no está habilitado/)
      await assert.rejects(m.qr.ensureUserPos(u.a), /todavía no está habilitado/)
    } finally {
      process.env.MERCADO_PAGO_ACCESS_TOKEN = saved
    }
    assert.equal(mp.st.calls.length, 0, 'no debe llamar a Mercado Pago sin credenciales')
  })

  it('cada persona tiene su propia caja (PDV) en una única sucursal, y se crea una sola vez', async () => {
    const [pa1, pa2] = await Promise.all([m.qr.ensureUserPos(u.a), m.qr.ensureUserPos(u.a)])
    assert.equal(pa1.id, pa2.id)
    const pb = await m.qr.ensureUserPos(u.b)
    assert.notEqual(pa1.externalId, pb.externalId)
    assert.match(pa1.externalId, /^UCV[0-9a-f]{24}$/)
    assert.equal(pa1.externalId, m.qr.posExternalIdFor(u.a))
    assert.equal(pa1.mpStoreId, pb.mpStoreId, 'las cajas cuelgan de la misma sucursal')
    // La sucursal se crea una sola vez y después queda guardada: en una base que ya tenía cajas ni siquiera se consulta.
    assert.ok(mp.st.stores.length <= 1)
    assert.ok(pa1.mpStoreId)
    assert.equal(mp.st.pos.length, 2)
    assert.equal(pa1.name, 'UC Maria G', 'nombre sin acentos ni símbolos')
    assert.equal(pb.name, 'UC Nandu P')
    assert.match(String(pa1.qrImageUrl), /^https:\/\/mp\.test\/qr\/UCV/)
    // Una tercera llamada ya no va a Mercado Pago.
    const before = mp.st.calls.length
    await m.qr.ensureUserPos(u.a)
    assert.equal(mp.st.calls.length, before)
    // La caja queda ligada a la billetera de la persona.
    const [w] = await m.db.select().from(m.schema.walletAccount).where(m.eq(m.schema.walletAccount.userId, u.a))
    assert.equal(pa1.walletId, w.id)
  })

  it('una caja que ya existía en Mercado Pago se reutiliza en vez de duplicarse', async () => {
    const ext = m.qr.posExternalIdFor(u.c)
    mp.st.pos.push({ id: 555, name: 'UC Carla D', external_id: ext, store_id: '1', qr: { image: 'https://mp.test/previo.png' } })
    const before = mp.st.pos.length
    const pc = await m.qr.ensureUserPos(u.c)
    assert.equal(mp.st.pos.length, before, 'no crea otra caja')
    assert.equal(pc.mpPosId, '555')
  })

  it('genera un QR con importe ligado a la caja de la persona y devuelve el código EMV', async () => {
    const { order, qrData } = await m.qr.createQrOrder({ userId: u.a, cents: 150_000, concept: 'Cuota de agosto', ttlMinutes: 60 })
    assert.equal(qrData, EMV)
    assert.equal(order.status, 'created')
    assert.equal(order.amount, '1500.00')
    assert.equal(order.posExternalId, m.qr.posExternalIdFor(u.a))
    assert.match(order.externalReference, /^UCQ-[0-9A-F]{20}$/)
    const sent = mp.st.orders.get(order.mpOrderId!)!
    assert.deepEqual((sent.config as Rec).qr, { external_pos_id: m.qr.posExternalIdFor(u.a), mode: 'dynamic' })
    assert.equal(sent.total_amount, '1500.00')
    assert.ok(order.expiresAt && order.expiresAt.getTime() > Date.now())
    assert.equal(m.qr.expirationDuration(15), 'PT15M')
    assert.equal(m.qr.expirationDuration(90), 'PT2H')
    assert.equal(m.qr.expirationDuration(60 * 24), 'PT24H')
  })

  it('cobro en el QR permanente (modo static): sin código propio, un solo cobro abierto y se acredita igual', async () => {
    const first = await m.qr.createQrOrder({ userId: u.a, cents: 30_000, concept: 'Mostrador', ttlMinutes: 30, permanent: true })
    assert.equal(first.qrData, null, 'no hay código propio: se escanea el QR fijo')
    assert.equal(first.order.mode, 'static')
    assert.equal(((mp.st.orders.get(first.order.mpOrderId!)!.config as Rec).qr as Rec).mode, 'static')
    // Al cargar otro cobro, el anterior se anula en Mercado Pago y acá.
    const second = await m.qr.createQrOrder({ userId: u.a, cents: 45_000, ttlMinutes: 30, permanent: true })
    assert.equal(mp.st.orders.get(first.order.mpOrderId!)!.status, 'canceled')
    const [f] = await m.db.select().from(m.schema.mpQrOrder).where(m.eq(m.schema.mpQrOrder.id, first.order.id))
    assert.equal(f.status, 'cancelled')
    assert.equal(second.order.status, 'created')
    // Los cobros con código propio no se tocan.
    const dyn = await m.qr.createQrOrder({ userId: u.a, cents: 10_000, ttlMinutes: 30 })
    assert.equal(dyn.order.mode, 'dynamic')
    assert.ok(dyn.qrData)
    await m.qr.createQrOrder({ userId: u.a, cents: 12_000, ttlMinutes: 30, permanent: true })
    assert.equal(mp.st.orders.get(dyn.order.mpOrderId!)!.status, 'created')
    // Y el pago de un cobro estático se acredita por su referencia.
    const a0 = await balance(u.a)
    const p = mp.payment({ transaction_amount: 120, external_reference: (await m.db.select().from(m.schema.mpQrOrder).where(m.eq(m.schema.mpQrOrder.mpOrderId, [...mp.st.orders.keys()].pop()!)))[0].externalReference })
    assert.equal((await m.settle.settleQrPayment(String(p.id))).creditedCents, 12_000)
    assert.equal(await balance(u.a), a0 + 12_000)
  })

  it('si Mercado Pago rechaza la orden, no queda un QR a medias', async () => {
    const real = mp.handler
    m.client._setMpFetch(async (input, init) => (String(input).endsWith('/v1/orders') && init?.method === 'POST' ? new Response(JSON.stringify({ message: 'invalid' }), { status: 400 }) : real(input, init)))
    await assert.rejects(m.qr.createQrOrder({ userId: u.a, cents: 10_000, ttlMinutes: 30 }), /Mercado Pago/)
    m.client._setMpFetch(mp.handler)
    const rows = await m.db.select().from(m.schema.mpQrOrder).where(m.eq(m.schema.mpQrOrder.userId, u.a))
    assert.ok(rows.some((r) => r.status === 'failed'))
    assert.ok(!rows.some((r) => r.status === 'creating'))
  })

  it('un pago aprobado de una orden se acredita UNA sola vez en la billetera de la dueña', async () => {
    const { order } = await m.qr.createQrOrder({ userId: u.a, cents: 150_000, concept: 'Cobro 2', ttlMinutes: 60 })
    const start = await balance(u.a)
    const p = mp.payment({ transaction_amount: 1500, external_reference: order.externalReference, order: { id: order.mpOrderId } })
    const id = String(p.id)
    const results = await Promise.all([1, 2, 3, 4, 5].map(() => m.settle.settleQrPayment(id)))
    assert.equal(results.reduce((a, r) => a + r.creditedCents, 0), 150_000, 'exactamente un crédito aunque lleguen 5 avisos a la vez')
    assert.equal(await balance(u.a), start + 150_000)
    assert.equal((await m.settle.settleQrPayment(id)).creditedCents, 0, 'repetirlo después tampoco acredita')
    assert.equal(await balance(u.a), start + 150_000)

    const row = await payRow(id)
    assert.equal(row.status, 'credited')
    assert.equal(row.userId, u.a)
    assert.equal(row.matchedBy, 'order')
    assert.equal(row.fee, '12.00')
    const [o] = await m.db.select().from(m.schema.mpQrOrder).where(m.eq(m.schema.mpQrOrder.id, order.id))
    assert.equal(o.status, 'paid')
    assert.equal(o.mpPaymentId, id)
    const movs = await m.db.select().from(m.schema.walletMovement).where(m.eq(m.schema.walletMovement.externalId, `mp-qr:${id}`))
    assert.equal(movs.length, 1)
    assert.equal(movs[0].kind, 'mp_qr_in')
    assert.equal(movs[0].direction, 'credit')
    assert.equal(movs[0].amount, '1500.00')
  })

  it('el QR permanente (sin orden) acredita a la dueña de la caja, no a otra persona', async () => {
    const posA = await m.qr.getUserPos(u.a)
    const posB = await m.qr.getUserPos(u.b)
    const a0 = await balance(u.a)
    const b0 = await balance(u.b)
    const viaRef = mp.payment({ transaction_amount: 800, external_reference: posB!.externalId })
    const viaPosId = mp.payment({ transaction_amount: 200, external_reference: null, pos_id: posA!.mpPosId })
    assert.equal((await m.settle.settleQrPayment(String(viaRef.id))).userId, u.b)
    assert.equal((await m.settle.settleQrPayment(String(viaPosId.id))).userId, u.a)
    assert.equal(await balance(u.b), b0 + 80_000)
    assert.equal(await balance(u.a), a0 + 20_000)
    assert.equal((await payRow(String(viaRef.id))).matchedBy, 'pos_reference')
    assert.equal((await payRow(String(viaPosId.id))).matchedBy, 'pos_id')
  })

  it('ignora pagos ajenos y deja SIN ASIGNAR (sin acreditar) los de una caja nuestra que no se reconoce', async () => {
    const ajeno = mp.payment({ transaction_amount: 999, external_reference: 'UNICREDCUPONERA' })
    const r1 = await m.settle.settleQrPayment(String(ajeno.id))
    assert.equal(r1.matched, false)
    assert.equal(r1.reason, 'no_es_de_esta_app')
    assert.equal(await payRow(String(ajeno.id)), undefined, 'ni siquiera se registra')

    const huerfano = mp.payment({ transaction_amount: 700, external_reference: 'UCVdeadbeefdeadbeefdeadbeef' })
    const r2 = await m.settle.settleQrPayment(String(huerfano.id))
    assert.equal(r2.matched, false)
    const row = await payRow(String(huerfano.id))
    assert.equal(row.status, 'unmatched')
    assert.equal(row.userId, null)
    const movs = await m.db.select().from(m.schema.walletMovement).where(m.eq(m.schema.walletMovement.externalId, `mp-qr:${huerfano.id}`))
    assert.equal(movs.length, 0)
  })

  it('un pago pendiente o rechazado no acredita; cuando se aprueba, sí (y una sola vez)', async () => {
    const posC = await m.qr.getUserPos(u.c)
    const c0 = await balance(u.c)
    const p = mp.payment({ status: 'in_process', transaction_amount: 300, external_reference: posC!.externalId })
    const id = String(p.id)
    assert.equal((await m.settle.settleQrPayment(id)).creditedCents, 0)
    assert.equal((await payRow(id)).status, 'pending')
    assert.equal(await balance(u.c), c0)

    p.status = 'approved'
    assert.equal((await m.settle.settleQrPayment(id)).creditedCents, 30_000)
    assert.equal(await balance(u.c), c0 + 30_000)

    const rej = mp.payment({ status: 'rejected', status_detail: 'cc_rejected_other_reason', transaction_amount: 50, external_reference: posC!.externalId })
    assert.equal((await m.settle.settleQrPayment(String(rej.id))).creditedCents, 0)
    assert.equal((await payRow(String(rej.id))).status, 'rejected')
    assert.equal(await balance(u.c), c0 + 30_000)
  })

  it('no acredita monedas que no sean pesos', async () => {
    const posC = await m.qr.getUserPos(u.c)
    const c0 = await balance(u.c)
    const p = mp.payment({ currency_id: 'USD', transaction_amount: 10, external_reference: posC!.externalId })
    assert.equal((await m.settle.settleQrPayment(String(p.id))).creditedCents, 0)
    assert.equal((await payRow(String(p.id))).status, 'ignored')
    assert.equal(await balance(u.c), c0)
  })

  it('una devolución descuenta lo acreditado, una sola vez, y las parciales suman hasta el total', async () => {
    const posA = await m.qr.getUserPos(u.a)
    const p = mp.payment({ transaction_amount: 1000, external_reference: posA!.externalId })
    const id = String(p.id)
    await m.settle.settleQrPayment(id)
    const afterCredit = await balance(u.a)

    p.transaction_amount_refunded = 250 // devolución parcial
    const r1 = await m.settle.settleQrPayment(id)
    assert.equal(r1.reversedCents, 25_000)
    assert.equal((await m.settle.settleQrPayment(id)).reversedCents, 0, 'repetir el aviso no descuenta de nuevo')
    assert.equal(await balance(u.a), afterCredit - 25_000)
    assert.equal((await payRow(id)).status, 'credited')

    p.status = 'refunded'
    p.transaction_amount_refunded = 1000 // devolución total
    const r2 = await m.settle.settleQrPayment(id)
    assert.equal(r2.reversedCents, 75_000)
    assert.equal(await balance(u.a), afterCredit - 100_000)
    const row = await payRow(id)
    assert.equal(row.status, 'reversed')
    assert.equal(row.reversedAmount, '1000.00')
  })

  it('si la persona ya gastó el dinero, la devolución queda PENDIENTE y la billetera no se va a negativo', async () => {
    const posC = await m.qr.getUserPos(u.c)
    const p = mp.payment({ transaction_amount: 5000, external_reference: posC!.externalId })
    const id = String(p.id)
    await m.settle.settleQrPayment(id)
    // Gasta todo el saldo.
    const [w] = await m.db.select().from(m.schema.walletAccount).where(m.eq(m.schema.walletAccount.userId, u.c))
    await m.db.transaction(async (tx) => {
      const locked = (await m.ledger.lockWallets(tx, [w.id])).get(w.id)!
      await m.ledger.postMovement(tx, locked, { direction: 'debit', kind: 'p2p_out', cents: await balance(u.c) })
    })
    assert.equal(await balance(u.c), 0)

    p.status = 'charged_back'
    const r = await m.settle.settleQrPayment(id)
    assert.equal(r.reversedCents, 0)
    assert.equal(r.status, 'reversal_pending')
    assert.equal(await balance(u.c), 0, 'sigue en cero, nunca negativo')
    assert.match(String((await payRow(id)).note), /administración/)
  })

  it('una billetera bloqueada igual recibe el dinero que Mercado Pago ya cobró', async () => {
    const posB = await m.qr.getUserPos(u.b)
    await m.db.update(m.schema.walletAccount).set({ status: 'blocked' }).where(m.eq(m.schema.walletAccount.userId, u.b))
    const b0 = await balance(u.b)
    const p = mp.payment({ transaction_amount: 100, external_reference: posB!.externalId })
    assert.equal((await m.settle.settleQrPayment(String(p.id))).creditedCents, 10_000)
    assert.equal(await balance(u.b), b0 + 10_000)
    await m.db.update(m.schema.walletAccount).set({ status: 'active' }).where(m.eq(m.schema.walletAccount.userId, u.b))
  })

  it('con MERCADO_PAGO_QR_CREDIT=net se acredita lo que recibe la empresa, descontada la comisión', async () => {
    process.env.MERCADO_PAGO_QR_CREDIT = 'net'
    try {
      const posB = await m.qr.getUserPos(u.b)
      const b0 = await balance(u.b)
      const p = mp.payment({ transaction_amount: 1000, external_reference: posB!.externalId, transaction_details: { net_received_amount: 992.5 } })
      assert.equal((await m.settle.settleQrPayment(String(p.id))).creditedCents, 99_250)
      assert.equal(await balance(u.b), b0 + 99_250)
    } finally {
      delete process.env.MERCADO_PAGO_QR_CREDIT
    }
  })

  it('syncQrOrder: acredita lo cobrado, marca vencidas y anuladas', async () => {
    const paid = await m.qr.createQrOrder({ userId: u.a, cents: 40_000, ttlMinutes: 30 })
    const exp = await m.qr.createQrOrder({ userId: u.a, cents: 10_000, ttlMinutes: 30 })
    const can = await m.qr.createQrOrder({ userId: u.a, cents: 20_000, ttlMinutes: 30 })
    const a0 = await balance(u.a)

    const pay = mp.payment({ transaction_amount: 400, external_reference: paid.order.externalReference, order: { id: paid.order.mpOrderId } })
    const o = mp.st.orders.get(paid.order.mpOrderId!)!
    o.status = 'processed'
    // Forma real de la API de órdenes: id interno PAY… y el número del pago en reference_id.
    ;(o.transactions as Rec).payments = [{ id: 'PAY01TEST' + String(pay.id), reference_id: String(pay.id), status: 'processed', status_detail: 'accredited' }]
    const s1 = await m.settle.syncQrOrder(paid.order.id)
    assert.equal(s1.status, 'paid')
    assert.equal(s1.creditedCents, 40_000)
    assert.equal(await balance(u.a), a0 + 40_000)

    mp.st.orders.get(exp.order.mpOrderId!)!.status = 'expired'
    assert.equal((await m.settle.syncQrOrder(exp.order.id)).status, 'expired')

    mp.st.orders.get(can.order.mpOrderId!)!.status = 'canceled'
    assert.equal((await m.settle.syncQrOrder(can.order.id)).status, 'cancelled')
    assert.equal(await balance(u.a), a0 + 40_000, 'vencer o anular no mueve dinero')
  })

  it('los pagos de una orden se identifican por reference_id (el id PAY… no se puede consultar)', () => {
    const ids = m.qr.paymentIdsOfOrder({
      transactions: { payments: [
        { id: 'PAY01ABC', reference_id: '183403935234', status: 'processed' },
        { id: 'PAY01DEF', status: 'processed' }, // sin número real: no se puede consultar
        { id: '555', status: 'approved' }, // forma antigua con id numérico
        { id: 'PAY01XYZ', reference_id: '777', status: 'failed' }, // no procesado
      ] },
    })
    assert.deepEqual(ids, ['183403935234', '555'])
    assert.deepEqual(m.qr.paymentIdsOfOrder(null), [])
  })

  it('anular un QR en Mercado Pago funciona mientras no lo hayan pagado', async () => {
    const { order } = await m.qr.createQrOrder({ userId: u.b, cents: 5_000, ttlMinutes: 15 })
    const ok = await m.qr.cancelQrOrderInMp(order.mpOrderId!)
    assert.equal(ok.ok, true)
    const again = await m.qr.cancelQrOrderInMp(order.mpOrderId!)
    assert.equal(again.ok, false, 'ya anulado: Mercado Pago responde con error')
  })

  it('reconcileQr recupera pagos de la caja aunque no haya llegado el aviso, y filtra los de otras cajas', async () => {
    const posB = await m.qr.getUserPos(u.b)
    const b0 = await balance(u.b)
    const mine = mp.payment({ transaction_amount: 250, external_reference: posB!.externalId, pos_id: posB!.mpPosId })
    const others = mp.payment({ transaction_amount: 9999, external_reference: 'OTRACAJA', pos_id: '99999' })
    const r = await m.settle.reconcileQr({ userId: u.b })
    assert.equal(r.creditedCents >= 25_000, true)
    assert.equal(await balance(u.b) >= b0 + 25_000, true)
    assert.equal((await payRow(String(mine.id))).status, 'credited')
    assert.equal(await payRow(String(others.id)), undefined, 'un pago de otra caja no se toca')
    // Y volver a conciliar no repite nada.
    const b1 = await balance(u.b)
    await m.settle.reconcileQr({ userId: u.b })
    assert.equal(await balance(u.b), b1)
  })

  it('la firma de las notificaciones se valida (HMAC, id en minúsculas, vigencia)', async () => {
    const secret = 'whsec_test'
    const ts = String(Math.floor(Date.now() / 1000))
    const sign = (id: string, reqId: string, t = ts) => `ts=${t},v1=${createHmac('sha256', secret).update(`id:${id.toLowerCase()};request-id:${reqId};ts:${t}`).digest('hex')}`
    const base = { secret, toleranceSeconds: 900 }
    assert.equal(m.client.verifyMpWebhookSignature({ ...base, xSignature: sign('ORD01ABC', 'r1'), xRequestId: 'r1', dataId: 'ORD01ABC' }), true, 'las órdenes llegan en mayúsculas y se firman en minúsculas')
    assert.equal(m.client.verifyMpWebhookSignature({ ...base, xSignature: sign('123', 'r1'), xRequestId: 'r1', dataId: '124' }), false, 'otro id')
    assert.equal(m.client.verifyMpWebhookSignature({ ...base, xSignature: sign('123', 'r1'), xRequestId: 'r2', dataId: '123' }), false, 'otro request-id')
    assert.equal(m.client.verifyMpWebhookSignature({ ...base, xSignature: sign('123', 'r1'), xRequestId: 'r1', dataId: '123', secret: 'otro' }), false, 'otro secreto')
    const old = String(Math.floor(Date.now() / 1000) - 3600)
    assert.equal(m.client.verifyMpWebhookSignature({ ...base, xSignature: sign('123', 'r1', old), xRequestId: 'r1', dataId: '123' }), false, 'vencida')
    assert.equal(m.client.verifyMpWebhookSignature({ ...base, xSignature: null, xRequestId: 'r1', dataId: '123' }), false)
    assert.equal(m.client.verifyMpWebhookSignature({ ...base, xSignature: sign('123', 'r1'), xRequestId: 'r1', dataId: '' }), false)
    assert.equal(m.client.verifyMpWebhookSignature({ xSignature: sign('123', 'r1'), xRequestId: 'r1', dataId: '123', secret: '' }), false, 'sin secreto configurado rechaza todo')
  })

  it('la ruta del webhook rechaza lo no firmado y acredita lo firmado', async () => {
    const route = await import('../../app/api/webhooks/mercadopago/route')
    const { NextRequest } = await import('next/server')
    const posB = await m.qr.getUserPos(u.b)
    const p = mp.payment({ transaction_amount: 60, external_reference: posB!.externalId })
    const id = String(p.id)
    const b0 = await balance(u.b)

    const unsigned = await route.POST(new NextRequest('http://localhost/api/webhooks/mercadopago', { method: 'POST', body: JSON.stringify({ type: 'payment', data: { id } }) }))
    assert.equal(unsigned.status, 401)
    assert.equal(await balance(u.b), b0)

    const ts = String(Math.floor(Date.now() / 1000))
    const v1 = createHmac('sha256', 'whsec_test').update(`id:${id};request-id:req-1;ts:${ts}`).digest('hex')
    const signed = await route.POST(
      new NextRequest(`http://localhost/api/webhooks/mercadopago?data.id=${id}&type=payment`, {
        method: 'POST',
        headers: { 'x-signature': `ts=${ts},v1=${v1}`, 'x-request-id': 'req-1' },
        body: JSON.stringify({ type: 'payment', data: { id } }),
      }),
    )
    assert.equal(signed.status, 200)
    const out = (await signed.json()) as Rec
    assert.equal(out.matched, true)
    assert.equal(await balance(u.b), b0 + 6_000)

    // Una orden que no es nuestra (p. ej. de `unicred`) se responde 200 y se ignora, sin reintentos.
    const ts2 = String(Math.floor(Date.now() / 1000))
    const v2 = createHmac('sha256', 'whsec_test').update(`id:ord99999;request-id:req-2;ts:${ts2}`).digest('hex')
    const foreign = await route.POST(
      new NextRequest('http://localhost/api/webhooks/mercadopago?data.id=ORD99999&type=order', {
        method: 'POST',
        headers: { 'x-signature': `ts=${ts2},v1=${v2}`, 'x-request-id': 'req-2' },
        body: JSON.stringify({ type: 'order', data: { id: 'ORD99999' } }),
      }),
    )
    assert.equal(foreign.status, 200)
    assert.equal(((await foreign.json()) as Rec).matched, false)
    // En unicred el GET de esta ruta es el healthcheck público que usa el smoke test (no revela secretos).
    assert.equal((await route.GET()).status, 200)
  })

  it('los controles de integridad de los cobros QR dan 0 en lo crítico y marcan lo pendiente', async () => {
    const res = await m.integrity.runIntegrityChecks([
      'mpqr-credited-no-movement',
      'mpqr-movement-no-payment',
      'mpqr-amount-mismatch',
      'mpqr-wallet-mismatch',
      'mpqr-reversed-excess',
      'mpqr-order-paid-no-payment',
      'mpqr-pos-wallet',
      'mpqr-reversal-pending',
      'mpqr-unmatched',
    ])
    for (const r of res) assert.equal(r.error, undefined, `${r.id}: ${r.error}`)
    const by = Object.fromEntries(res.map((r) => [r.id, r.count]))
    assert.equal(by['mpqr-credited-no-movement'], 0)
    assert.equal(by['mpqr-movement-no-payment'], 0)
    assert.equal(by['mpqr-amount-mismatch'], 0)
    assert.equal(by['mpqr-wallet-mismatch'], 0)
    assert.equal(by['mpqr-reversed-excess'], 0)
    assert.equal(by['mpqr-order-paid-no-payment'], 0)
    assert.equal(by['mpqr-pos-wallet'], 0)
    assert.ok(by['mpqr-reversal-pending'] >= 1, 'la devolución sin saldo tiene que figurar')
    assert.ok(by['mpqr-unmatched'] >= 1, 'el pago sin asignar tiene que figurar')
    // Y el saldo de cada billetera sigue cerrando con sus movimientos.
    const wallet = await m.integrity.runIntegrityChecks(['wallet-balance-vs-movements', 'wallet-negative'])
    for (const r of wallet) assert.equal(r.count, 0, r.title)
  })
})
