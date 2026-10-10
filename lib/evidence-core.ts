/** Nucleo puro de la evidencia KYC versionada (sin base de datos). */
import { createHash, timingSafeEqual } from 'node:crypto'

export const EVIDENCE_KINDS = ['dni_front', 'dni_back', 'selfie', 'video'] as const
export type EvidenceKind = (typeof EVIDENCE_KINDS)[number]

export const EVIDENCE_LABEL: Record<EvidenceKind, string> = {
  dni_front: 'DNI frente',
  dni_back: 'DNI dorso',
  selfie: 'Selfie',
  video: 'Video de prueba de vida',
}

export const LEGACY_COLUMN: Record<EvidenceKind, 'dniFrontImageUrl' | 'dniBackImageUrl' | 'selfieImageUrl' | 'videoUrl'> = {
  dni_front: 'dniFrontImageUrl',
  dni_back: 'dniBackImageUrl',
  selfie: 'selfieImageUrl',
  video: 'videoUrl',
}

export function isEvidenceKind(v: string): v is EvidenceKind {
  return (EVIDENCE_KINDS as readonly string[]).includes(v)
}

const ALLOWED_MIME = /^(image\/(jpeg|jpg|png|webp)|video\/[a-z0-9.+-]+)$/i

export function parseDataUrl(value: string | null | undefined): { mime: string; bytes: Buffer } | null {
  if (!value || !value.startsWith('data:')) return null
  const m = /^data:([^;,]+)(;base64)?,([\s\S]*)$/.exec(value)
  if (!m) return null
  const mime = m[1].toLowerCase()
  if (!ALLOWED_MIME.test(mime)) return null
  const bytes = m[2] ? Buffer.from(m[3], 'base64') : Buffer.from(decodeURIComponent(m[3]), 'utf8')
  if (bytes.byteLength === 0) return null
  return { mime, bytes }
}

export function sha256Of(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex')
}

export function hashMatches(bytes: Buffer, expectedHex: string): boolean {
  const actual = Buffer.from(sha256Of(bytes), 'hex')
  const expected = Buffer.from(String(expectedHex).trim().toLowerCase(), 'hex')
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

/** Decide que hacer al llegar un archivo nuevo: crear version 1, crear version N+1 o ignorar (mismo contenido). */
export function nextVersionDecision(
  latest: { version: number; sha256: string } | null,
  incomingSha256: string,
): { action: 'create'; version: number } | { action: 'skip'; version: number } {
  if (!latest) return { action: 'create', version: 1 }
  if (latest.sha256.toLowerCase() === incomingSha256.toLowerCase()) return { action: 'skip', version: latest.version }
  return { action: 'create', version: latest.version + 1 }
}

/** Cabeceras de entrega: nunca se cachea, no se interpreta como otra cosa y no se embebe en otros sitios. */
export function evidenceResponseHeaders(input: { mime: string; sha256: string; filename: string; size: number }): Record<string, string> {
  return {
    'Content-Type': input.mime,
    'Content-Length': String(input.size),
    'Content-Disposition': `inline; filename="${input.filename.replace(/[^a-zA-Z0-9._-]/g, '_')}"`,
    'Cache-Control': 'no-store, no-cache, must-revalidate, private',
    Pragma: 'no-cache',
    'X-Content-Type-Options': 'nosniff',
    'X-Evidence-SHA256': input.sha256,
    'Content-Security-Policy': "default-src 'none'; img-src 'self' data:; media-src 'self'; sandbox",
    'Cross-Origin-Resource-Policy': 'same-origin',
    'Referrer-Policy': 'no-referrer',
    'X-Robots-Tag': 'noindex, nofollow',
  }
}