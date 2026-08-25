import { ImageResponse } from 'next/og'

export const size = { width: 32, height: 32 }
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0B1D3A',
          borderRadius: 8,
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
              width: 16,
              height: 10,
              background: '#00C853',
              borderRadius: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#0B1D3A',
              fontSize: 8,
              fontWeight: 700,
            }}
          >
            $
          </div>
          <div
            style={{
              marginTop: 2,
              width: 18,
              height: 8,
              background: '#F5F7FA',
              borderRadius: '8px 8px 3px 3px',
            }}
          />
        </div>
      </div>
    ),
    { ...size },
  )
}
