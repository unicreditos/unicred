import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadProjectEnv } from './load-env'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
loadProjectEnv(rootDir)

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL no definida')
    process.exit(1)
  }

  console.log('Aplicando schema completo con drizzle-kit push...')
  const pushed = spawnSync('npx', ['drizzle-kit', 'push', '--force'], {
    cwd: rootDir,
    stdio: 'inherit',
    shell: true,
    env: process.env,
  })
  if (pushed.status !== 0) {
    process.exit(pushed.status ?? 1)
  }

  const { db, pool } = await import('@/lib/db')
  const { loanProduct } = await import('@/lib/db/schema')
  const products = [
    {
      id: 'prod_personal',
      name: 'Préstamo Personal UNICRÉDITOS',
      type: 'personal',
      minAmount: '50000.00',
      maxAmount: '3000000.00',
      minTerm: 3,
      maxTerm: 48,
      monthlyRate: '7.500',
      tna: '90.000',
      active: true,
    },
    {
      id: 'prod_consumo',
      name: 'Crédito de Consumo en Cuotas',
      type: 'consumo',
      minAmount: '10000.00',
      maxAmount: '1000000.00',
      minTerm: 1,
      maxTerm: 24,
      monthlyRate: '8.200',
      tna: '98.400',
      active: true,
    },
    {
      id: 'prod_comercio',
      name: 'Financiación Comercio',
      type: 'comercio',
      minAmount: '20000.00',
      maxAmount: '5000000.00',
      minTerm: 1,
      maxTerm: 24,
      monthlyRate: '6.900',
      tna: '82.800',
      active: true,
    },
  ]

  let inserted = 0
  for (const product of products) {
    try {
      await db.insert(loanProduct).values(product as typeof loanProduct.$inferInsert).onConflictDoNothing({
        target: loanProduct.id,
      })
      inserted++
    } catch (err) {
      console.warn('Seed producto:', (err as Error).message)
    }
  }
  console.log(`Productos confirmados: ${inserted}`)
  await pool.end()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
