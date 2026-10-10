// Migra la evidencia KYC vieja (data URLs en kyc_verification) a la tabla versionada kyc_evidence con SHA-256.
//   Por defecto: DRY-RUN (cuenta lo que se migraria; no escribe).
//   --apply --yes : escribe (idempotente: si el contenido ya esta, no duplica). NO borra las columnas viejas.
// NO se ejecuta contra produccion sin aprobacion de Angel. Solo corre en una base local o permitida.
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadProjectEnv } from './load-env'
import { assertSafeSeedTarget } from './qa-seed-guard'
import { EVIDENCE_KINDS, LEGACY_COLUMN, parseDataUrl } from '../lib/evidence-core'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
loadProjectEnv(rootDir)

async function main() {
  const apply = process.argv.includes('--apply')
  if (apply && !process.argv.includes('--yes')) throw new Error('--apply requiere --yes')
  assertSafeSeedTarget(process.env)
  const { db, pool } = await import('@/lib/db')
  const { sql } = await import('drizzle-orm')
  const { backfillLegacyEvidence } = await import('@/lib/evidence')

  const res = await db.execute(
    sql`SELECT "userId", "dniFrontImageUrl", "dniBackImageUrl", "selfieImageUrl", "videoUrl" FROM kyc_verification ORDER BY "updatedAt"`,
  )
  const rows = res.rows as Array<Record<string, string | null>>
  const counts: Record<string, number> = { usuarios: rows.length, dni_front: 0, dni_back: 0, selfie: 0, video: 0, noParseables: 0 }
  for (const r of rows) {
    for (const kind of EVIDENCE_KINDS) {
      const v = r[LEGACY_COLUMN[kind]]
      if (!v) continue
      if (parseDataUrl(v)) counts[kind]++
      else counts.noParseables++
    }
  }
  console.log('Evidencia legada encontrada:', counts)
  if (!apply) {
    console.log('Dry-run: no se escribio nada.')
    await pool.end()
    return
  }
  let created = 0
  for (const r of rows) created += await backfillLegacyEvidence(String(r.userId))
  console.log(`Versiones creadas: ${created}. Las columnas viejas no se tocaron.`)
  await pool.end()
}

main().catch((e) => {
  console.error('Error:', e?.message || e)
  process.exit(1)
})