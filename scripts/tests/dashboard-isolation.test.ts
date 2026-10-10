import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

/**
 * Los paneles (/admin y /dashboard) están aislados del sitio público: no enlazan, redirigen ni abren nada fuera de
 * ellos. La única salida es "Cerrar sesión", que vuelve al inicio público (components/uc/shell.tsx).
 */
const ROOT = join(__dirname, '..', '..')
const SCAN = ['app/admin', 'app/dashboard', 'components/uc', 'components/dashboard', 'lib/uc', 'lib/customer']
const ALLOWED_EXIT = { file: 'components/uc/shell.tsx', snippet: "router.replace('/')" }

function walk(dir: string, out: string[] = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.(tsx?|css)$/.test(name)) out.push(p)
  }
  return out
}

const files = SCAN.flatMap((d) => walk(join(ROOT, d)))

describe('aislamiento de los paneles', () => {
  it('escanea los archivos del panel', () => {
    assert.ok(files.length > 20)
  })

  it('no enlaza ni redirige a rutas fuera de /dashboard, /admin o /api', () => {
    // href="/x", href={'/x'}, href={`/x`}, redirect('/x'), router.push|replace('/x'), window.location = '/x'
    const target = /(?:href\s*=\s*\{?\s*|redirect\(\s*|\.(?:push|replace)\(\s*|location(?:\.href)?\s*=\s*)(['"`])(\/[^'"`]*|https?:\/\/[^'"`]*)\1?/g
    const offenders: string[] = []
    for (const f of files.filter((x) => /\.tsx?$/.test(x))) {
      const rel = relative(ROOT, f).replaceAll('\\', '/')
      const lines = readFileSync(f, 'utf8').split(/\r?\n/)
      lines.forEach((line, i) => {
        for (const m of line.matchAll(target)) {
          const dest = m[2]
          // /cuenta/seguridad: pantalla de cuenta (2FA y sesiones), no es el sitio publico.
          if (/^\/(dashboard|admin|api|cuenta\/seguridad)([/?#]|$)/.test(dest)) continue
          if (rel === ALLOWED_EXIT.file && line.includes(ALLOWED_EXIT.snippet)) continue
          offenders.push(`${rel}:${i + 1} → ${dest}`)
        }
      })
    }
    assert.deepEqual(offenders, [])
  })

  it('no abre sitios externos (https://, mailto:, wa.me)', () => {
    const offenders: string[] = []
    for (const f of files.filter((x) => /\.tsx$/.test(x))) {
      const rel = relative(ROOT, f).replaceAll('\\', '/')
      readFileSync(f, 'utf8')
        .split(/\r?\n/)
        .forEach((line, i) => {
          if (/(href|src|action)\s*=\s*\{?\s*['"`](https?:|mailto:|tel:)/.test(line) || /wa\.me/.test(line)) offenders.push(`${rel}:${i + 1}`)
        })
    }
    assert.deepEqual(offenders, [])
  })

  it('la marca del panel lleva al inicio del panel, no al sitio público', () => {
    const shell = readFileSync(join(ROOT, ALLOWED_EXIT.file), 'utf8')
    assert.match(shell, /<Link href=\{homeHref\}/)
  })
})
