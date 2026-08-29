import { ImageResponse } from 'next/og'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
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
              width: 86,
              height: 54,
              background: '#20BD5A',
              borderRadius: 10,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#0C1612',
              fontSize: 36,
              fontWeight: 700,
            }}
          >
            $
          </div>
          <div
            style={{
              marginTop: 10,
              width: 96,
              height: 42,
              background: '#F5F7FA',
              borderRadius: '28px 28px 14px 14px',
            }}
          />
        </div>
      </div>
    ),
    { ...size },
  )
}
