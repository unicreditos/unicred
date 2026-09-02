/**
 * Persistencia de capturas biométricas de Didit.
 *
 * Didit sirve las imágenes/video (frente, dorso, selfie, liveness) desde URLs
 * temporales (S3 firmado) que expiran. Si solo guardamos la URL, cuando expira
 * el admin y el cliente dejan de ver la evidencia — un problema de auditoría y
 * compliance. Este módulo descarga esas capturas una vez y las devuelve como
 * data URL para persistirlas en `kyc_verification` (columnas text).
 */

// Límite por archivo: las capturas de documento/selfie de Didit rondan 100–400 KB.
// El video de liveness puede ser más pesado; lo capamos aparte.
const MAX_IMAGE_BYTES = 3_000_000 // 3 MB por imagen
const MAX_VIDEO_BYTES = 8_000_000 // 8 MB por video de prueba de vida
const FETCH_TIMEOUT_MS = 15_000

const IMAGE_MIME = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp'])
const VIDEO_MIME_PREFIX = 'video/'

function isHttpUrl(value: string | null | undefined): value is string {
  if (!value) return false
  return /^https?:\/\//i.test(value.trim())
}

/** Si ya es un data URL persistido, no hay nada que descargar. */
function isDataUrl(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.startsWith('data:')
}

/**
 * Descarga una URL de Didit y la devuelve como data URL base64.
 * Devuelve null si falla, excede el tamaño o el tipo no es válido:
 * nunca rompe el flujo de KYC por un problema de descarga de evidencia.
 */
export async function fetchDiditMediaAsDataUrl(
  url: string | null | undefined,
  kind: 'image' | 'video' = 'image',
): Promise<string | null> {
  if (!isHttpUrl(url)) return isDataUrl(url) ? url : null

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(url, { signal: controller.signal, cache: 'no-store' })
    if (!res.ok) return null

    const contentType = (res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase()
    const isVideo = kind === 'video' || contentType.startsWith(VIDEO_MIME_PREFIX)
    const maxBytes = isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES

    if (!isVideo && contentType && !IMAGE_MIME.has(contentType)) return null

    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.byteLength === 0 || buf.byteLength > maxBytes) return null

    const mime = contentType || (isVideo ? 'video/mp4' : 'image/jpeg')
    return `data:${mime};base64,${buf.toString('base64')}`
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}

export type PersistedKycMedia = {
  dniFrontImageUrl: string | null
  dniBackImageUrl: string | null
  selfieImageUrl: string | null
  videoUrl: string | null
}

/**
 * Dado el bundle de media resuelto de la decisión Didit, descarga y devuelve
 * las capturas como data URLs. Solo descarga las que todavía no están
 * persistidas (evita re-bajar en cada reintento del webhook).
 */
export async function persistKycMedia(
  media: { front?: string | null; back?: string | null; selfie?: string | null; video?: string | null },
  existing?: Partial<PersistedKycMedia> | null,
): Promise<PersistedKycMedia> {
  // Si ya hay un data URL persistido, se conserva; si no, se intenta descargar.
  const resolve = (current: string | null | undefined, url: string | null | undefined, kind: 'image' | 'video') =>
    isDataUrl(current) ? Promise.resolve<string | null>(current) : fetchDiditMediaAsDataUrl(url, kind)

  const [front, back, selfie, video] = await Promise.all([
    resolve(existing?.dniFrontImageUrl, media.front, 'image'),
    resolve(existing?.dniBackImageUrl, media.back, 'image'),
    resolve(existing?.selfieImageUrl, media.selfie, 'image'),
    resolve(existing?.videoUrl, media.video, 'video'),
  ])

  return {
    dniFrontImageUrl: front,
    dniBackImageUrl: back,
    selfieImageUrl: selfie,
    videoUrl: video,
  }
}
