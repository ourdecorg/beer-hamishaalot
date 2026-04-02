import { ImageResponse } from 'next/og'
import { readFileSync } from 'fs'
import { join } from 'path'

export const runtime = 'nodejs'   // fs is not available on Edge runtime

export const size        = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function Image() {
  const logoBuffer = readFileSync(join(process.cwd(), 'public', 'logo.png'))
  const logoSrc    = `data:image/png;base64,${logoBuffer.toString('base64')}`

  return new ImageResponse(
    (
      <div style={{
        width: '1200px',
        height: '630px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(160deg, #000000 0%, #1e1b4b 60%, #1e3a5f 100%)',
      }}>

        {/* Glow ring around logo */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '24px',
          boxShadow: '0 0 80px 20px rgba(99,102,241,0.45)',
        }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={logoSrc}
            width={320}
            height={320}
            alt=""
            style={{ borderRadius: '16px' }}
          />
        </div>

        {/* Title */}
        <div style={{
          fontSize: '52px',
          fontWeight: 700,
          color: '#ffffff',
          marginTop: '28px',
          fontFamily: 'system-ui, sans-serif',
          letterSpacing: '-0.5px',
        }}>
          Well of Wishes
        </div>

        {/* Subtitle */}
        <div style={{
          fontSize: '24px',
          fontWeight: 400,
          color: '#94a3b8',
          marginTop: '12px',
          fontFamily: 'system-ui, sans-serif',
        }}>
          Where wishes meet people
        </div>

      </div>
    ),
    { width: 1200, height: 630 },
  )
}
