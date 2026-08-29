import { NextResponse } from 'next/server'

const ALLOWED = new Set([
  'https://www.unicreditos.com',
  'https://unicreditos.com',
  'https://unicred-one.vercel.app',
  'http://localhost:3000',
  'http://localhost:8081',
  'http://127.0.0.1:8081',
  'exp://localhost:8081',
])

function isAllowedOrigin(origin: string | null) {
  if (!origin) return true // native apps often omit Origin
  if (ALLOWED.has(origin)) return true
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)) return true
  if (/^exp:\/\//i.test(origin)) return true
  if (/^unicreditos:\/\//i.test(origin)) return true
  const extra = (process.env.MOBILE_CORS_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  return extra.includes(origin)
}

export function mobileCorsHeaders(req: Request): HeadersInit {
  const origin = req.headers.get('origin')
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, Accept, X-Requested-With',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
  if (origin && isAllowedOrigin(origin)) {
    headers['Access-Control-Allow-Origin'] = origin
    headers['Access-Control-Allow-Credentials'] = 'true'
  } else if (!origin) {
    headers['Access-Control-Allow-Origin'] = '*'
  }
  return headers
}

export function withMobileCors(req: Request, res: NextResponse) {
  const cors = mobileCorsHeaders(req)
  for (const [k, v] of Object.entries(cors)) res.headers.set(k, v)
  return res
}

export function mobileJson(req: Request, body: unknown, init?: { status?: number }) {
  return withMobileCors(req, NextResponse.json(body, { status: init?.status ?? 200 }))
}

export function mobileOptions(req: Request) {
  return withMobileCors(req, new NextResponse(null, { status: 204 }))
}
