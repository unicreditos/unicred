import { brandIconElement } from '@/lib/brand-icon'
import { ImageResponse } from 'next/og'

export const runtime = 'nodejs'

const SIZES = new Set([192, 512])

export async function GET(
  _req: Request,
  context: { params: Promise<{ size: string }> },
) {
  const { size: raw } = await context.params
  const size = Number(raw)
  if (!SIZES.has(size)) {
    return new Response('Not found', { status: 404 })
  }

  return new ImageResponse(brandIconElement(size), { width: size, height: size })
}
