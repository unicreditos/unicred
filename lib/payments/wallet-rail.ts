/**
 * Rieles de ejecución detrás del ledger UNICRÉDITOS.
 * La plataforma siempre mueve saldo propio; estos adaptadores solo empujan
 * la transferencia bancaria real (Pomelo / cola de tesorería RM).
 */

import { TREASURY_ACCOUNT } from '@/lib/treasury'
import type { WalletDestination } from '@/lib/payments/cvu'

export type RailResult = {
  rail: 'treasury_rm' | 'pomelo'
  ok: boolean
  queued: boolean
  providerPayload?: unknown
  message?: string
}

function pomeloConfigured() {
  return Boolean(process.env.POMELO_CLIENT_ID?.trim() && process.env.POMELO_CLIENT_SECRET?.trim())
}

/**
 * Intenta ejecutar un egreso externo.
 * Orden: Pomelo (si hay cuentas) → cola tesorería RM (siempre disponible).
 */
export async function executeExternalRail(input: {
  reference: string
  amount: number
  originCvu: string
  originAlias: string
  destination: WalletDestination
  concept: string
  pomeloSourceAccountId?: string | null
  pomeloDestinationAccountId?: string | null
}): Promise<RailResult> {
  if (
    pomeloConfigured() &&
    input.pomeloSourceAccountId &&
    input.pomeloDestinationAccountId
  ) {
    return {
      rail: 'pomelo',
      ok: true,
      queued: true,
      message: 'Orden Pomelo registrada (pendiente de cuentas digitales live).',
      providerPayload: {
        path: '/core/transactions/v1/p2p',
        source_account_id: input.pomeloSourceAccountId,
        destination_account_id: input.pomeloDestinationAccountId,
        total_amount: input.amount.toFixed(2),
        reference: input.reference,
      },
    }
  }

  return {
    rail: 'treasury_rm',
    ok: true,
    queued: true,
    providerPayload: {
      from: {
        holder: TREASURY_ACCOUNT.holder,
        cuit: TREASURY_ACCOUNT.cuit,
        cbu: TREASURY_ACCOUNT.cbu,
        bank: TREASURY_ACCOUNT.bank,
      },
      originCvu: input.originCvu,
      originAlias: input.originAlias,
      destination: input.destination,
      amount: input.amount,
      concept: input.concept,
      reference: input.reference,
    },
    message: 'Orden en cola de tesorería RM.',
  }
}

export function treasuryOriginLabel() {
  return `${TREASURY_ACCOUNT.holder} · CBU ${TREASURY_ACCOUNT.cbu}`
}
