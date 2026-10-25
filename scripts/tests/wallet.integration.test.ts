import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'

/**
 * Prueba de integración del libro mayor contra Postgres. Solo corre si WALLET_TEST_DATABASE_URL apunta a una base
 * LOCAL (localhost / 127.0.0.1): nunca toca producción. Prepará la base con `npm run db:bootstrap` apuntando a ella.
 *
 *   WALLET_TEST_DATABASE_URL=postgres://postgres:dev@127.0.0.1:54329/verify npm test
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

run('billetera (integración)', () => {
  // Se importa después de fijar DATABASE_URL: lib/db lee la variable al cargarse.
  let m: {
    db: typeof import('../../lib/db').db
    pool: typeof import('../../lib/db').pool
    schema: typeof import('../../lib/db/schema')
    ledger: typeof import('../../lib/wallet/ledger')
    payouts: typeof import('../../lib/wallet/payouts')
    disb: typeof import('../../lib/wallet/disbursement')
    qr: typeof import('../../lib/wallet/qr')
    eq: typeof import('drizzle-orm').eq
    sql: typeof import('drizzle-orm').sql
  }
  const tag = crypto.randomUUID().slice(0, 8)
  const ids = { a: `t_a_${tag}`, b: `t_b_${tag}` }
  const cuilA = '20301234563'

  async function newUser(id: string, kycApproved: boolean, cuil: string | null) {
    const { db, schema } = m
    const now = new Date()
    await db.insert(schema.user).values({ id, name: `Test ${id}`, email: `${id}@example.test`, createdAt: now, updatedAt: now })
    await db.insert(schema.profile).values({
      id: `p_${id}`,
      userId: id,
      cuil,
      dni: cuil ? cuil.slice(2, 10) : null,
      kycStatus: kycApproved ? 'approved' : 'pending',
      createdAt: now,
      updatedAt: now,
    })
    await db.insert(schema.kycVerification).values({
      id: `k_${id}`,
      userId: id,
      status: kycApproved ? 'approved' : 'pending',
      provider: 'didit',
      createdAt: now,
      updatedAt: now,
    })
  }

  async function fund(userId: string, cents: number) {
    const w = await m.ledger.ensureWallet(userId)
    await m.db.transaction(async (tx) => {
      const locked = await m.ledger.lockWallets(tx, [w.id])
      await m.ledger.postMovement(tx, locked.get(w.id)!, {
        direction: 'credit',
        kind: 'admin_adjustment',
        cents,
        externalId: `seed-${userId}-${crypto.randomUUID()}`,
      })
    })
    return w
  }

  async function balanceCents(userId: string) {
    const [w] = await m.db.select().from(m.schema.walletAccount).where(m.eq(m.schema.walletAccount.userId, userId))
    return m.ledger.centsOf(w.balance)
  }

  async function conserved(userId: string) {
    const { rows } = await m.pool.query(
      `select w.balance::text as balance,
              coalesce(sum(case when m.direction in ('credit','in') then m.amount else -m.amount end),0)::text as movimientos
         from wallet_account w left join wallet_movement m on m."walletId" = w.id
        where w."userId" = $1 group by w.balance`,
      [userId],
    )
    return Number(rows[0].balance) === Number(rows[0].movimientos)
  }

  before(async () => {
    process.env.DATABASE_URL = url
    process.env.BETTER_AUTH_SECRET = 'test-secret-0123456789-abcdefghijklmnopqrstuvwxyz'
    const [{ db, pool }, schema, ledger, payouts, disb, qr, drizzle] = await Promise.all([
      import('../../lib/db'),
      import('../../lib/db/schema'),
      import('../../lib/wallet/ledger'),
      import('../../lib/wallet/payouts'),
      import('../../lib/wallet/disbursement'),
      import('../../lib/wallet/qr'),
      import('drizzle-orm'),
    ])
    m = { db, pool, schema, ledger, payouts, disb, qr, eq: drizzle.eq, sql: drizzle.sql }
    await newUser(ids.a, true, cuilA)
    await newUser(ids.b, true, '27111222339')
    // Los admins de las pruebas existen como usuarios para que la auditoría (FK) se registre de verdad.
    for (const a of ['admin1', 'admin2', 'admin3', 'a1', 'a2', 'a3']) {
      const now = new Date()
      await m.db.insert(m.schema.user).values({ id: `${a}_${tag}`, name: a, email: `${a}_${tag}@example.test`, role: 'admin', createdAt: now, updatedAt: now })
    }
  })

  after(async () => {
    if (m) await m.pool.end()
  })

  it('crea una billetera por persona, con CVU y alias estables', async () => {
    const w1 = await m.ledger.ensureWallet(ids.a)
    const w2 = await m.ledger.ensureWallet(ids.a)
    assert.equal(w1.id, w2.id)
    assert.match(w1.cvu, /^0003220\d{15}$/)
    assert.match(w1.alias, /^unicred\.[0-9a-f]{8}$/)
    assert.equal(m.ledger.centsOf(w1.balance), 0)
  })

  it('transfiere entre billeteras y respeta saldo, bloqueo y autotransferencia', async () => {
    await fund(ids.a, 10_000)
    const b = await m.ledger.ensureWallet(ids.b)
    const r = await m.ledger.transferInternal({ fromUserId: ids.a, to: b, cents: 2_500, concept: 'prueba', channel: 'transfer' })
    assert.equal(r.balanceAfterCents, 7_500)
    assert.equal(await balanceCents(ids.b), 2_500)

    await assert.rejects(m.ledger.transferInternal({ fromUserId: ids.a, to: b, cents: 50_000, channel: 'transfer' }), /Saldo insuficiente/)
    const a = await m.ledger.ensureWallet(ids.a)
    await assert.rejects(m.ledger.transferInternal({ fromUserId: ids.a, to: a, cents: 100, channel: 'transfer' }), /propia billetera/)

    await m.db.update(m.schema.walletAccount).set({ status: 'blocked' }).where(m.eq(m.schema.walletAccount.id, b.id))
    await assert.rejects(m.ledger.transferInternal({ fromUserId: ids.a, to: { ...b, status: 'blocked' }, cents: 100, channel: 'transfer' }), /no puede recibir/)
    await m.db.update(m.schema.walletAccount).set({ status: 'active' }).where(m.eq(m.schema.walletAccount.id, b.id))
    assert.ok(await conserved(ids.a))
    assert.ok(await conserved(ids.b))
  })

  it('la misma referencia no se transfiere dos veces (idempotencia)', async () => {
    const b = await m.ledger.ensureWallet(ids.b)
    const before = await balanceCents(ids.a)
    const ref = `UC-TEST-${tag}`
    await m.ledger.transferInternal({ fromUserId: ids.a, to: b, cents: 100, channel: 'qr', reference: ref })
    await m.ledger.transferInternal({ fromUserId: ids.a, to: b, cents: 100, channel: 'qr', reference: ref })
    assert.equal(await balanceCents(ids.a), before - 100)
  })

  it('con pedidos simultáneos nunca deja el saldo en negativo ni crea dinero', async () => {
    const { rows } = await m.pool.query(`select balance::text b from wallet_account where "userId"=$1`, [ids.a])
    const startA = m.ledger.centsOf(rows[0].b)
    const startB = await balanceCents(ids.b)
    const b = await m.ledger.ensureWallet(ids.b)
    const each = Math.floor(startA / 3) + 1 // 3 caben, el 4.º no
    const results = await Promise.allSettled(
      Array.from({ length: 6 }, () => m.ledger.transferInternal({ fromUserId: ids.a, to: b, cents: each, channel: 'transfer' })),
    )
    const ok = results.filter((r) => r.status === 'fulfilled').length
    assert.equal(ok, 2, 'solo 2 transferencias entran en el saldo')
    const endA = await balanceCents(ids.a)
    assert.ok(endA >= 0)
    assert.equal(endA, startA - ok * each)
    assert.equal(await balanceCents(ids.b), startB + ok * each)
    assert.ok((await conserved(ids.a)) && (await conserved(ids.b)))
  })

  it('el QR va firmado: no se puede alterar y vence', async () => {
    const w = await m.ledger.ensureWallet(ids.a)
    const token = m.qr.createQrToken({ walletId: w.id, cents: 1_500, concept: 'Mesa 4' })
    const ok = m.qr.verifyQrToken(token)
    assert.ok(ok.ok && ok.payload.a === 1_500 && ok.payload.w === w.id)
    const [p, body, sig] = token.split('.')
    const forged = Buffer.from(JSON.stringify({ ...(ok.ok ? ok.payload : {}), a: 1 })).toString('base64url')
    assert.equal(m.qr.verifyQrToken(`${p}.${forged}.${sig}`).ok, false)
    assert.equal(m.qr.verifyQrToken(`${p}.${body}.${sig}x`).ok, false)
    const shortLived = m.qr.createQrToken({ walletId: w.id, ttlMinutes: 0.01 })
    assert.equal(m.qr.verifyQrToken(shortLived).ok, true)
    await new Promise((r) => setTimeout(r, 2500))
    const late = m.qr.verifyQrToken(shortLived)
    assert.ok(!late.ok && late.reason === 'expired')
    assert.equal(m.qr.extractQrToken(m.qr.qrPayUrl(token)), token)
  })

  async function ownAccount(userId: string, holderCuil: string, cbu: string, verified = true) {
    const id = `ba_${crypto.randomUUID().slice(0, 8)}`
    await m.db.insert(m.schema.bankAccount).values({
      id,
      userId,
      accountType: 'cbu',
      bankName: 'Banco de prueba',
      accountNumber: cbu,
      cbu,
      holderName: 'Titular',
      holderCuil,
      isVerified: verified,
      isPrimary: false,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    return id
  }
  const CBU = '0070999030004123456789'

  it('retiro: solo a cuentas propias verificadas; el saldo se retiene hasta que el admin lo resuelve', async () => {
    await fund(ids.a, 50_000)
    const mine = await ownAccount(ids.a, cuilA, CBU)
    const foreign = await ownAccount(ids.a, '27111222339', CBU.replace(/9$/, '8'))
    const unverified = await ownAccount(ids.a, cuilA, CBU.replace(/9$/, '7'), false)

    await assert.rejects(m.payouts.requestPayout({ userId: ids.a, accountId: foreign, cents: 20_000 }), /titular/)
    await assert.rejects(m.payouts.requestPayout({ userId: ids.a, accountId: unverified, cents: 20_000 }), /verificada/)
    await assert.rejects(m.payouts.requestPayout({ userId: ids.a, accountId: mine, cents: 500 }), /entre/)

    const before = await balanceCents(ids.a)
    const req = await m.payouts.requestPayout({ userId: ids.a, accountId: mine, cents: 20_000 })
    assert.equal(await balanceCents(ids.a), before - 20_000)
    const [row] = await m.db.select().from(m.schema.walletPayout).where(m.eq(m.schema.walletPayout.id, req.payoutId))
    assert.equal(row.status, 'queued')
    assert.equal(row.destinationValue, CBU)

    await assert.rejects(m.payouts.approveExecutedPayout({ adminId: `admin1_${tag}`, payoutId: req.payoutId, bankReference: 'x' }), /referencia/)
    await m.payouts.approveExecutedPayout({ adminId: `admin1_${tag}`, payoutId: req.payoutId, bankReference: 'OP-123456' })
    const [done] = await m.db.select().from(m.schema.walletPayout).where(m.eq(m.schema.walletPayout.id, req.payoutId))
    assert.equal(done.status, 'executed')
    assert.equal((done.providerPayload as { bankReference: string }).bankReference, 'OP-123456')
    await assert.rejects(m.payouts.approveExecutedPayout({ adminId: `admin2_${tag}`, payoutId: req.payoutId, bankReference: 'OP-999999' }), /ya fue resuelta/)
    await assert.rejects(m.payouts.rejectPayout({ adminId: `admin2_${tag}`, payoutId: req.payoutId, reason: 'rechazo tardío de prueba' }), /ya fue resuelta/)
    assert.equal(await balanceCents(ids.a), before - 20_000)
    assert.ok(await conserved(ids.a))
  })

  it('retiro rechazado o cancelado devuelve el dinero una sola vez, aun con pedidos simultáneos', async () => {
    const acc = await ownAccount(ids.a, cuilA, CBU.replace(/9$/, '6'))
    await fund(ids.a, 30_000)
    const before = await balanceCents(ids.a)
    const req = await m.payouts.requestPayout({ userId: ids.a, accountId: acc, cents: 12_000 })
    const outcomes = await Promise.allSettled([
      m.payouts.rejectPayout({ adminId: `admin1_${tag}`, payoutId: req.payoutId, reason: 'datos bancarios inconsistentes' }),
      m.payouts.rejectPayout({ adminId: `admin2_${tag}`, payoutId: req.payoutId, reason: 'datos bancarios inconsistentes' }),
      m.payouts.approveExecutedPayout({ adminId: `admin3_${tag}`, payoutId: req.payoutId, bankReference: 'OP-777777' }),
      m.payouts.cancelOwnPayout(ids.a, req.payoutId),
    ])
    assert.equal(outcomes.filter((o) => o.status === 'fulfilled').length, 1, 'exactamente una resolución gana')
    const [row] = await m.db.select().from(m.schema.walletPayout).where(m.eq(m.schema.walletPayout.id, req.payoutId))
    const expected = row.status === 'executed' ? before - 12_000 : before
    assert.equal(await balanceCents(ids.a), expected)
    assert.ok(await conserved(ids.a))
  })

  it('no deja mandar dinero sin identidad verificada', async () => {
    const id = `t_c_${tag}`
    await newUser(id, false, '20222333441')
    await fund(id, 5_000)
    const b = await m.ledger.ensureWallet(ids.b)
    const { assertIdentityVerified } = await import('../../lib/wallet/guards')
    await assert.rejects(assertIdentityVerified(id), /verificar tu identidad/)
    await assert.rejects(m.payouts.requestPayout({ userId: id, accountId: 'x', cents: 20_000 }), /verificar tu identidad/)
    void b
  })

  it('desembolso: acredita el capital, activa el crédito, arma las cuotas y no se repite', async () => {
    const loanId = `loan_${tag}`
    const now = new Date()
    await m.db.insert(m.schema.loan).values({
      id: loanId,
      userId: ids.b,
      principal: '100000.00',
      term: 6,
      monthlyRate: '7.500',
      tna: '90.000',
      installmentAmount: '21500.00',
      totalAmount: '129000.00',
      status: 'approved',
      createdAt: now,
      updatedAt: now,
    })
    await assert.rejects(m.disb.disburseLoanToWallet({ adminId: `admin1_${tag}`, loanId }), /contrato/)
    await m.db.insert(m.schema.loanContract).values({ id: `lc_${tag}`, loanId, userId: ids.b, status: 'pending_acceptance', createdAt: now, updatedAt: now })
    await assert.rejects(m.disb.disburseLoanToWallet({ adminId: `admin1_${tag}`, loanId }), /aceptar el contrato/)
    await m.db.update(m.schema.loanContract).set({ status: 'accepted', acceptedAt: now }).where(m.eq(m.schema.loanContract.loanId, loanId))

    const before = await balanceCents(ids.b)
    const out = await m.disb.disburseLoanToWallet({ adminId: `admin1_${tag}`, loanId })
    assert.equal(await balanceCents(ids.b), before + 10_000_000)
    const [ln] = await m.db.select().from(m.schema.loan).where(m.eq(m.schema.loan.id, loanId))
    assert.equal(ln.status, 'active')
    assert.ok(ln.disbursedAt)
    const inst = await m.db.select().from(m.schema.installment).where(m.eq(m.schema.installment.loanId, loanId))
    assert.equal(inst.length, 6)
    const [rcpt] = await m.db.select().from(m.schema.paymentReceipt).where(m.eq(m.schema.paymentReceipt.receiptNumber, out.receiptNumber))
    assert.equal(rcpt.receiptType, 'disbursement')

    await assert.rejects(m.disb.disburseLoanToWallet({ adminId: `admin2_${tag}`, loanId }), /desembols|acreditado/)
    assert.equal(await balanceCents(ids.b), before + 10_000_000)
    assert.ok(await conserved(ids.b))
  })

  it('desembolsos simultáneos acreditan una sola vez', async () => {
    const loanId = `loan2_${tag}`
    const now = new Date()
    await m.db.insert(m.schema.loan).values({
      id: loanId, userId: ids.b, principal: '50000.00', term: 3, monthlyRate: '7.500', tna: '90.000',
      installmentAmount: '19000.00', totalAmount: '57000.00', status: 'approved', createdAt: now, updatedAt: now,
    })
    await m.db.insert(m.schema.loanContract).values({ id: `lc2_${tag}`, loanId, userId: ids.b, status: 'accepted', acceptedAt: now, createdAt: now, updatedAt: now })
    const before = await balanceCents(ids.b)
    const res = await Promise.allSettled([
      m.disb.disburseLoanToWallet({ adminId: `a1_${tag}`, loanId }),
      m.disb.disburseLoanToWallet({ adminId: `a2_${tag}`, loanId }),
      m.disb.disburseLoanToWallet({ adminId: `a3_${tag}`, loanId }),
    ])
    assert.equal(res.filter((r) => r.status === 'fulfilled').length, 1)
    assert.equal(await balanceCents(ids.b), before + 5_000_000)
    assert.ok(await conserved(ids.b))
  })
})
