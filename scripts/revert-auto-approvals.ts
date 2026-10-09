// Simulacion de la reversion de creditos auto-aprobados por score a 'en revision'.
//   Por defecto: DRY-RUN. Escribe un reporte (JSON + CSV) en ./reports y NO modifica nada.
//   --input <archivo.json>   usa filas exportadas (sin conectarse a ninguna base)
//   --apply --yes            escribe (solo en base local/permitida; respalda en loan_autoapproval_revert_backup)
//   --rollback <runId> --yes restaura desde el respaldo
// NO se ejecuta contra ninguna base real sin aprobacion expresa de Angel.
import path from 'node:path'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { loadProjectEnv } from './load-env'
import { assertSafeSeedTarget } from './qa-seed-guard'
import { AUTO_GENERATORS, planRevert, planToCsv, type AutoApprovedRow } from '../lib/auto-approval-revert'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const argv = process.argv.slice(2)
const flag = (n: string) => argv.includes(n)
const opt = (n: string) => {
  const i = argv.indexOf(n)
  return i >= 0 ? argv[i + 1] : undefined
}

function writeReport(rows: AutoApprovedRow[], label: string) {
  const plan = planRevert(rows)
  const dir = path.join(rootDir, 'reports')
  mkdirSync(dir, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const base = path.join(dir, `auto-approval-revert-${label}-${stamp}`)
  writeFileSync(`${base}.json`, JSON.stringify(plan, null, 2))
  writeFileSync(`${base}.csv`, planToCsv(plan))
  console.log(`Total auto-aprobados: ${plan.total} | a revertir: ${plan.toRevert} | omitidos: ${plan.skipped}`)
  console.log('Por generador:', plan.byGenerator)
  console.log(`Reporte: ${base}.json / .csv`)
  return plan
}

async function main() {
  const input = opt('--input')
  if (input) {
    const rows = JSON.parse(readFileSync(input, 'utf8')) as AutoApprovedRow[]
    writeReport(rows, 'input')
    return
  }

  loadProjectEnv(rootDir)
  assertSafeSeedTarget(process.env) // solo base local, nunca produccion
  const { db, pool } = await import('@/lib/db')
  const { sql } = await import('drizzle-orm')
  const gens = AUTO_GENERATORS.map((g) => `'${g}'`).join(',')

  if (flag('--rollback')) {
    const runId = opt('--rollback')
    if (!runId || !flag('--yes')) throw new Error('Uso: --rollback <runId> --yes')
    const rows = await db.execute(sql`SELECT "loanId", "loanRow", "contractRow" FROM loan_autoapproval_revert_backup WHERE "runId" = ${runId} AND "restoredAt" IS NULL`)
    let n = 0
    for (const r of rows.rows as Array<{ loanId: string; loanRow: { status: string; rejectionReason: string | null }; contractRow: Record<string, unknown> | null }>) {
      await db.execute(sql`UPDATE loan SET status = ${r.loanRow.status}, "rejectionReason" = ${r.loanRow.rejectionReason}, "updatedAt" = now() WHERE id = ${r.loanId}`)
      if (r.contractRow) {
        await db.execute(sql`INSERT INTO loan_contract SELECT * FROM jsonb_populate_record(NULL::loan_contract, ${JSON.stringify(r.contractRow)}::jsonb) ON CONFLICT ("loanId") DO NOTHING`)
      }
      await db.execute(sql`UPDATE loan_autoapproval_revert_backup SET "restoredAt" = now() WHERE "runId" = ${runId} AND "loanId" = ${r.loanId}`)
      n++
    }
    console.log(`Restaurados ${n} creditos del run ${runId}.`)
    await pool.end()
    return
  }

  const res = await db.execute(sql.raw(`
    SELECT l.id AS "loanId", l."userId", l.status AS "loanStatus", l.principal, l."scoreAtApproval",
           c."generatedBy", c.id AS "contractId", c.status AS "contractStatus", c."acceptedAt",
           (SELECT count(*)::int FROM disbursement d WHERE d."loanId" = l.id) AS "disbursementCount",
           (SELECT count(*)::int FROM installment i WHERE i."loanId" = l.id AND i.status = 'paid') AS "paidInstallments",
           l."createdAt"
      FROM loan l JOIN loan_contract c ON c."loanId" = l.id
     WHERE c."generatedBy" IN (${gens})
     ORDER BY l."createdAt"`))
  const plan = writeReport(res.rows as unknown as AutoApprovedRow[], flag('--apply') ? 'apply' : 'dryrun')

  if (!flag('--apply')) {
    console.log('Dry-run: no se modifico nada.')
    await pool.end()
    return
  }
  if (!flag('--yes')) throw new Error('--apply requiere --yes')
  const exists = await db.execute(sql`SELECT to_regclass('loan_autoapproval_revert_backup') AS t`)
  if (!(exists.rows[0] as { t: string | null }).t) throw new Error('Falta aplicar scripts/sql/2026-10-09_01_auto_approval_revert_backup.sql')

  const runId = `run_${Date.now()}`
  const { recordAudit } = await import('@/lib/audit')
  for (const d of plan.decisions.filter((x) => x.action === 'revert')) {
    await db.transaction(async (tx) => {
      const loanRow = (await tx.execute(sql`SELECT * FROM loan WHERE id = ${d.row.loanId} FOR UPDATE`)).rows[0]
      const contractRow = (await tx.execute(sql`SELECT * FROM loan_contract WHERE "loanId" = ${d.row.loanId}`)).rows[0] ?? null
      await tx.execute(sql`INSERT INTO loan_autoapproval_revert_backup (id, "runId", "loanId", "loanRow", "contractRow", "revertedBy") VALUES (${`bk_${runId}_${d.row.loanId}`}, ${runId}, ${d.row.loanId}, ${JSON.stringify(loanRow)}::jsonb, ${contractRow ? JSON.stringify(contractRow) : null}::jsonb, 'script')`)
      await tx.execute(sql`DELETE FROM loan_contract WHERE "loanId" = ${d.row.loanId} AND "acceptedAt" IS NULL`)
      await tx.execute(sql`UPDATE loan SET status = 'pending', "updatedAt" = now() WHERE id = ${d.row.loanId} AND status = 'approved'`)
    })
    await recordAudit({
      actorUserId: 'system:revert-auto-approvals',
      action: 'LOAN_AUTO_APPROVAL_REVERTED',
      entityType: 'loan',
      entityId: d.row.loanId,
      targetUserId: d.row.userId,
      severity: 'warning',
      summary: `Devuelto a revision: aprobado por score sin decision humana (run ${runId})`,
      changes: { runId, generatedBy: d.row.generatedBy },
    })
  }
  console.log(`Revertidos ${plan.toRevert} creditos. runId=${runId}. Restaurar con: --rollback ${runId} --yes`)
  await pool.end()
}

main().catch((e) => {
  console.error('Error:', e?.message || e)
  process.exit(1)
})