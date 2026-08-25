/**
 * Valida RESEND_API_KEY y el dominio de envío. No imprime secretos.
 *   npx tsx scripts/verify-resend.ts
 */
import fs from 'node:fs'
import path from 'node:path'
import dotenv from 'dotenv'

const root = process.cwd()
const prodFile = path.join(root, '.env.production.local')
if (fs.existsSync(prodFile)) dotenv.config({ path: prodFile, override: true })
else dotenv.config({ path: path.join(root, '.env.local') })

const key = process.env.RESEND_API_KEY ?? ''
const from = process.env.EMAIL_FROM ?? 'UNICRÉDITOS <no-responder@unicreditos.com>'
const fromEmail = from.match(/<([^>]+)>/)?.[1] ?? from
const fromDomain = fromEmail.split('@')[1] ?? ''

function maskKey(value: string) {
  if (!value) return 'FALTA'
  if (!value.startsWith('re_')) return `formato inválido (len ${value.length})`
  return `ok re_…${value.slice(-4)} (${value.length} chars)`
}

async function resend(pathname: string, init?: RequestInit) {
  const res = await fetch(`https://api.resend.com${pathname}`, {
    ...init,
    headers: {
      authorization: `Bearer ${key}`,
      'content-type': 'application/json',
      ...(init?.headers ?? {}),
    },
    signal: AbortSignal.timeout(15000),
  })
  const text = await res.text()
  let json: unknown = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = { raw: text.slice(0, 240) }
  }
  return { status: res.status, json }
}

async function main() {
  console.log('RESEND_API_KEY:', maskKey(key))
  console.log('EMAIL_FROM:', from)
  if (!key) {
    process.exitCode = 1
    return
  }
  if (!key.startsWith('re_')) {
    console.log('La key no es de Resend (debe empezar con re_).')
    process.exitCode = 1
    return
  }

  const domains = await resend('/domains')
  console.log('GET /domains:', domains.status)
  if (domains.status === 401) {
    console.log('La API key fue rechazada (401). Generá otra en resend.com/api-keys.')
    process.exitCode = 1
    return
  }
  if (domains.status !== 200) {
    console.log('Respuesta inesperada:', JSON.stringify(domains.json).slice(0, 400))
    process.exitCode = 1
    return
  }

  const list = Array.isArray((domains.json as { data?: unknown[] })?.data)
    ? ((domains.json as { data: Array<Record<string, unknown>> }).data)
    : []
  if (!list.length) {
    console.log('No hay dominios en Resend. Hay que verificar unicreditos.com para enviar desde no-responder@…')
  }
  for (const d of list) {
    const name = String(d.name ?? '')
    const status = String(d.status ?? d.region ?? '')
    const region = d.region ? ` region=${d.region}` : ''
    const match = name === fromDomain || name.endsWith(`.${fromDomain}`) || fromDomain.endsWith(`.${name}`)
    console.log(`  - ${name} status=${status}${region}${match ? ' ← FROM' : ''}`)
  }

  const match = list.find((d) => String(d.name ?? '') === fromDomain)
  const verified =
    match &&
    ['verified', 'success'].includes(String(match.status ?? '').toLowerCase())
  if (!match) {
    console.log(`Dominio de EMAIL_FROM (${fromDomain}) no está en la cuenta Resend.`)
  } else if (!verified) {
    console.log(`Dominio ${fromDomain} existe pero no está verificado (status=${match.status}).`)
  } else {
    console.log(`Dominio ${fromDomain}: verificado.`)
  }

  const probe = await resend('/emails', {
    method: 'POST',
    body: JSON.stringify({
      from,
      to: ['delivered@resend.dev'],
      subject: '[UNICRÉDITOS] prueba de configuración Resend',
      text: 'Prueba automática de API key y dominio. Se puede ignorar.',
    }),
  })
  console.log('POST /emails (delivered@resend.dev):', probe.status)
  if (probe.status === 200 || probe.status === 201) {
    const id = (probe.json as { id?: string })?.id
    console.log('Envío de prueba aceptado.', id ? `id=${id}` : '')
  } else {
    const err = probe.json as { message?: string; name?: string }
    console.log('Envío de prueba rechazado:', err.name ?? '', err.message ?? JSON.stringify(probe.json).slice(0, 300))
    process.exitCode = 1
  }
}

main().catch((err) => {
  console.error('Fallo de red:', err instanceof Error ? err.message : err)
  process.exitCode = 1
})
