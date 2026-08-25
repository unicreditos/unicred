/**
 * Envío de correo transaccional. Usa Resend si hay API key; en desarrollo, o si
 * el proveedor no está configurado, escribe el mensaje en el log del servidor
 * para no bloquear los flujos que dependen del correo.
 */

import { BRAND } from '@/lib/brand'

const RESEND_ENDPOINT = 'https://api.resend.com/emails'

export type EmailMessage = {
  to: string
  subject: string
  html: string
  text: string
}

export type EmailResult = { ok: boolean; delivered: boolean; error?: string }

function fromAddress(): string {
  return process.env.EMAIL_FROM ?? `${BRAND.company} <no-responder@${BRAND.domain}>`
}

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY)
}

export async function sendEmail(message: EmailMessage): Promise<EmailResult> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    if (process.env.NODE_ENV === 'production') {
      console.error('[email] RESEND_API_KEY no configurada: no se envió', message.subject)
      return { ok: false, delivered: false, error: 'proveedor_no_configurado' }
    }
    console.info(`[email] (dev) Para: ${message.to}\nAsunto: ${message.subject}\n${message.text}`)
    return { ok: true, delivered: false }
  }

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        from: fromAddress(),
        to: [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text,
      }),
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      console.error('[email] error del proveedor:', res.status, detail.slice(0, 300))
      return { ok: false, delivered: false, error: `proveedor_${res.status}` }
    }
    return { ok: true, delivered: true }
  } catch (err) {
    console.error('[email] fallo de red:', err instanceof Error ? err.message : err)
    return { ok: false, delivered: false, error: 'red' }
  }
}

export function passwordResetEmail(url: string): Pick<EmailMessage, 'subject' | 'html' | 'text'> {
  const subject = `Restablecé tu contraseña de ${BRAND.company}`
  const text = [
    `Recibimos un pedido para restablecer la contraseña de tu cuenta ${BRAND.company}.`,
    '',
    `Entrá en este enlace para elegir una nueva: ${url}`,
    '',
    'El enlace vence en 1 hora y se puede usar una sola vez.',
    'Si no pediste el cambio, ignorá este mensaje: tu contraseña sigue siendo la misma.',
    '',
    `${BRAND.company} — ${BRAND.legalName}`,
  ].join('\n')

  const html = `
    <div style="font-family:Segoe UI,Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;color:#0B2545">
      <h1 style="font-size:20px;margin:0 0 16px">Restablecé tu contraseña</h1>
      <p style="font-size:14px;line-height:1.6;margin:0 0 16px">
        Recibimos un pedido para restablecer la contraseña de tu cuenta ${BRAND.company}.
      </p>
      <p style="margin:0 0 24px">
        <a href="${url}" style="display:inline-block;background:#0052D4;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-size:14px;font-weight:600">
          Elegir nueva contraseña
        </a>
      </p>
      <p style="font-size:13px;line-height:1.6;color:#4F6FA4;margin:0 0 8px">
        El enlace vence en 1 hora y se puede usar una sola vez.
      </p>
      <p style="font-size:13px;line-height:1.6;color:#4F6FA4;margin:0 0 24px">
        Si no pediste el cambio, ignorá este mensaje: tu contraseña sigue siendo la misma.
      </p>
      <p style="font-size:12px;color:#7C94BC;margin:0">${BRAND.company} — ${BRAND.legalName}</p>
    </div>
  `.trim()

  return { subject, html, text }
}

function moneyLabel(value: string | number) {
  const n = Number(value)
  if (!Number.isFinite(n)) return String(value)
  return n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })
}

export function contractReadyEmail(input: {
  to: string
  name?: string | null
  contractUrl: string
  principal: string | number
  term: number
}): EmailMessage {
  const who = input.name?.trim() || 'Hola'
  const subject = `Tu contrato ${BRAND.company} está listo para firmar`
  const text = [
    `${who},`,
    '',
    `Aprobamos tu crédito por ${moneyLabel(input.principal)} en ${input.term} cuotas.`,
    'Revisá el contrato de préstamo (mutuo) y el pagaré, y aceptalos para habilitar el desembolso.',
    '',
    input.contractUrl,
    '',
    `${BRAND.company} — ${BRAND.legalName}`,
  ].join('\n')
  const html = `
    <div style="font-family:Segoe UI,Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;color:#0B2545">
      <h1 style="font-size:20px;margin:0 0 16px">Contrato listo para firmar</h1>
      <p style="font-size:14px;line-height:1.6;margin:0 0 16px">${who}, aprobamos tu crédito por <strong>${moneyLabel(input.principal)}</strong> en ${input.term} cuotas.</p>
      <p style="font-size:14px;line-height:1.6;margin:0 0 24px">Revisá el contrato de préstamo (mutuo) y el pagaré. La firma habilita el desembolso.</p>
      <p style="margin:0 0 24px">
        <a href="${input.contractUrl}" style="display:inline-block;background:#0052D4;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-size:14px;font-weight:600">Abrir expediente</a>
      </p>
      <p style="font-size:12px;color:#7C94BC;margin:0">${BRAND.company} — ${BRAND.legalName}</p>
    </div>
  `.trim()
  return { to: input.to, subject, html, text }
}

export function intimacionEmail(input: {
  to: string
  name?: string | null
  amount: number
  overdueCount: number
  url: string
}): EmailMessage {
  const who = input.name?.trim() || 'Hola'
  const subject = `Intimación de pago — ${BRAND.company}`
  const text = [
    `${who},`,
    '',
    `Registramos ${input.overdueCount} cuota(s) vencida(s) por ${moneyLabel(input.amount)}.`,
    'Esta comunicación constituye intimación de pago y reserva de acciones, incluido el pagaré.',
    '',
    input.url,
    '',
    `${BRAND.company} — ${BRAND.legalName}`,
  ].join('\n')
  const html = `
    <div style="font-family:Segoe UI,Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;color:#0B2545">
      <h1 style="font-size:20px;margin:0 0 16px">Intimación de pago</h1>
      <p style="font-size:14px;line-height:1.6;margin:0 0 16px">${who}, hay ${input.overdueCount} cuota(s) vencida(s) por <strong>${moneyLabel(input.amount)}</strong>.</p>
      <p style="font-size:14px;line-height:1.6;margin:0 0 24px">Esta comunicación constituye intimación de pago y reserva de acciones, incluido el pagaré.</p>
      <p style="margin:0 0 24px">
        <a href="${input.url}" style="display:inline-block;background:#B42318;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-size:14px;font-weight:600">Ver intimación</a>
      </p>
      <p style="font-size:12px;color:#7C94BC;margin:0">${BRAND.company} — ${BRAND.legalName}</p>
    </div>
  `.trim()
  return { to: input.to, subject, html, text }
}

export function inquiryEmail(input: {
  kind: string
  name: string
  email: string
  phone?: string
  subjectLine: string
  message: string
}): EmailMessage {
  const subject = `[${BRAND.company}] ${input.kind}: ${input.subjectLine}`
  const text = [
    `Tipo: ${input.kind}`,
    `Nombre: ${input.name}`,
    `Email: ${input.email}`,
    input.phone ? `Teléfono: ${input.phone}` : null,
    `Asunto: ${input.subjectLine}`,
    '',
    input.message,
  ]
    .filter(Boolean)
    .join('\n')
  const html = `<pre style="font-family:Segoe UI,Helvetica,Arial,sans-serif;white-space:pre-wrap">${text.replace(/</g, '&lt;')}</pre>`
  return { to: BRAND.supportEmail, subject, html, text }
}
