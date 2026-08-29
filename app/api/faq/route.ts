import { mobileJson, mobileOptions } from '@/lib/mobile/cors'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export function OPTIONS(req: Request) {
  return mobileOptions(req)
}

export async function GET(req: Request) {
  return mobileJson(req, {
    items: [
      {
        id: 'faq-1',
        question: '¿Cómo pido un crédito?',
        answer: 'Desde la app o en www.unicreditos.com creá tu cuenta, verificá identidad (Didit) y solicitá el producto.',
      },
      {
        id: 'faq-2',
        question: '¿Cómo pago una cuota?',
        answer: 'Podés pagar con Mercado Pago, transferencia o saldo de tu billetera UNICRÉDITOS.',
      },
      {
        id: 'faq-3',
        question: '¿La app usa la misma cuenta que la web?',
        answer: 'Sí. Misma base Neon, mismos usuarios y misma billetera.',
      },
    ],
  })
}
