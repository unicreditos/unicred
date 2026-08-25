/**
 * Pruebas HTTP contra el servidor local o el host indicado.
 * Uso: npx tsx scripts/smoke.ts
 *      SMOKE_BASE=https://unicreditos.com npx tsx scripts/smoke.ts
 */
const base = (process.env.SMOKE_BASE || 'http://localhost:3000').replace(/\/$/, '')

type Check = { name: string; ok: boolean; detail: string }

async function probe(
  name: string,
  path: string,
  expect: { status?: number[]; bodyIncludes?: string | string[]; method?: string },
): Promise<Check> {
  try {
    const res = await fetch(`${base}${path}`, {
      method: expect.method ?? 'GET',
      redirect: 'manual',
      headers: { Accept: 'text/html,application/json' },
    })
    const statusOk = expect.status ? expect.status.includes(res.status) : res.ok
    const text = await res.text()
    const needles = expect.bodyIncludes
      ? Array.isArray(expect.bodyIncludes)
        ? expect.bodyIncludes
        : [expect.bodyIncludes]
      : []
    const missing = needles.filter((n) => !text.includes(n))
    const bodyOk = missing.length === 0
    return {
      name,
      ok: statusOk && bodyOk,
      detail: `${res.status} ${
        statusOk && bodyOk
          ? 'ok'
          : `esperado ${expect.status ?? '2xx'}${missing.length ? ` · falta: ${missing.map((m) => `"${m}"`).join(', ')}` : ''}`
      }`,
    }
  } catch (err) {
    return { name, ok: false, detail: (err as Error).message }
  }
}

async function main() {
  const checks = await Promise.all([
    // Sitio principal
    probe('home', '/', { status: [200], bodyIncludes: 'UNICRÉDITOS' }),
    probe('login', '/sign-in', { status: [200], bodyIncludes: 'Plataforma de soluciones financieras' }),
    probe('productos', '/productos', { status: [200] }),
    probe('simulador', '/simulador', { status: [200] }),
    probe('legales', '/legal/terminos', {
      status: [200],
      bodyIncludes: ['Términos', 'PNFC', '24.240'],
    }),
    probe('privacidad', '/legal/privacidad', {
      status: [200],
      bodyIncludes: ['Privacidad', '25.326'],
    }),
    probe('robots', '/robots.txt', { status: [200], bodyIncludes: 'Disallow' }),
    probe('sitemap', '/sitemap.xml', { status: [200], bodyIncludes: 'urlset' }),
    probe('manifest', '/manifest.webmanifest', { status: [200] }),
    probe('admin sin sesión', '/admin', { status: [307, 308, 302] }),
    probe('dashboard sin sesión', '/dashboard', { status: [307, 308, 302] }),
    probe('health', '/api/health', { status: [200] }),
    probe('didit webhook vivo', '/api/webhooks/didit', { status: [200], bodyIncludes: 'didit' }),
    probe('mp webhook cerrado', '/api/webhooks/mercadopago', { status: [401] }),

    // Canal /pedir
    probe('pedir landing', '/pedir', {
      status: [200],
      bodyIncludes: ['UNICRÉDITOS', 'Login / Registro', 'Pensado para vos'],
    }),
    probe('pedir solicitud', '/pedir/solicitud', {
      status: [200],
      bodyIncludes: ['Solicitud', 'Evaluación'],
    }),
    probe('pedir faq', '/pedir/faq', {
      status: [200],
      bodyIncludes: ['Preguntas frecuentes', 'mutuo'],
    }),
    probe('pedir ingresar', '/pedir/ingresar', { status: [200], bodyIncludes: 'Ingresá' }),
    probe('pedir contacto', '/pedir/contacto', { status: [200], bodyIncludes: 'Contacto' }),
    probe('pedir terminos', '/pedir/legal/terminos', {
      status: [200],
      bodyIncludes: ['Términos', 'mutuo', 'PNFC', 'TEA'],
    }),
    probe('pedir privacidad', '/pedir/legal/privacidad', {
      status: [200],
      bodyIncludes: ['Privacidad', 'BCRA'],
    }),
    probe('pedir cuenta sin sesión', '/pedir/cuenta', { status: [307, 308, 302] }),
    probe('pedir pagar sin id', '/pedir/pagar', { status: [404] }),
    probe('pedir pagar cuota inexistente', '/pedir/pagar/inst_inexistente', {
      status: [200, 404, 307, 308, 302],
    }),

    // Docs protegidos (sin sesión → login)
    probe('docs contrato sin sesión', '/pedir/docs/contrato/demo', { status: [307, 308, 302] }),
    probe('docs pagare sin sesión', '/pedir/docs/pagare/demo', { status: [307, 308, 302] }),
    probe('docs cuponera sin sesión', '/pedir/docs/cuponera/demo', { status: [307, 308, 302] }),
    probe('dash contrato sin sesión', '/dashboard/documentos/contrato/demo', {
      status: [307, 308, 302],
    }),
    probe('dash pagare sin sesión', '/dashboard/documentos/pagare/demo', {
      status: [307, 308, 302],
    }),
    probe('dash estado sin sesión', '/dashboard/documentos/estado-deuda/demo', {
      status: [307, 308, 302],
    }),
  ])

  let failed = 0
  for (const check of checks) {
    console.log(`${check.ok ? 'OK  ' : 'FAIL'} ${check.name} — ${check.detail}`)
    if (!check.ok) failed += 1
  }
  console.log(`\n${checks.length - failed}/${checks.length} checks contra ${base}`)
  if (failed) process.exit(1)
}

void main()
