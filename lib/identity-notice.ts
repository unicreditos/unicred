/**
 * Identidad (Didit/KYC) de quienes originaron creditos y aviso para quienes no la completaron.
 * Modulo puro: sin base de datos ni envio. "Paso de identidad" = la verificacion Didit aprobada y
 * vigente (12 meses) con profile.kycStatus = approved, igual que lib/didit.ts#diditApprovedForUser.
 * (No existe una etiqueta "Key 6" en el codigo ni en los docs: se asume que es este paso.)
 */
import { BRAND } from '@/lib/brand'
import { brandedEmailHtml, emailOrigin, type EmailMessage } from '@/lib/email'
import { isKycFresh } from '@/lib/kyc-validity'

export type IdentityFacts = {
  provider: string | null
  status: string | null
  expiresAt?: Date | string | null
  reviewedAt?: Date | string | null
  updatedAt?: Date | string | null
  profileKycStatus: string | null
  hasRecord: boolean
}

export type IdentityCode = 'ok' | 'no_record' | 'not_didit' | 'not_approved' | 'expired' | 'profile_not_approved'

const toDate = (v: Date | string | null | undefined) => (v ? new Date(v) : null)

export function identityCheck(f: IdentityFacts, now: Date = new Date()): IdentityCode {
  if (!f.hasRecord) return 'no_record'
  if (f.provider !== 'didit') return 'not_didit'
  if (f.status !== 'approved') return 'not_approved'
  if (!isKycFresh({ expiresAt: toDate(f.expiresAt), reviewedAt: toDate(f.reviewedAt), updatedAt: toDate(f.updatedAt) }, now)) return 'expired'
  if (f.profileKycStatus !== 'approved') return 'profile_not_approved'
  return 'ok'
}

export const IDENTITY_CODE_LABELS: Record<IdentityCode, string> = {
  ok: 'Identidad verificada',
  no_record: 'Sin verificaci\u00f3n iniciada',
  not_didit: 'Verificaci\u00f3n no hecha con Didit',
  not_approved: 'Verificaci\u00f3n no aprobada',
  expired: 'Verificaci\u00f3n vencida',
  profile_not_approved: 'Perfil sin identidad aprobada',
}

/** CUIL enmascarado: solo los ultimos 3 digitos. */
export function maskCuil(cuil: string | null | undefined): string {
  const d = String(cuil ?? '').replace(/\D/g, '')
  return d.length >= 3 ? `***${d.slice(-3)}` : '***'
}

export function maskEmail(email: string | null | undefined): string {
  const [l, d] = String(email ?? '').split('@')
  return l && d ? `${l.slice(0, 1)}***@${d}` : '***'
}

/** Hora (HH) del dia en Argentina para informes. */
export function arHour(v: Date | string): string {
  return new Intl.DateTimeFormat('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(v))
}

/** Dia calendario de Argentina (YYYY-MM-DD) y sus limites con offset fijo -03:00. */
export function arDayBounds(day: string): { start: string; end: string } {
  const d = new Date(`${day}T00:00:00-03:00`)
  if (Number.isNaN(d.getTime())) throw new Error('Fecha invalida (usar YYYY-MM-DD).')
  const next = new Date(d.getTime() + 24 * 3600 * 1000)
  return { start: d.toISOString(), end: next.toISOString() }
}

export function arToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }).format(now)
}

export const IDENTITY_NOTICE_ACTION = 'IDENTITY_NOTICE_SENT'
export const IDENTITY_VERIFY_PATH = '/dashboard/perfil/identidad'

export function identityVerifyUrl(): string {
  return `${emailOrigin()}${IDENTITY_VERIFY_PATH}`
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string)

/** Mail para quien tiene una solicitud pero no completo la verificacion de identidad. */
export function identityRequiredEmail(input: { to: string; name?: string | null; verifyUrl: string }): EmailMessage {
  const who = input.name?.trim() || 'Hola'
  const subject = `Complet\u00e1 la verificaci\u00f3n de tu identidad \u2013 ${BRAND.company}`
  const p = 'font-size:14px;line-height:1.6;margin:0 0 16px'
  const text = [
    `${who},`,
    '',
    'Para continuar con tu solicitud de cr\u00e9dito necesitamos que completes la verificaci\u00f3n de tu identidad (foto del DNI y prueba de vida). Lleva pocos minutos.',
    'Tu solicitud sigue en revisi\u00f3n y no se modifica por este aviso.',
    '',
    input.verifyUrl,
    '',
    `${BRAND.company} \u2013 ${BRAND.legalName}`,
    BRAND.supportEmail,
  ].join('\n')
  const html = brandedEmailHtml({
    title: 'Complet\u00e1 la verificaci\u00f3n de tu identidad',
    bodyHtml:
      `<p style="${p}">${esc(who)}, para continuar con tu solicitud de cr\u00e9dito necesitamos que completes la verificaci\u00f3n de tu identidad (foto del DNI y prueba de vida). Lleva pocos minutos.</p>` +
      `<p style="${p}">Tu solicitud sigue en revisi\u00f3n y no se modifica por este aviso.</p>`,
    cta: { href: input.verifyUrl, label: 'Verificar mi identidad' },
    footerNote: 'Si ya verificaste tu identidad en las \u00faltimas horas, ignor\u00e1 este mensaje.',
  })
  return { to: input.to, subject, html, text }
}

/** Aviso dentro de la app (bandeja del cliente): se arma solo, sin escribir nada en la base. */
export function identityInboxNotice(code: IdentityCode, hasOpenLoan: boolean) {
  if (code === 'ok' || !hasOpenLoan) return null
  return {
    id: 'identity-required',
    title: 'Complet\u00e1 la verificaci\u00f3n de tu identidad',
    detail: 'Necesitamos validar tu DNI y prueba de vida para continuar con tu solicitud.',
    href: IDENTITY_VERIFY_PATH,
    tone: 'warn' as const,
  }
}