// Reversion de creditos APROBADOS AUTOMATICAMENTE por puntaje a "pendiente" (en evaluacion).
//
//   (por defecto) --simulate   Solo lectura (BEGIN READ ONLY + ROLLBACK). Imprime conteos y el plan
//                              por credito enmascarado (id corto, estado, fecha, monto). No escribe nada.
//   --apply                    ESCRIBE. Exige REVERT_AUTO_APPROVALS_CONFIRM=SI_REVERTIR_AUTOAPROBADOS,
//                              la tabla de respaldo (SQL 01) ya aplicada a mano y NODE_ENV!=test.
//   --restore <runId>          Deshace una corrida (misma confirmacion). Restaura estado desde el respaldo.
//   --env-file <ruta>          Toma DATABASE_URL de ese archivo (solo en memoria, no se imprime).
//
// Nunca modifica pagos, desembolsos, cuotas, contratos ni documentos: solo loan.status/updatedAt.
// Cada credito se mueve en su propia transaccion: respaldo + cambio + registro de auditoria juntos.
// Idempotente: un credito ya pendiente deja de cumplir el filtro y no se vuelve a tocar.
import path from 'node:path'
import os from 'node:os'
import { mkdirSync, writeFileSync } from 'node:fs'
import { connect, hostOf, readOnly, resolveDatabaseUrl } from './lib-ops-db'
import {
  AUTO_GENERATORS,
  BACKUP_TABLE,
  CONFIRM_ENV,
  CONFIRM_VALUE,
  classifyAutoApproved,
  arDayOf,
  maskId,
  planRevert,
  planToCsv,
  type AutoApprovedRow,
} from '../lib/auto-approval-revert'

const argv = process.argv.slice(2)
const flag = (n: string) => argv.includes(n)
const opt = (n: string) => {
  const i = argv.indexOf(n)
  return i >= 0 ? argv[i + 1] : undefined
}

const gens = AUTO_GENERATORS.map((g) => `'${g}'`).join(',')
const selectSql = (extra = ``) => `
  SELECT l.id AS "loanId", l."userId", l.status AS "loanStatus", l.principal::text AS principal, l."scoreAtApproval",
         c."generatedBy", c.id AS "contractId", c.status AS "contractStatus", c."acceptedAt",
         (SELECT count(*)::int FROM disbursement d WHERE d."loanId" = l.id) AS "disbursementCount",
         (SELECT count(*)::int FROM installment i WHERE i."loanId" = l.id AND i.status = 'paid') AS "paidInstallments",
         (SELECT count(*)::int FROM installment i WHERE i."loanId" = l.id) AS "installmentCount",
         (SELECT count(*)::int FROM payment p WHERE p."loanId" = l.id) AS "paymentCount",
         (l."createdAt" AT TIME ZONE 'UTC') AS "createdAt"
    FROM loan l JOIN loan_contract c ON c."loanId" = l.id
   WHERE c."generatedBy" IN (${gens})${extra}
   ORDER BY l."createdAt"`

function printPlan(rows: AutoApprovedRow[]) {
  const plan = planRevert(rows)
  console.log(`Aprobados automaticamente (marca loan_contract.generatedBy): ${plan.autoTotal}`)
  console.log('Por origen:', plan.byGenerator)
  console.log('Por estado actual:', plan.byState)
  console.log(`Se moverian a pendiente (--apply): ${plan.toRevert}`)
  console.log(`Se informan aparte y NO se tocan: ${plan.skipped}`, plan.bySkipCode)
  const dir = path.join(os.tmpdir(), 'unicred-revision')
  mkdirSync(dir, { recursive: true })
  const file = path.join(dir, `reversion-plan-${new Date().toISOString().replace(/[:.]/g, '-')}.csv`)
  writeFileSync(file, planToCsv(plan))
  console.log(`Plan enmascarado por credito: ${file}`)
  return plan
}

async function simulate() {
  const url = resolveDatabaseUrl(opt('--env-file'))
  console.log(`Modo SIMULACION (solo lectura, BEGIN READ ONLY + ROLLBACK). Host: ${hostOf(url)}`)
  const out = await readOnly(url, async (q) => {
    const [bk] = await q(`SELECT to_regclass('${BACKUP_TABLE}') IS NOT NULL AS has_backup`)
    const [gb] = await q(`SELECT count(*)::int AS n FROM information_schema.columns WHERE table_name='loan_contract' AND column_name='generatedBy'`)
    const rows = gb?.n ? ((await q(selectSql())) as unknown as AutoApprovedRow[]) : []
    return { hasBackup: Boolean(bk?.has_backup), hasGeneratedBy: Boolean(gb?.n), rows }
  })
  if (!out.hasGeneratedBy) console.log('FALTA la columna loan_contract.generatedBy en esta base: no se puede identificar auto-aprobados.')
  console.log(`Tabla de respaldo ${BACKUP_TABLE}: ${out.hasBackup ? 'existe' : 'NO existe (aplicar SQL 01 a mano antes de --apply)'}`)
  const plan = printPlan(out.rows)
  console.log('\nPlan por credito (enmascarado):')
  for (const d of plan.decisions.filter((x) => x.code !== 'human')) {
    const r = d.row
    console.log(`  ${maskId(r.loanId)}  ${r.loanStatus.padEnd(9)} ${arDayOf(r.createdAt)}  ${r.principal}  -> ${d.action}${d.action === 'skip' ? ` (${d.code})` : ''}`)
  }
  console.log('\nSimulacion terminada: no se escribio nada.')
}

async function apply() {
  if (process.env[CONFIRM_ENV] !== CONFIRM_VALUE) {
    throw new Error(`--apply requiere ${CONFIRM_ENV}=${CONFIRM_VALUE}. No se modifico nada.`)
  }
  const url = resolveDatabaseUrl(opt('--env-file'))
  const client = await connect(url)
  try {
    const bk = await client.query(`SELECT to_regclass('${BACKUP_TABLE}') AS t`)
    if (!bk.rows[0].t) throw new Error('Falta aplicar scripts/sql/2026-10-09_01_auto_approval_revert_backup.sql (respaldo). No se modifico nada.')
    const au = await client.query(`SELECT to_regclass('admin_audit_log') AS t`)
    if (!au.rows[0].t) throw new Error('Falta la tabla admin_audit_log. No se modifico nada.')
    const rows = (await client.query(selectSql())).rows as AutoApprovedRow[]
    const plan = printPlan(rows)
    const runId = `run_${Date.now()}`
    console.log(`\nRESPALDO: tabla ${BACKUP_TABLE}, runId=${runId} (host ${hostOf(url)})`)
    console.log(`Restaurar con: ${CONFIRM_ENV}=${CONFIRM_VALUE} npx tsx scripts/revert-auto-approvals.ts --restore ${runId}`)
    let done = 0
    let skippedNow = 0
    for (const d of plan.decisions.filter((x) => x.action === 'revert')) {
      try {
        await client.query('BEGIN')
        const cur = (await client.query(`SELECT * FROM loan WHERE id = $1 FOR UPDATE`, [d.row.loanId])).rows[0]
        // Revalida con el candado tomado: si cambio algo entre la lectura y ahora, no se toca.
        const fresh = (await client.query(selectSql(` AND l.id = $1`), [d.row.loanId])).rows[0] as AutoApprovedRow | undefined
        if (!cur || !fresh || classifyAutoApproved(fresh).action !== 'revert') {
          await client.query('ROLLBACK')
          skippedNow++
          continue
        }
        const contractRow = (await client.query(`SELECT * FROM loan_contract WHERE "loanId" = $1`, [d.row.loanId])).rows[0] ?? null
        await client.query(
          `INSERT INTO ${BACKUP_TABLE} (id, "runId", "loanId", "loanRow", "contractRow", "revertedBy") VALUES ($1,$2,$3,$4::jsonb,$5::jsonb,'script')`,
          [`bk_${runId}_${d.row.loanId}`, runId, d.row.loanId, JSON.stringify(cur), contractRow ? JSON.stringify(contractRow) : null],
        )
        await client.query(`UPDATE loan SET status = 'pending', "updatedAt" = now() WHERE id = $1 AND status = 'approved'`, [d.row.loanId])
        await client.query(
          `INSERT INTO admin_audit_log (id, "actorUserId", action, "entityType", "entityId", "targetUserId", severity, summary, changes)
           VALUES ($1, NULL, 'LOAN_AUTO_APPROVAL_REVERTED', 'loan', $2, $3, 'warning', $4, $5::jsonb)`,
          [
            crypto.randomUUID(), d.row.loanId, d.row.userId,
            `Devuelto a pendiente: aprobado por puntaje sin decision humana (corrida ${runId})`,
            JSON.stringify({ runId, from: 'approved', to: 'pending', generatedBy: d.row.generatedBy, actor: 'script:revert-auto-approvals' }),
          ],
        )
        await client.query('COMMIT')
        done++
      } catch (e) {
        await client.query('ROLLBACK').catch(() => undefined)
        throw e
      }
    }
    console.log(`Movidos a pendiente: ${done}. Omitidos por cambio concurrente: ${skippedNow}. runId=${runId}`)
  } finally {
    await client.end()
  }
}

async function restore(runId: string) {
  if (process.env[CONFIRM_ENV] !== CONFIRM_VALUE) throw new Error(`--restore requiere ${CONFIRM_ENV}=${CONFIRM_VALUE}.`)
  const client = await connect(resolveDatabaseUrl(opt('--env-file')))
  try {
    const rows = (await client.query(`SELECT "loanId", "loanRow" FROM ${BACKUP_TABLE} WHERE "runId" = $1 AND "restoredAt" IS NULL`, [runId])).rows as Array<{ loanId: string; loanRow: { status: string; rejectionReason: string | null; userId: string } }>
    let n = 0
    for (const r of rows) {
      await client.query('BEGIN')
      try {
        // Solo si sigue pendiente: si alguien lo gestiono despues, no se pisa su decision.
        const u = await client.query(`UPDATE loan SET status = $2, "rejectionReason" = $3, "updatedAt" = now() WHERE id = $1 AND status = 'pending'`, [r.loanId, r.loanRow.status, r.loanRow.rejectionReason])
        if (u.rowCount) {
          await client.query(`UPDATE ${BACKUP_TABLE} SET "restoredAt" = now() WHERE "runId" = $1 AND "loanId" = $2`, [runId, r.loanId])
          await client.query(
            `INSERT INTO admin_audit_log (id, "actorUserId", action, "entityType", "entityId", "targetUserId", severity, summary, changes)
             VALUES ($1, NULL, 'LOAN_AUTO_APPROVAL_RESTORED', 'loan', $2, $3, 'warning', $4, $5::jsonb)`,
            [crypto.randomUUID(), r.loanId, r.loanRow.userId, `Restaurado el estado previo a la reversion (corrida ${runId})`, JSON.stringify({ runId, to: r.loanRow.status })],
          )
          n++
        }
        await client.query('COMMIT')
      } catch (e) {
        await client.query('ROLLBACK').catch(() => undefined)
        throw e
      }
    }
    console.log(`Restaurados ${n} de ${rows.length} creditos de la corrida ${runId}.`)
  } finally {
    await client.end()
  }
}

async function main() {
  if (flag('--restore')) return restore(String(opt('--restore') ?? ''))
  if (flag('--apply')) return apply()
  return simulate()
}

main().catch((e) => {
  console.error('Error:', e?.message || e)
  process.exit(1)
})