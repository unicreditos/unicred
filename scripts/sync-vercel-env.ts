/**
 * Sincroniza .env.production.local → Vercel (entorno production).
 * No imprime valores. Requiere `vercel login` y proyecto linkeado (.vercel/).
 *
 * Uso: npx tsx scripts/sync-vercel-env.ts
 */
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

function parseEnvFile(file: string) {
  const out: Record<string, string> = {}
  if (!fs.existsSync(file)) return out
  for (const raw of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq < 0) continue
    let value = line.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    out[line.slice(0, eq).trim()] = value
  }
  return out
}

const SENSITIVE = /SECRET|_KEY|TOKEN|PASSWORD|DATABASE_URL|AFIP_CERT|AFIP_KEY|AUTH_B64/i

const root = process.cwd()
const envFile = path.join(root, '.env.production.local')
const vars = parseEnvFile(envFile)

if (!Object.keys(vars).length) {
  console.error('No hay variables en .env.production.local. Corré npm run prod:env primero.')
  process.exit(1)
}

let ok = 0
let skipped = 0
let failed = 0

for (const [name, value] of Object.entries(vars)) {
  if (!value.trim()) {
    console.log(`· ${name} — omitida (vacía)`)
    skipped += 1
    continue
  }
  const args = ['env', 'add', name, 'production', '--force']
  if (SENSITIVE.test(name)) args.push('--sensitive')
  const result = spawnSync('vercel', args, {
    cwd: root,
    input: value,
    encoding: 'utf8',
    shell: process.platform === 'win32',
    stdio: ['pipe', 'pipe', 'pipe'],
  })
  if (result.status === 0) {
    console.log(`✓ ${name}`)
    ok += 1
  } else {
    console.error(`✗ ${name}`)
    if (result.stderr?.trim()) console.error(result.stderr.trim())
    failed += 1
  }
}

console.log(`\nSincronizadas: ${ok} · omitidas: ${skipped} · errores: ${failed}`)
if (failed > 0) process.exit(1)
