import { loadProjectEnv } from './load-env'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
loadProjectEnv(rootDir)

async function main() {
  const { ensureSupportCaseTable } = await import('@/lib/db/ensure-support-case')
  const { pool } = await import('@/lib/db')
  await ensureSupportCaseTable()
  console.log('support_case lista')
  await pool.end()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
