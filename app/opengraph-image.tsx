import { GROUP } from '@/lib/brand'
import { ImageResponse } from 'next/og'

export const alt = 'UNICRÉDITOS — Créditos digitales en Argentina'

export const size = {
  width: 1200,
  height: 630,
}

export const contentType = 'image/png'

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          backgroundColor: '#0C1612',
          padding: 80,
          fontFamily: 'sans-serif',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            color: '#6EE7B7',
            fontSize: 26,
            fontWeight: 600,
            letterSpacing: 4,
            textTransform: 'uppercase',
          }}
        >
          <div
            style={{
              display: 'flex',
              width: 14,
              height: 14,
              borderRadius: 14,
              backgroundColor: '#20BD5A',
            }}
          />
          {GROUP.name}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              display: 'flex',
              color: '#ffffff',
              fontSize: 148,
              fontWeight: 800,
              letterSpacing: -4,
              lineHeight: 1,
            }}
          >
            UNICRÉDITOS
          </div>
          <div
            style={{
              display: 'flex',
              marginTop: 28,
              color: '#e8f9ee',
              fontSize: 52,
              fontWeight: 500,
              lineHeight: 1.2,
            }}
          >
            Créditos digitales en Argentina
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderTop: '2px solid rgba(255,255,255,0.2)',
            paddingTop: 32,
            color: '#9AADA3',
            fontSize: 28,
          }}
        >
          <div style={{ display: 'flex' }}>
            Préstamos personales · Consumo · Comercios adheridos
          </div>
          <div style={{ display: 'flex', color: '#ffffff', fontWeight: 700 }}>unicreditos.com</div>
        </div>
      </div>
    ),
    { ...size },
  )
}
