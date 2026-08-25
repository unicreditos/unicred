/**
 * Envío de correo transaccional. Usa Resend si hay API key; en desarrollo, o si
 * el proveedor no está configurado, escribe el mensaje en el log del servidor
 * para no bloquear los flujos que dependen del correo.
 */

import { BRAND, publicBrandWebsite } from '@/lib/brand'

const RESEND_ENDPOINT = 'https://api.resend.com/emails'

export type EmailMessage = {
  to: string
  subject: string
  html: string
  text: string
  /** Copia operativa (tesorería / soporte). No usar en recupero de clave. */
  bcc?: string[]
}

export type EmailResult = { ok: boolean; delivered: boolean; error?: string }

function fromAddress(): string {
  return process.env.EMAIL_FROM ?? `${BRAND.company} <no-responder@${BRAND.domain}>`
}

export function opsMailbox() {
  return (process.env.EMAIL_OPS || BRAND.supportEmail || '').trim()
}

/** Origen HTTPS estable para imágenes en el mail (Gmail no carga SVG). */
export function emailOrigin() {
  const fallback = 'https://www.unicreditos.com'
  try {
    const u = new URL(publicBrandWebsite())
    if (u.hostname === 'localhost' || u.hostname === '127.0.0.1') return fallback
    if (u.hostname === 'unicreditos.com') return fallback
    return `${u.protocol}//${u.host}`
  } catch {
    return fallback
  }
}

export function emailLogoUrl() {
  // PNG 180×180: Gmail no renderiza SVG y el favicon /icon queda pixelado.
  return `${emailOrigin()}/apple-icon`
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

  const bcc = (message.bcc ?? []).map((v) => v.trim()).filter((v) => v && v.toLowerCase() !== message.to.toLowerCase())

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
        ...(bcc.length ? { bcc } : {}),
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

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function moneyLabel(value: string | number) {
  const n = Number(value)
  if (!Number.isFinite(n)) return String(value)
  return n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })
}

export function brandedEmailHtml(input: {
  title: string
  bodyHtml: string
  cta?: { href: string; label: string; danger?: boolean }
  footerNote?: string
}) {
  const logo = emailLogoUrl()
  const site = emailOrigin()
  const btn = input.cta
    ? `<p style="margin:0 0 24px">
        <a href="${escapeHtml(input.cta.href)}" style="display:inline-block;background:${input.cta.danger ? '#B42318' : '#0052D4'};color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-size:14px;font-weight:600">
          ${escapeHtml(input.cta.label)}
        </a>
      </p>`
    : ''
  const note = input.footerNote
    ? `<p style="font-size:12px;line-height:1.5;color:#7C94BC;margin:16px 0 0">${escapeHtml(input.footerNote)}</p>`
    : ''

  return `
  <div style="margin:0;padding:0;background:#e8eef6">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#e8eef6;padding:24px 12px">
      <tr>
        <td align="center">
          <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border:1px solid #d6dee8">
            <tr>
              <td style="background:#0B1D3A;padding:16px 24px">
                <table role="presentation" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="vertical-align:middle">
                      <img src="${logo}" width="40" height="40" alt="${escapeHtml(BRAND.company)}" style="display:block;border:0;border-radius:8px;width:40px;height:40px" />
                    </td>
                    <td style="vertical-align:middle;padding-left:12px">
                      <div style="font-family:Segoe UI,Helvetica,Arial,sans-serif;color:#ffffff;font-size:16px;font-weight:700;letter-spacing:0.04em">${escapeHtml(BRAND.company)}</div>
                      <div style="font-family:Segoe UI,Helvetica,Arial,sans-serif;color:#9fb0c9;font-size:11px">${escapeHtml(BRAND.slogan)}</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="font-family:Segoe UI,Helvetica,Arial,sans-serif;color:#0B2545;padding:28px 24px 8px">
                <h1 style="font-size:20px;line-height:1.3;margin:0 0 16px">${escapeHtml(input.title)}</h1>
                ${input.bodyHtml}
                ${btn}
              </td>
            </tr>
            <tr>
              <td style="font-family:Segoe UI,Helvetica,Arial,sans-serif;padding:8px 24px 24px;border-top:1px solid #e2e8f0">
                <p style="font-size:12px;line-height:1.5;color:#64748b;margin:16px 0 0">
                  ${escapeHtml(BRAND.legalName)} · CUIT ${escapeHtml(String(BRAND.cuit))} · ${escapeHtml(BRAND.address)}
                </p>
                <p style="font-size:12px;line-height:1.5;color:#64748b;margin:6px 0 0">
                  <a href="${site}" style="color:#0052D4;text-decoration:none">${escapeHtml(BRAND.domain)}</a>
                  · ${escapeHtml(BRAND.supportEmail)}
                </p>
                ${note}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </div>
  `.trim()
}

function brandedText(lines: string[]) {
  return [...lines, '', `${BRAND.company} — ${BRAND.legalName}`, BRAND.supportEmail, `https://${BRAND.domain}`].join('\n')
}

export function passwordResetEmail(url: string): Pick<EmailMessage, 'subject' | 'html' | 'text'> {
  const subject = `Restablecé tu contraseña de ${BRAND.company}`
  const text = brandedText([
    `Recibimos un pedido para restablecer la contraseña de tu cuenta ${BRAND.company}.`,
    '',
    `Entrá en este enlace para elegir una nueva: ${url}`,
    '',
    'El enlace vence en 1 hora y se puede usar una sola vez.',
    'Si no pediste el cambio, ignorá este mensaje: tu contraseña sigue siendo la misma.',
  ])
  const html = brandedEmailHtml({
    title: 'Restablecé tu contraseña',
    bodyHtml: `
      <p style="font-size:14px;line-height:1.6;margin:0 0 16px">Recibimos un pedido para restablecer la contraseña de tu cuenta ${escapeHtml(BRAND.company)}.</p>
      <p style="font-size:13px;line-height:1.6;color:#4F6FA4;margin:0 0 8px">El enlace vence en 1 hora y se puede usar una sola vez. Si no pediste el cambio, ignorá este mensaje.</p>
    `,
    cta: { href: url, label: 'Elegir nueva contraseña' },
  })
  return { subject, html, text }
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
  const text = brandedText([
    `${who},`,
    '',
    `Aprobamos tu crédito por ${moneyLabel(input.principal)} en ${input.term} cuotas.`,
    'Revisá el contrato de préstamo (mutuo) y el pagaré, y aceptalos para habilitar el desembolso.',
    '',
    input.contractUrl,
  ])
  const html = brandedEmailHtml({
    title: 'Contrato listo para firmar',
    bodyHtml: `
      <p style="font-size:14px;line-height:1.6;margin:0 0 16px">${escapeHtml(who)}, aprobamos tu crédito por <strong>${escapeHtml(moneyLabel(input.principal))}</strong> en ${input.term} cuotas.</p>
      <p style="font-size:14px;line-height:1.6;margin:0 0 24px">Revisá el contrato de préstamo (mutuo) y el pagaré. La firma habilita el desembolso.</p>
    `,
    cta: { href: input.contractUrl, label: 'Abrir expediente' },
  })
  return { to: input.to, subject, html, text, bcc: [opsMailbox()] }
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
  const text = brandedText([
    `${who},`,
    '',
    `Registramos ${input.overdueCount} cuota(s) vencida(s) por ${moneyLabel(input.amount)}.`,
    'Esta comunicación constituye intimación de pago y reserva de acciones, incluido el pagaré.',
    '',
    input.url,
  ])
  const html = brandedEmailHtml({
    title: 'Intimación de pago',
    bodyHtml: `
      <p style="font-size:14px;line-height:1.6;margin:0 0 16px">${escapeHtml(who)}, hay ${input.overdueCount} cuota(s) vencida(s) por <strong>${escapeHtml(moneyLabel(input.amount))}</strong>.</p>
      <p style="font-size:14px;line-height:1.6;margin:0 0 24px">Esta comunicación constituye intimación de pago y reserva de acciones, incluido el pagaré.</p>
    `,
    cta: { href: input.url, label: 'Ver intimación', danger: true },
  })
  return { to: input.to, subject, html, text, bcc: [opsMailbox()] }
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
  const html = brandedEmailHtml({
    title: 'Nueva consulta web',
    bodyHtml: `<pre style="font-family:Segoe UI,Helvetica,Arial,sans-serif;white-space:pre-wrap;font-size:14px;line-height:1.5;margin:0">${escapeHtml(text)}</pre>`,
  })
  return { to: BRAND.supportEmail, subject, html, text }
}

export function paymentReceivedEmail(input: {
  to: string
  name?: string | null
  amount: string | number
  installmentLabel?: string
  receiptUrl: string
}): EmailMessage {
  const who = input.name?.trim() || 'Hola'
  const cuota = input.installmentLabel ? ` (${input.installmentLabel})` : ''
  const subject = `Pago acreditado${cuota} — ${BRAND.company}`
  const text = brandedText([
    `${who},`,
    '',
    `Registramos un pago de ${moneyLabel(input.amount)}${cuota}.`,
    'El comprobante quedó en tu panel.',
    '',
    input.receiptUrl,
  ])
  const html = brandedEmailHtml({
    title: 'Pago acreditado',
    bodyHtml: `
      <p style="font-size:14px;line-height:1.6;margin:0 0 16px">${escapeHtml(who)}, registramos un pago de <strong>${escapeHtml(moneyLabel(input.amount))}</strong>${escapeHtml(cuota)}.</p>
      <p style="font-size:14px;line-height:1.6;margin:0 0 24px">El movimiento ya figura en tu cuenta. Conservá el comprobante.</p>
    `,
    cta: { href: input.receiptUrl, label: 'Ver comprobante' },
  })
  return { to: input.to, subject, html, text, bcc: [opsMailbox()] }
}

export function paymentRejectedEmail(input: {
  to: string
  name?: string | null
  amount: string | number
  reason?: string
  panelUrl: string
}): EmailMessage {
  const who = input.name?.trim() || 'Hola'
  const subject = `No pudimos acreditar un pago — ${BRAND.company}`
  const reason = input.reason?.trim() || 'El comprobante no se verificó.'
  const text = brandedText([
    `${who},`,
    '',
    `No pudimos acreditar ${moneyLabel(input.amount)}.`,
    reason,
    '',
    input.panelUrl,
  ])
  const html = brandedEmailHtml({
    title: 'Pago no acreditado',
    bodyHtml: `
      <p style="font-size:14px;line-height:1.6;margin:0 0 16px">${escapeHtml(who)}, no pudimos acreditar <strong>${escapeHtml(moneyLabel(input.amount))}</strong>.</p>
      <p style="font-size:14px;line-height:1.6;margin:0 0 24px">${escapeHtml(reason)}</p>
    `,
    cta: { href: input.panelUrl, label: 'Ir a pagos' },
  })
  return { to: input.to, subject, html, text, bcc: [opsMailbox()] }
}

export function loanRejectedEmail(input: {
  to: string
  name?: string | null
  reason: string
  panelUrl: string
}): EmailMessage {
  const who = input.name?.trim() || 'Hola'
  const subject = `Solicitud no aprobada — ${BRAND.company}`
  const text = brandedText([
    `${who},`,
    '',
    'Tu solicitud de crédito no fue aprobada en esta oportunidad.',
    input.reason,
    '',
    input.panelUrl,
  ])
  const html = brandedEmailHtml({
    title: 'Solicitud no aprobada',
    bodyHtml: `
      <p style="font-size:14px;line-height:1.6;margin:0 0 16px">${escapeHtml(who)}, tu solicitud de crédito no fue aprobada en esta oportunidad.</p>
      <p style="font-size:14px;line-height:1.6;margin:0 0 24px">${escapeHtml(input.reason)}</p>
    `,
    cta: { href: input.panelUrl, label: 'Ver solicitudes' },
  })
  return { to: input.to, subject, html, text, bcc: [opsMailbox()] }
}

export function disbursementEmail(input: {
  to: string
  name?: string | null
  amount: string | number
  receiptUrl: string
}): EmailMessage {
  const who = input.name?.trim() || 'Hola'
  const subject = `Desembolso acreditado — ${BRAND.company}`
  const text = brandedText([
    `${who},`,
    '',
    `Acreditamos ${moneyLabel(input.amount)} en la cuenta declarada.`,
    '',
    input.receiptUrl,
  ])
  const html = brandedEmailHtml({
    title: 'Desembolso acreditado',
    bodyHtml: `
      <p style="font-size:14px;line-height:1.6;margin:0 0 16px">${escapeHtml(who)}, acreditamos <strong>${escapeHtml(moneyLabel(input.amount))}</strong> en la cuenta declarada.</p>
      <p style="font-size:14px;line-height:1.6;margin:0 0 24px">El comprobante quedó disponible en tu panel.</p>
    `,
    cta: { href: input.receiptUrl, label: 'Ver comprobante' },
  })
  return { to: input.to, subject, html, text, bcc: [opsMailbox()] }
}

export function kycStatusEmail(input: {
  to: string
  name?: string | null
  status: 'approved' | 'rejected'
  panelUrl: string
}): EmailMessage {
  const who = input.name?.trim() || 'Hola'
  const ok = input.status === 'approved'
  const subject = ok ? `Identidad verificada — ${BRAND.company}` : `Identidad observada — ${BRAND.company}`
  const text = brandedText([
    `${who},`,
    '',
    ok
      ? 'Tu verificación de identidad quedó aprobada. Ya podés continuar con la solicitud.'
      : 'Tu verificación de identidad fue observada. Revisá el detalle en el panel o volvé a intentar.',
    '',
    input.panelUrl,
  ])
  const html = brandedEmailHtml({
    title: ok ? 'Identidad verificada' : 'Identidad observada',
    bodyHtml: ok
      ? `<p style="font-size:14px;line-height:1.6;margin:0 0 24px">${escapeHtml(who)}, tu verificación de identidad quedó aprobada. Ya podés continuar con la solicitud.</p>`
      : `<p style="font-size:14px;line-height:1.6;margin:0 0 24px">${escapeHtml(who)}, tu verificación de identidad fue observada. Revisá el detalle en el panel o volvé a intentar.</p>`,
    cta: { href: input.panelUrl, label: 'Abrir panel' },
  })
  return { to: input.to, subject, html, text }
}
