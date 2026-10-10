import { brandIconElement } from '@/lib/brand-icon'
import { ImageResponse } from 'next/og'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  return new ImageResponse(brandIconElement(size.width), { ...size })
}
