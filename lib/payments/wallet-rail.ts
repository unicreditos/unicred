/**
 * Rieles de ejecución detrás del ledger UNICRÉDITOS.
 * La plataforma siempre mueve saldo propio; estos adaptadores solo empujan
 * la transferencia bancaria real (Payway / Pomelo / cola de tesorería RM).
 */

import { createPaywayTransferLive, isPaywayConfigured } from '@/lib/payway'
import { TREASURY_ACCOUNT } from '@/lib/treasury'
import type { WalletDestination } from '@/lib/payments/cvu'

export type RailResult = {
  rail: 'treasury_rm' | 'payway' | 'pomelo' | 'ledger_only'
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
 * Orden: Payway live (si hay keys) → cola tesorería RM (siempre disponible).
 * Pomelo queda preparado para cuando existan cuentas digitales live.
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
    // Contrato Pomelo P2P: POST /core/transactions/v1/p2p
    // Hasta tener cuentas live, no llamamos la red: dejamos payload listo.
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

  if (isPaywayConfigured()) {
    try {
      const live = await createPaywayTransferLive({
        reference: input.reference,
        amount: input.amount,
        originCvu: input.originCvu,
        originAlias: input.originAlias,
        destination: input.destination,
        concept: input.concept,
      })
      return {
        rail: 'payway',
        ok: Boolean(live.ok),
        queued: !live.ok,
        providerPayload: live,
        message: live.ok
          ? 'Transferencia enviada al riel Payway.'
          : 'Payway no confirmó; queda en cola de tesorería RM.',
      }
    } catch (err) {
      return {
        rail: 'treasury_rm',
        ok: true,
        queued: true,
        providerPayload: { paywayError: err instanceof Error ? err.message : 'error' },
        message: 'Payway no disponible; orden en cola de tesorería RM.',
      }
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
      to: input.destination,
      amount: input.amount,
      concept: input.concept,
      reference: input.reference,
    },
    message:
      'Débito en ledger OK. Tesorería RM ejecutará la transferencia a la cuenta destino del cliente.',
  }
}

export function treasuryOriginLabel() {
  return `${TREASURY_ACCOUNT.holder} · CBU ${TREASURY_ACCOUNT.cbu}`
}
