// Revisa si los creditos originados un dia (por defecto HOY en Argentina) pasaron la verificacion de
// identidad (Didit). SOLO LECTURA: BEGIN READ ONLY + ROLLBACK. Consola: conteos e ids enmascarados
// (credito corto, CUIL ultimos 3, estado, hora). La lista completa va a un archivo local FUERA del repo.
//   npx tsx scripts/credits-identity-today.ts --env-file <ruta .env.local> [--date YYYY-MM-DD]
import path from 'node:path'
import os from 'node:os'
import { mkdirSync, writeFileSync } from 'node:fs'
import { hostOf, readOnly, resolveDatabaseUrl } from './lib-ops-db'
import { maskId } from '../lib/auto-approval-revert'
import { IDENTITY_CODE_LABELS, arDayBounds, arHour, arToday, identityCheck, maskCuil, type IdentityCode } from '../lib/identity-notice'

const argv = process.argv.slice(2)
const opt = (n: string) => {
  const i = argv.indexOf(n)
  return i >= 0 ? argv[i + 1] : undefined
}

async function main() {
  const day = opt('--date') ?? arToday()
  const { start, end } = arDayBounds(day)
  const url = resolveDatabaseUrl(opt('--env-file'))
  console.log(`SOLO LECTURA. Dia ${day} (America/Argentina/Buenos_Aires): ${start} a ${end}. Host: ${hostOf(url)}`)
  const rows = await readOnly(url, (q) =>
    q(
      `SELECT l.id AS "loanId", l."userId", l.status, (l."createdAt" AT TIME ZONE 'UTC') AS "createdAt", c."generatedBy", u.email, p.cuil, p."kycStatus" AS "profileKyc",
              (k.id IS NOT NULL) AS "hasRecord", k.provider, k.status AS "kycStatus", k."expiresAt", k."reviewedAt", k."updatedAt"
         FROM loan l
         JOIN "user" u ON u.id = l."userId"
         LEFT JOIN profile p ON p."userId" = l."userId"
         LEFT JOIN kyc_verification k ON k."userId" = l."userId"
         LEFT JOIN loan_contract c ON c."loanId" = l.id
        WHERE (l."createdAt" AT TIME ZONE 'UTC') >= $1::timestamptz AND (l."createdAt" AT TIME ZONE 'UTC') < $2::timestamptz
        ORDER BY l."createdAt"`,
      [start, end],
    ),
  )
  const checked = rows.map((r) => ({
    r,
    code: identityCheck({ provider: r.provider, status: r.kycStatus, expiresAt: r.expiresAt, reviewedAt: r.reviewedAt, updatedAt: r.updatedAt, profileKycStatus: r.profileKyc, hasRecord: r.hasRecord }) as IdentityCode,
  }))
  const bad = checked.filter((c) => c.code !== 'ok')
  const byCode: Record<string, number> = {}
  for (const c of bad) byCode[c.code] = (byCode[c.code] ?? 0) + 1
  console.log(`Creditos originados ese dia: ${checked.length}`)
  console.log(`Con identidad verificada y vigente: ${checked.length - bad.length}`)
  console.log(`SIN completar identidad: ${bad.length} (clientes distintos: ${new Set(bad.map((b) => b.r.userId)).size})`, byCode)
  console.log('\nDetalle enmascarado:')
  for (const c of checked) {
    console.log(`  ${maskId(c.r.loanId)}  CUIL ${maskCuil(c.r.cuil)}  ${String(c.r.status).padEnd(9)} ${arHour(c.r.createdAt)} AR  ${c.code === 'ok' ? 'identidad OK' : 'SIN identidad: ' + IDENTITY_CODE_LABELS[c.code]}  ${c.r.generatedBy ? '[' + c.r.generatedBy + ']' : ''}`)
  }
  const dir = path.join(os.tmpdir(), 'unicred-revision')
  mkdirSync(dir, { recursive: true })
  const file = path.join(dir, 'creditos-hoy-sin-identidad.csv')
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const lines = [['loanId', 'userId', 'email', 'cuil_enmascarado', 'estado', 'hora_ar', 'motivo'].join(',')]
  for (const c of bad) lines.push([c.r.loanId, c.r.userId, c.r.email, maskCuil(c.r.cuil), c.r.status, arHour(c.r.createdAt), c.code].map(esc).join(','))
  writeFileSync(file, lines.join('\n'))
  console.log(`\nLista completa (solo en esta PC, fuera del repo): ${file}`)
  console.log('Nada se escribio en la base.')
}

main().catch((e) => {
  console.error('Error:', e?.message || e)
  process.exit(1)
})