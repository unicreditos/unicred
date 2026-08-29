import { mobileJson, mobileOptions } from '@/lib/mobile/cors'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export function OPTIONS(req: Request) {
  return mobileOptions(req)
}

export async function GET(req: Request) {
  return mobileJson(req, {
    items: [
      { id: 'luz', name: 'Luz', category: 'servicios' },
      { id: 'gas', name: 'Gas', category: 'servicios' },
      { id: 'agua', name: 'Agua', category: 'servicios' },
      { id: 'internet', name: 'Internet / TV', category: 'servicios' },
      { id: 'celular', name: 'Celular', category: 'servicios' },
    ],
  })
}
