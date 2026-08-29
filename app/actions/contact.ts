'use server'

import { headers } from 'next/headers'
import { inquiryEmail, sendEmail } from '@/lib/email'
import { BRAND } from '@/lib/brand'
import { consumeRateLimit } from '@/lib/rate-limit'

function clientKey() {
  return headers().then((h) => {
    const forwarded = h.get('x-forwarded-for')?.split(',')[0]?.trim()
    const realIp = h.get('x-real-ip')?.trim()
    return forwarded || realIp || 'anonymous'
  })
}

export async function submitPublicInquiry(input: {
  kind: 'contacto'
  name: string
  email: string
  phone?: string
  subjectLine: string
  message: string
}) {
  const ip = await clientKey()
  const limit = consumeRateLimit(`contact:${ip}`, 5, 15 * 60 * 1000)
  if (!limit.ok) {
    throw new Error('Demasiados mensajes desde esta red. Probá de nuevo en unos minutos.')
  }

  const name = String(input.name ?? '').trim()
  const email = String(input.email ?? '').trim()
  const message = String(input.message ?? '').trim()
  const subjectLine = String(input.subjectLine ?? '').trim() || 'Consulta'
  if (name.length < 3) throw new Error('Ingresá tu nombre completo.')
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Ingresá un email válido.')
  if (message.length < 10) throw new Error('El mensaje es demasiado corto.')

  const payload = inquiryEmail({
    kind: input.kind,
    name,
    email,
    phone: input.phone?.trim(),
    subjectLine,
    message,
  })
  payload.to = BRAND.supportEmail
  const result = await sendEmail(payload)
  if (!result.ok) {
    throw new Error('No pudimos enviar el mensaje. Escribinos a ' + BRAND.supportEmail)
  }
  return { ok: true as const, delivered: result.delivered }
}
