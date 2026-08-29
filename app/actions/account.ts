'use server'

import { randomBytes } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { db } from '@/lib/db'
import { user } from '@/lib/db/schema'
import { requireUserId } from '@/lib/session'
import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

const MAX_BYTES = 1_000_000
const ALLOWED = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp'])

function extFor(mime: string) {
  if (mime === 'image/png') return 'png'
  if (mime === 'image/webp') return 'webp'
  return 'jpg'
}

async function persistAvatarFile(userId: string, buffer: Buffer, mime: string) {
  const dir = path.join(process.cwd(), 'public', 'uploads', 'avatars')
  await mkdir(dir, { recursive: true })
  const name = `${userId.slice(0, 12)}-${randomBytes(8).toString('hex')}.${extFor(mime)}`
  await writeFile(path.join(dir, name), buffer)
  return `/uploads/avatars/${name}`
}

function parseDataUrl(dataUrl: string): { mime: string; buffer: Buffer } | null {
  const m = /^data:(image\/(?:jpeg|jpg|png|webp));base64,(.+)$/i.exec(dataUrl)
  if (!m?.[1] || !m[2]) return null
  const mime = m[1].toLowerCase() === 'image/jpg' ? 'image/jpeg' : m[1].toLowerCase()
  return { mime, buffer: Buffer.from(m[2], 'base64') }
}

/** Guarda avatar en disco y deja en `user.image` solo la URL pública (nunca data-URL). */
export async function updateMyAvatar(formData: FormData) {
  const userId = await requireUserId()

  let buffer: Buffer | null = null
  let mime = 'image/jpeg'

  const file = formData.get('avatar')
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_BYTES) {
      return { ok: false as const, error: 'La foto no puede superar 1 MB.' }
    }
    if (!ALLOWED.has(file.type)) {
      return { ok: false as const, error: 'Usá JPG, PNG o WebP.' }
    }
    mime = file.type === 'image/jpg' ? 'image/jpeg' : file.type
    buffer = Buffer.from(await file.arrayBuffer())
  } else {
    const fromDataUrl = formData.get('avatarDataUrl')
    if (typeof fromDataUrl === 'string' && fromDataUrl.startsWith('data:image/')) {
      const parsed = parseDataUrl(fromDataUrl)
      if (!parsed) return { ok: false as const, error: 'Imagen inválida.' }
      if (parsed.buffer.length > MAX_BYTES) {
        return { ok: false as const, error: 'La foto es demasiado pesada. Probá una más chica.' }
      }
      mime = parsed.mime
      buffer = parsed.buffer
    }
  }

  if (!buffer) {
    return { ok: false as const, error: 'Elegí una imagen.' }
  }

  const image = await persistAvatarFile(userId, buffer, mime)
  await db.update(user).set({ image, updatedAt: new Date() }).where(eq(user.id, userId))
  revalidatePath('/', 'layout')
  return { ok: true as const, image }
}
