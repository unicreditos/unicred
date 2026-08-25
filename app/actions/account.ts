'use server'

import { db } from '@/lib/db'
import { user } from '@/lib/db/schema'
import { requireUserId } from '@/lib/session'
import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

/** Tope del string data URL en `user.image` (JPEG comprimido en cliente). */
const MAX_DATA_URL = 1_400_000

export async function updateMyAvatar(formData: FormData) {
  const userId = await requireUserId()

  const fromDataUrl = formData.get('avatarDataUrl')
  let image: string | null = null

  if (typeof fromDataUrl === 'string' && fromDataUrl.startsWith('data:image/')) {
    image = fromDataUrl
  } else {
    const file = formData.get('avatar')
    if (!(file instanceof File) || file.size === 0) {
      return { ok: false as const, error: 'Elegí una imagen.' }
    }
    if (file.size > 1_000_000) {
      return { ok: false as const, error: 'La foto no puede superar 1 MB.' }
    }
    const allowed = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp'])
    if (!allowed.has(file.type)) {
      return { ok: false as const, error: 'Usá JPG, PNG o WebP.' }
    }
    const mime = file.type === 'image/jpg' ? 'image/jpeg' : file.type
    const buffer = Buffer.from(await file.arrayBuffer())
    image = `data:${mime};base64,${buffer.toString('base64')}`
  }

  if (!image || image.length > MAX_DATA_URL) {
    return { ok: false as const, error: 'La foto es demasiado pesada. Probá una más chica.' }
  }

  await db.update(user).set({ image, updatedAt: new Date() }).where(eq(user.id, userId))
  revalidatePath('/', 'layout')
  return { ok: true as const, image }
}
