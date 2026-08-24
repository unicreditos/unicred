import { NextResponse } from 'next/server'
import { getProviderStatus } from '@/lib/provider-adapters'

export const runtime = 'nodejs'

export async function GET() {
  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    providers: getProviderStatus(),
  })
}
