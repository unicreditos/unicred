/** Persiste comprobantes como data URL en Postgres (Vercel no tiene disco durable). */

const MAX_FILE_BYTES = 1_500_000
const MAX_DATA_URL = 2_100_000

const ALLOWED: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

export async function fileToDbProof(file: File): Promise<{ dataUrl: string; ext: string }> {
  if (!(file instanceof File) || file.size < 32) {
    throw new Error('Subí el comprobante (PDF o imagen).')
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new Error('El archivo no puede superar 1,5 MB.')
  }
  const ext = ALLOWED[file.type]
  if (!ext) throw new Error('Formato no válido. Usá PDF, JPG, PNG o WebP.')

  const mime = file.type === 'image/jpg' ? 'image/jpeg' : file.type
  const dataUrl = `data:${mime};base64,${Buffer.from(await file.arrayBuffer()).toString('base64')}`
  if (dataUrl.length > MAX_DATA_URL) {
    throw new Error('El comprobante es demasiado pesado. Probá uno más liviano.')
  }
  return { dataUrl, ext }
}
