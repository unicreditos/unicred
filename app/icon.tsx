import { brandIconElement } from '@/lib/brand-icon'
import { ImageResponse } from 'next/og'

export const size = { width: 32, height: 32 }
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(brandIconElement(size.width), { ...size })
}
