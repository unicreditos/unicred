import { diditApprovedForUser } from '@/lib/didit'
import {
  gateDecision,
  gateMode,
  IDENTITY_REQUIRED_MESSAGE,
  type GateScope,
} from '@/lib/kyc-validity'

export class IdentityNotApprovedError extends Error {
  code = 'IDENTITY_NOT_APPROVED' as const
  constructor() {
    super(IDENTITY_REQUIRED_MESSAGE)
  }
}

/** Exige Didit APROBADO y vigente (12 meses) antes de operar. ONBOARDING_GATE=off|warn|enforce (por defecto enforce). */
export async function assertVerifiedCustomer(userId: string, scope: GateScope): Promise<void> {
  const mode = gateMode()
  if (mode === 'off') return
  const approved = await diditApprovedForUser(userId)
  const decision = gateDecision(mode, approved)
  if (decision === 'warn') {
    console.warn(`[onboarding-gate] ${scope}: identidad no aprobada/vigente (modo warn), se permite.`)
    return
  }
  if (decision === 'block') throw new IdentityNotApprovedError()
}