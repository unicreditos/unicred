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

  const cardW = Math.round(size * 0.48)
  const cardH = Math.round(size * 0.3)
  const baseW = Math.round(size * 0.53)
  const baseH = Math.round(size * 0.23)

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0C1612',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              width: cardW,
              height: cardH,
              background: '#20BD5A',
              borderRadius: Math.round(size * 0.055),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#0C1612',
              fontSize: Math.round(size * 0.2),
              fontWeight: 700,
            }}
          >
            $
          </div>
          <div
            style={{
              marginTop: Math.round(size * 0.055),
              width: baseW,
              height: baseH,
              background: '#F7F8F6',
              borderRadius: `${Math.round(size * 0.155)}px ${Math.round(size * 0.155)}px ${Math.round(size * 0.078)}px ${Math.round(size * 0.078)}px`,
            }}
          />
        </div>
      </div>
    ),
    { width: size, height: size },
  )
}
