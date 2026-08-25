import { getPublicMarketBoardCached } from '@/lib/bcra-market'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const revalidate = 900

export async function GET() {
  try {
    const board = await getPublicMarketBoardCached()
    return NextResponse.json(board, {
      headers: {
        'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=1800',
      },
    })
  } catch (err) {
    return NextResponse.json(
      {
        updatedAt: new Date().toISOString(),
        source: 'empty',
        fx: [],
        indicators: [],
        ticker: 'Cotizaciones BCRA',
        error: (err as Error).message,
      },
      { status: 503 },
    )
  }
}
