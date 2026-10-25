import { sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { POSTED_SQL } from '@/lib/wallet/display'

const POSTED = sql.raw(POSTED_SQL)

/**
 * Controles de integridad y conciliación de los datos (solo lectura). Cada control busca filas que rompen una regla del
 * negocio: dinero que no cierra, estados contradictorios, documentos sin respaldo, duplicados. Se usan en
 * `/admin/conciliacion` y en `npm run audit:data`.
 *
 * Severidad: `critical` = el dinero o el estado legal no cierra · `warning` = inconsistencia que conviene corregir ·
 * `info` = dato a revisar, no necesariamente un error.
 */

export type Severity = 'critical' | 'warning' | 'info'
export type IntegrityCheck = { id: string; area: string; title: string; why: string; severity: Severity; query: ReturnType<typeof sql>; requires?: string[] }
export type IntegrityResult = Omit<IntegrityCheck, 'query'> & { count: number; sample: Array<Record<string, unknown>>; error?: string }

const C = (id: string, area: string, severity: Severity, title: string, why: string, query: ReturnType<typeof sql>): IntegrityCheck => ({ id, area, severity, title, why, query })
/** Control sobre tablas propias de esta app: si todavía no existen (nadie activó cobros QR) no hay nada que controlar. */
const CT = (requires: string[], ...args: Parameters<typeof C>): IntegrityCheck => ({ ...C(...args), requires })

export const CHECKS: IntegrityCheck[] = [
  /* ------------------------------- Billetera ------------------------------ */
  C('wallet-balance-vs-movements', 'Billetera', 'critical', 'El saldo no coincide con la suma de los movimientos',
    'El saldo de una billetera tiene que ser igual a la suma de sus créditos menos sus débitos.',
    sql`select w.id, w.alias, w.balance::text saldo, coalesce(sum(case when m.direction in ('credit','in') then m.amount else -m.amount end),0)::text movimientos
          from wallet_account w left join wallet_movement m on m."walletId" = w.id and ${POSTED}
         group by w.id, w.alias, w.balance
        having w.balance <> coalesce(sum(case when m.direction in ('credit','in') then m.amount else -m.amount end),0)`),
  C('wallet-negative', 'Billetera', 'critical', 'Billeteras con saldo negativo', 'Una billetera nunca puede quedar en negativo.',
    sql`select id, alias, balance::text saldo from wallet_account where balance < 0`),
  C('wallet-chain', 'Billetera', 'warning', 'El saldo posterior de un movimiento no encadena con el anterior',
    'Cada asiento deja el saldo resultante: tiene que ser el anterior más o menos el importe.',
    sql`select * from (
          select m.id, m."walletId", m.kind, m.amount::text importe, m."balanceAfter"::text saldo_posterior,
                 (lag(m."balanceAfter") over (partition by m."walletId" order by m."createdAt", m.id) +
                  case when m.direction in ('credit','in') then m.amount else -m.amount end)::text esperado
            from wallet_movement m where ${POSTED}) t
         where esperado is not null and esperado::numeric <> saldo_posterior::numeric`),
  C('payout-executed-no-ref', 'Retiros', 'warning', 'Retiros enviados sin referencia bancaria', 'Un retiro aprobado tiene que guardar el número de operación del banco.',
    sql`select id, reference, amount::text importe from wallet_payout where status = 'executed' and coalesce("providerPayload"->>'bankReference','') = ''`),
  C('payout-queued-old', 'Retiros', 'info', 'Retiros en cola hace más de 3 días', 'Dinero retenido que nadie resolvió.',
    sql`select id, reference, amount::text importe, "createdAt" from wallet_payout where status = 'queued' and "createdAt" < now() - interval '3 days'`),
  C('payout-cancelled-no-refund', 'Retiros', 'critical', 'Retiros cancelados sin devolución al saldo', 'Un retiro rechazado o cancelado tiene que devolver el importe.',
    sql`select p.id, p.reference, p.amount::text importe from wallet_payout p
         where p.status in ('cancelled','failed') and not exists (select 1 from wallet_movement m where m."payoutId" = p.id and m.kind = 'payout_refund')
           and exists (select 1 from wallet_movement m where m."payoutId" = p.id)`),

  /* -------------------------------- Créditos ------------------------------ */
  C('loan-active-no-disbursed', 'Créditos', 'critical', 'Créditos vigentes o saldados sin fecha de desembolso', 'Un crédito que se desembolsó tiene fecha de acreditación.',
    sql`select id, status, principal::text capital from loan where status in ('active','paid') and "disbursedAt" is null`),
  C('loan-disbursed-bad-status', 'Créditos', 'warning', 'Créditos con desembolso pero en un estado que no corresponde', 'Con dinero entregado, el crédito está vigente, saldado o anulado.',
    sql`select id, status, "disbursedAt" from loan where "disbursedAt" is not null and status in ('pending','approved','rejected')`),
  C('loan-no-installments', 'Créditos', 'critical', 'Créditos vigentes sin plan de cuotas', 'Un crédito vigente tiene sus cuotas.',
    sql`select l.id, l.term from loan l where l.status = 'active' and not exists (select 1 from installment i where i."loanId" = l.id)`),
  C('loan-term-mismatch', 'Créditos', 'warning', 'La cantidad de cuotas no coincide con el plazo', 'El plan tiene tantas cuotas como el plazo del crédito.',
    sql`select l.id, l.status, l.term, count(i.id)::int cuotas from loan l join installment i on i."loanId" = l.id
         where l.status in ('active','paid') group by l.id, l.status, l.term having count(i.id) <> l.term`),
  C('loan-total-vs-installments', 'Créditos', 'warning', 'El total del crédito no coincide con la suma de las cuotas', 'Total a pagar = suma de las cuotas (se tolera $1 por redondeo).',
    sql`select l.id, l.status, l."totalAmount"::text total, sum(i.amount)::text suma_cuotas from loan l join installment i on i."loanId" = l.id
         where l.status in ('active','paid') group by l.id, l.status, l."totalAmount" having abs(sum(i.amount) - l."totalAmount") > 1`),
  C('loan-installment-amount', 'Créditos', 'warning', 'La cuota informada no coincide con la primera cuota del plan', 'La cuota del crédito tiene que ser la del cronograma.',
    sql`select l.id, l."installmentAmount"::text cuota_credito, min(i.amount)::text cuota_plan from loan l join installment i on i."loanId" = l.id
         where l.status in ('active','paid') group by l.id, l."installmentAmount" having abs(l."installmentAmount" - min(i.amount)) > 0.5 and max(i.amount) = min(i.amount)`),
  C('loan-installment-gaps', 'Créditos', 'critical', 'Cuotas con numeración repetida o con saltos', 'Las cuotas van de 1 a N sin repetirse.',
    sql`select i."loanId", count(*)::int cuotas, max(i.number) maximo, count(distinct i.number)::int distintas from installment i
         group by i."loanId" having count(*) <> max(i.number) or count(*) <> count(distinct i.number)`),
  C('loan-paid-open', 'Créditos', 'critical', 'Créditos saldados con cuotas abiertas', 'Un crédito saldado no tiene cuotas pendientes.',
    sql`select l.id, count(*)::int abiertas from loan l join installment i on i."loanId" = l.id where l.status = 'paid' and i.status in ('pending','overdue') group by l.id`),
  C('loan-active-all-paid', 'Créditos', 'warning', 'Créditos vigentes con todas las cuotas pagas', 'Si no queda nada por pagar, el crédito está saldado.',
    sql`select l.id from loan l where l.status = 'active' and exists (select 1 from installment i where i."loanId" = l.id)
          and not exists (select 1 from installment i where i."loanId" = l.id and i.status not in ('paid','cancelled'))`),
  C('loan-approved-stuck', 'Créditos', 'info', 'Créditos aprobados con contrato firmado y sin acreditar', 'Se firmó y el dinero no se entregó.',
    sql`select l.id, l.principal::text capital, c."acceptedAt" from loan l join loan_contract c on c."loanId" = l.id
         where l.status = 'approved' and c.status = 'accepted' and l."disbursedAt" is null`),
  C('loan-approved-no-contract', 'Créditos', 'warning', 'Créditos aprobados sin contrato', 'Un crédito aprobado tiene su contrato emitido.',
    sql`select l.id, l.principal::text capital from loan l where l.status = 'approved' and not exists (select 1 from loan_contract c where c."loanId" = l.id)`),
  C('installment-paid-no-date', 'Cuotas', 'warning', 'Cuotas pagas sin fecha de pago', 'Una cuota paga tiene su fecha.',
    sql`select id, "loanId", number from installment where status = 'paid' and "paidAt" is null`),
  C('installment-unpaid-with-date', 'Cuotas', 'warning', 'Cuotas con fecha de pago pero sin estar pagas', 'Estado y fecha de pago tienen que coincidir.',
    sql`select id, "loanId", number, status from installment where status not in ('paid') and "paidAt" is not null`),
  C('installment-orphan-status', 'Cuotas', 'warning', 'Cuotas pendientes de créditos que ya no están vigentes', 'Un crédito rechazado, anulado o saldado no tiene cuotas por cobrar.',
    sql`select i.id, i."loanId", l.status credito from installment i join loan l on l.id = i."loanId" where i.status in ('pending','overdue') and l.status in ('rejected','cancelled','paid','pending')`),

  /* ------------------------------ Contratos ------------------------------- */
  C('contract-accepted-incomplete', 'Contratos', 'warning', 'Contratos aceptados sin los datos de la firma', 'La firma deja fecha, firmante y CUIL.',
    sql`select id, "loanId" from loan_contract where status = 'accepted' and ("acceptedAt" is null or "signerName" is null or "signerCuil" is null)`),
  C('contract-dead-loan', 'Contratos', 'info', 'Contratos pendientes de créditos rechazados o anulados', 'La oferta ya no tiene sentido.',
    sql`select c.id, c."loanId", l.status from loan_contract c join loan l on l.id = c."loanId" where c.status in ('pending_acceptance','generated') and l.status in ('rejected','cancelled')`),

  /* ------------------------------ Pagos y recibos -------------------------- */
  C('payment-paid-no-date', 'Pagos', 'warning', 'Pagos acreditados sin fecha', 'Un pago acreditado tiene su fecha.',
    sql`select id, amount::text importe, method from payment where status = 'paid' and "paidAt" is null`),
  C('payment-no-receipt', 'Pagos', 'warning', 'Pagos acreditados sin recibo', 'Cada pago acreditado emite su comprobante.',
    sql`select p.id, p.amount::text importe, p.method, p."paidAt" from payment p where p.status = 'paid' and not exists (select 1 from payment_receipt r where r."paymentId" = p.id)`),
  C('receipt-amount-mismatch', 'Pagos', 'critical', 'Los recibos no suman el importe del pago', 'Un pago puede tener un recibo por cuota: juntos suman el pago.',
    sql`select p.id, p.amount::text pago, sum(r.amount)::text recibos, count(*)::int cantidad from payment p join payment_receipt r on r."paymentId" = p.id
         group by p.id, p.amount having abs(sum(r.amount) - p.amount) > 0.01`),
  C('payment-duplicate-ref', 'Pagos', 'critical', 'Pagos acreditados duplicados (misma persona, importe y referencia)', 'Dos pagos iguales con la misma referencia suelen ser un registro doble: el dinero se cuenta dos veces.',
    sql`select "userId", "referenceNumber", amount::text importe, count(*)::int veces, array_agg(id) pagos from payment
         where status = 'paid' and "referenceNumber" is not null group by "userId", "referenceNumber", amount having count(*) > 1`),
  C('wallet-negative-history', 'Billetera', 'info', 'Asientos que dejaron la billetera en negativo', 'Un saldo posterior negativo indica un débito sin fondos (dato heredado).',
    sql`select m.id, m."walletId", m.kind, m."balanceAfter"::text saldo_posterior from wallet_movement m where m."balanceAfter" < 0 and ${POSTED}`),
  C('wallet-pending-loads', 'Billetera', 'info', 'Cargas pendientes que nunca se acreditaron', 'Se muestran como pendientes y no suman al saldo.',
    sql`select m.id, m."walletId", m.amount::text importe, m."createdAt" from wallet_movement m where not ${POSTED}`),
  C('receipt-duplicate-number', 'Pagos', 'critical', 'Recibos con el mismo número', 'La numeración de recibos es única.',
    sql`select "receiptNumber", count(*)::int veces from payment_receipt group by "receiptNumber" having count(*) > 1`),

  /* ------------------------------ Desembolsos ------------------------------ */
  C('disb-amount-vs-principal', 'Desembolsos', 'critical', 'El desembolso no coincide con el capital del crédito', 'Se acredita el capital aprobado.',
    sql`select d.id, d."loanId", d.amount::text desembolso, l.principal::text capital from disbursement d join loan l on l.id = d."loanId"
         where d.status in ('credited','completed') and d.amount <> l.principal`),
  C('disb-credited-loan-state', 'Desembolsos', 'critical', 'Desembolsos acreditados de créditos sin fecha de desembolso', 'El crédito registra cuándo se entregó el dinero.',
    sql`select d.id, d."loanId", l.status from disbursement d join loan l on l.id = d."loanId" where d.status in ('credited','completed') and l."disbursedAt" is null`),
  C('disb-duplicate', 'Desembolsos', 'critical', 'Créditos con más de un desembolso', 'Un crédito se desembolsa una sola vez.',
    sql`select "loanId", count(*)::int veces from disbursement group by "loanId" having count(*) > 1`),
  C('disb-wallet-missing', 'Desembolsos', 'warning', 'Desembolsos a billetera sin el asiento en la billetera', 'Si el método es billetera, tiene que existir el crédito en los movimientos.',
    sql`select d.id, d."loanId", d.amount::text importe from disbursement d
         where d.status in ('credited','completed') and d."disbursementMethod" = 'wallet' and not exists (select 1 from wallet_movement m where m."externalId" = 'disb-' || d.id)`),

  /* -------------------------------- Personas ------------------------------- */
  C('kyc-profile-mismatch', 'Identidad', 'warning', 'La identidad figura distinta en la ficha y en el perfil', 'kyc_verification y profile tienen que coincidir.',
    sql`select p."userId", p."kycStatus" perfil, k.status ficha from profile p join kyc_verification k on k."userId" = p."userId" where p."kycStatus" <> k.status`),
  C('kyc-orphan', 'Identidad', 'info', 'Verificaciones de identidad sin cuenta', 'La verificación pertenece a una cuenta que ya no existe: dato residual que no debe contarse como persona verificada.',
    sql`select k.id, k.status, k."updatedAt" from kyc_verification k where not exists (select 1 from "user" u where u.id = k."userId")`),
  C('kyc-approved-no-dni', 'Identidad', 'warning', 'Identidad aprobada sin DNI o CUIL en el perfil', 'Una persona verificada tiene sus datos completos.',
    sql`select p."userId" from profile p where p."kycStatus" = 'approved' and (coalesce(p.dni,'') = '' or coalesce(p.cuil,'') = '')`),
  C('user-no-profile', 'Personas', 'warning', 'Cuentas sin perfil', 'Toda cuenta tiene su perfil.',
    sql`select u.id, u.email from "user" u where not exists (select 1 from profile p where p."userId" = u.id)`),
  C('duplicate-cuil', 'Personas', 'warning', 'Personas distintas con el mismo CUIL', 'El CUIL identifica a una sola persona.',
    sql`select cuil, count(*)::int cuentas from profile where coalesce(cuil,'') <> '' group by cuil having count(*) > 1`),
  C('duplicate-dni', 'Personas', 'info', 'Personas distintas con el mismo DNI', 'Puede ser un duplicado de cuenta.',
    sql`select dni, count(*)::int cuentas from profile where coalesce(dni,'') <> '' group by dni having count(*) > 1`),
  C('duplicate-email', 'Personas', 'warning', 'Correos repetidos (sin distinguir mayúsculas)', 'El correo es único.',
    sql`select lower(email) correo, count(*)::int cuentas from "user" group by lower(email) having count(*) > 1`),
  C('role-mismatch', 'Personas', 'warning', 'El rol de la cuenta no coincide con el del perfil', 'user.role y profile.role tienen que ser iguales.',
    sql`select u.id, u.email, u.role cuenta, p.role perfil from "user" u join profile p on p."userId" = u.id where u.role <> p.role`),
  C('admin-without-role', 'Personas', 'warning', 'Operadores sin rol asignado', 'Un operador sin rol no ve ninguna sección.',
    sql`select u.id, u.email from "user" u left join profile p on p."userId" = u.id where (u.role = 'admin' or p.role = 'admin') and p."adminRoleId" is null`),

  /* ------------------------------ Cuentas bancarias ------------------------ */
  C('bank-multiple-primary', 'Cuentas bancarias', 'warning', 'Personas con más de una cuenta principal activa', 'Una sola cuenta principal por persona.',
    sql`select "userId", count(*)::int principales from bank_account where "isPrimary" and "isActive" group by "userId" having count(*) > 1`),
  C('bank-holder-mismatch', 'Cuentas bancarias', 'critical', 'Cuentas verificadas cuyo titular no es la persona', 'Solo se retira a cuentas propias.',
    sql`select b.id, b."userId", b."holderCuil" titular, p.cuil persona from bank_account b join profile p on p."userId" = b."userId"
         where b."isVerified" and b."isActive" and coalesce(p.cuil,'') <> '' and regexp_replace(b."holderCuil",'\D','','g') <> regexp_replace(p.cuil,'\D','','g')`),
  C('bank-duplicate', 'Cuentas bancarias', 'info', 'La misma cuenta cargada dos veces por una persona', 'Cuenta repetida.',
    sql`select "userId", coalesce(cbu, cvu, alias) cuenta, count(*)::int veces from bank_account where "isActive" group by "userId", coalesce(cbu, cvu, alias) having count(*) > 1`),

  /* ----------------------- Cobros con QR (Mercado Pago) ------------------------ */
  CT(['mp_qr_payment'], 'mpqr-credited-no-movement', 'Cobros QR', 'critical', 'Cobros QR acreditados sin asiento en la billetera', 'Un pago marcado como acreditado tiene que tener su movimiento.',
    sql`select p."mpPaymentId", p."userId", p."creditedAmount"::text acreditado from mp_qr_payment p
         where p."creditedAmount" > 0 and not exists (select 1 from wallet_movement m where m."externalId" = 'mp-qr:' || p."mpPaymentId")`),
  CT(['mp_qr_payment'], 'mpqr-movement-no-payment', 'Cobros QR', 'critical', 'Asientos de cobro QR sin pago registrado', 'Todo ingreso por QR tiene que respaldarse en un pago de Mercado Pago.',
    sql`select m.id, m."walletId", m.amount::text importe, m."externalId" from wallet_movement m
         where m.kind = 'mp_qr_in' and not exists (select 1 from mp_qr_payment p where 'mp-qr:' || p."mpPaymentId" = m."externalId")`),
  CT(['mp_qr_payment'], 'mpqr-amount-mismatch', 'Cobros QR', 'critical', 'El asiento no coincide con lo acreditado', 'El importe del asiento tiene que ser el acreditado en el pago.',
    sql`select p."mpPaymentId", p."creditedAmount"::text acreditado, m.amount::text asiento from mp_qr_payment p
          join wallet_movement m on m."externalId" = 'mp-qr:' || p."mpPaymentId" where m.amount <> p."creditedAmount"`),
  CT(['mp_qr_payment'], 'mpqr-wallet-mismatch', 'Cobros QR', 'critical', 'Cobro QR acreditado en una billetera que no es de la persona', 'El asiento tiene que estar en la billetera ligada a la caja.',
    sql`select p."mpPaymentId", p."walletId", m."walletId" asiento_en from mp_qr_payment p
          join wallet_movement m on m."externalId" = 'mp-qr:' || p."mpPaymentId" where p."walletId" is not null and m."walletId" <> p."walletId"`),
  CT(['mp_qr_payment'], 'mpqr-reversed-excess', 'Cobros QR', 'critical', 'Se descontó más de lo acreditado', 'Lo revertido nunca supera lo acreditado.',
    sql`select "mpPaymentId", "creditedAmount"::text acreditado, "reversedAmount"::text revertido from mp_qr_payment where "reversedAmount" > coalesce("creditedAmount",0)`),
  CT(['mp_qr_payment'], 'mpqr-reversal-pending', 'Cobros QR', 'critical', 'Devoluciones que no se pudieron descontar', 'Mercado Pago devolvió el pago pero la billetera no tenía saldo: hay que resolverlo a mano.',
    sql`select "mpPaymentId", "userId", amount::text importe, note from mp_qr_payment where status = 'reversal_pending'`),
  CT(['mp_qr_payment'], 'mpqr-unmatched', 'Cobros QR', 'warning', 'Pagos de una caja nuestra sin persona asignada', 'Mercado Pago cobró algo en una caja de UNICRÉDITOS pero no sabemos de quién es.',
    sql`select "mpPaymentId", "posExternalId", amount::text importe, "createdAt" from mp_qr_payment where status = 'unmatched'`),
  CT(['mp_qr_order'], 'mpqr-order-paid-no-payment', 'Cobros QR', 'warning', 'Cobros QR marcados como pagados sin pago acreditado', 'Una orden pagada tiene su pago acreditado.',
    sql`select o.id, o."userId", o.amount::text importe from mp_qr_order o
         where o.status = 'paid' and not exists (select 1 from mp_qr_payment p where p."orderId" = o.id and p.status in ('credited','reversed','reversal_pending'))`),
  CT(['mp_qr_order'], 'mpqr-order-stale', 'Cobros QR', 'info', 'QR con importe vencidos que nadie concilió', 'Órdenes que siguen abiertas un día después de su vencimiento: conviene conciliar.',
    sql`select id, "userId", amount::text importe, "expiresAt" from mp_qr_order where status in ('created','creating') and "expiresAt" < now() - interval '1 day'`),
  CT(['mp_qr_pos'], 'mpqr-pos-wallet', 'Cobros QR', 'warning', 'Caja de cobro ligada a una billetera de otra persona', 'Cada caja pertenece a la billetera de su titular.',
    sql`select p.id, p."userId", p."walletId" from mp_qr_pos p left join wallet_account w on w.id = p."walletId" where w.id is null or w."userId" <> p."userId"`),

  /* ------------------------------- Facturación ----------------------------- */
  C('invoice-total', 'Facturación', 'critical', 'Facturas cuyo total no es neto + IVA', 'Total = neto + IVA.',
    sql`select id, "impNeto"::text neto, "impIva"::text iva, "impTotal"::text total from arca_invoice where abs("impTotal" - ("impNeto" + "impIva")) > 0.02`),
  C('invoice-unpaid-installment', 'Facturación', 'warning', 'Facturas de cuotas que no están pagas', 'Solo se factura lo cobrado.',
    sql`select a.id, a."installmentId", i.status from arca_invoice a join installment i on i.id = a."installmentId" where i.status <> 'paid'`),
  C('invoice-vat-rate', 'Facturación', 'warning', 'El IVA de la factura no es el 21% del neto', 'IVA sobre intereses = 21%.',
    sql`select id, "impNeto"::text neto, "impIva"::text iva from arca_invoice where abs("impIva" - round("impNeto" * 0.21, 2)) > 0.02`),
]

/**
 * Corre todos los controles. Cada uno es una sola consulta de solo lectura; si uno falla, el resto sigue. Se ejecutan de a
 * 4 a la vez (el pool en Vercel es de 4 conexiones): 58 consultas en fila tardaban segundos de más en cada apertura.
 */
const CONCURRENCY = 4

export async function runIntegrityChecks(only?: string[]): Promise<IntegrityResult[]> {
  const list = only ? CHECKS.filter((c) => only.includes(c.id)) : CHECKS
  const tables = [...new Set(list.flatMap((c) => c.requires ?? []))]
  const missing = new Set<string>()
  await Promise.all(
    tables.map(async (t) => {
      const r = await db.execute<{ ok: boolean }>(sql`select to_regclass(${t}) is not null as ok`)
      if (!r.rows[0]?.ok) missing.add(t)
    }),
  )

  const out: IntegrityResult[] = new Array(list.length)
  let next = 0
  async function worker() {
    while (next < list.length) {
      const i = next++
      const { query, requires, ...meta } = list[i]
      if (requires?.some((t) => missing.has(t))) {
        out[i] = { ...meta, count: 0, sample: [] }
        continue
      }
      try {
        const r = await db.execute<Record<string, unknown>>(sql`select * from (${query}) q limit 200`)
        out[i] = { ...meta, count: r.rows.length, sample: r.rows.slice(0, 8) }
      } catch (err) {
        const e = err as { cause?: { message?: string }; message?: string }
        out[i] = { ...meta, count: 0, sample: [], error: e.cause?.message ?? e.message }
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, list.length) }, worker))
  return out
}
