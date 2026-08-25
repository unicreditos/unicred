/**
 * Lista workflows Didit y, si falta, crea el destino de webhook.
 * Uso: npx tsx scripts/didit-setup.ts
 */
import path from 'node:path'
import { loadProjectEnv } from './load-env'
import {
  createDiditWebhookDestination,
  diditWebhookUrl,
  isDiditConfigured,
  listDiditWorkflows,
} from '../lib/didit'

loadProjectEnv(path.join(process.cwd()))

async function main() {
  if (!isDiditConfigured()) {
    console.error('Falta DIDIT_API_KEY en .env.local')
    process.exit(1)
  }

  const page = await listDiditWorkflows()
  const rows = page.results ?? []
  if (!rows.length) {
    console.error('La aplicación Didit no tiene workflows. Creá uno publicado en la consola.')
    process.exit(1)
  }

  console.log('Workflows Didit:')
  for (const w of rows) {
    const mark = w.is_default ? ' (default)' : ''
    console.log(`  - ${w.workflow_id || w.uuid} · ${w.workflow_label} · ${w.status}${mark}`)
  }

  const published = rows.filter((w) => w.status === 'published' && !w.is_archived)
  const free = published.find((w) => /free kyc/i.test(String(w.workflow_label || '')))
  const chosen = free ?? published.find((w) => w.is_default) ?? published[0]
  if (chosen) {
    console.log(`\nUsá este workflow en DIDIT_WORKFLOW_ID:\n${chosen.workflow_id || chosen.uuid}`)
  }

  const webhookUrl = diditWebhookUrl()
  console.log(`\nURL de webhook que debe existir en Didit:\n${webhookUrl}`)

  if (process.env.DIDIT_WEBHOOK_SECRET?.trim()) {
    console.log('DIDIT_WEBHOOK_SECRET ya está cargado. No se crea otro destino.')
    return
  }
  if (!webhookUrl.startsWith('https://')) {
    console.log('El webhook de Didit necesita HTTPS público. En local el callback del navegador sí funciona.')
    return
  }

  const dest = await createDiditWebhookDestination(webhookUrl)
  if (dest.secret_shared_key) {
    console.log('\nDestino creado. Guardá esto en DIDIT_WEBHOOK_SECRET (solo se muestra una vez):')
    console.log(dest.secret_shared_key)
  } else {
    console.log('Didit respondió sin secret_shared_key. Revisá destinos existentes en la consola.')
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
