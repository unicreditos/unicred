'use server'

import { assertAdmin } from '@/lib/session'
import { checkEnv } from '@/lib/env'
import { TREASURY_ACCOUNT } from '@/lib/treasury'
import {
  FIRST_CREDIT_HARD_CAP,
  INCOME_DTI_RATIO,
  SCORE_AUTO_QUALIFY_AT,
  SCORE_REJECT_BELOW,
} from '@/lib/loan-underwriting'

function last4(value: string) {
  const digits = value.replace(/\D/g, '')
  return digits.length >= 4 ? digits.slice(-4) : '—'
}

export async function getAdminOpsConfig() {
  await assertAdmin()
  const env = checkEnv()
  const afipCuit = (process.env.AFIP_CUIT || '').replace(/\D/g, '')
  const mpToken = (process.env.MERCADO_PAGO_ACCESS_TOKEN || '').trim()
  return {
    envOk: env.ok,
    missingRequired: env.missingRequired.map((c) => ({ name: c.name, detail: c.detail })),
    missingOptional: env.missingOptional.map((c) => ({ name: c.name, detail: c.detail })),
    integrations: [
      {
        id: 'mp',
        label: 'Mercado Pago',
        ok: Boolean(mpToken),
        hint: !mpToken ? 'Sin access token: no hay links ni cupones de red' : mpToken.startsWith('TEST-') ? 'Token TEST' : 'Token live',
      },
      {
        id: 'mp-webhook',
        label: 'Webhook Mercado Pago',
        ok: Boolean(process.env.MERCADO_PAGO_WEBHOOK_SECRET),
        hint: 'Sin secreto el cobro no se acredita solo',
      },
      {
        id: 'didit',
        label: 'Didit (KYC)',
        ok: Boolean(process.env.DIDIT_API_KEY),
        hint: 'Identidad, prueba de vida y face match',
      },
      {
        id: 'afip',
        label: 'ARCA / AFIP',
        ok: Boolean(afipCuit && (process.env.AFIP_CERT || process.env.AFIP_KEY)),
        hint: afipCuit ? `CUIT ${afipCuit.slice(0, 2)}…${afipCuit.slice(-1)} · factura de intereses` : 'Sin certificado: FE queda en cola',
      },
      {
        id: 'treasury',
        label: 'Tesorería Brubank',
        ok: Boolean(TREASURY_ACCOUNT.cbu),
        hint: `${TREASURY_ACCOUNT.bank} · CBU …${last4(TREASURY_ACCOUNT.cbu)}`,
      },
      {
        id: 'resend',
        label: 'Correo (Resend)',
        ok: Boolean(process.env.RESEND_API_KEY?.startsWith('re_')),
        hint: 'Recuperación de clave y contacto',
      },
    ],
    motor: {
      rejectBelow: SCORE_REJECT_BELOW,
      autoQualify: SCORE_AUTO_QUALIFY_AT,
      dtiPct: Math.round(INCOME_DTI_RATIO * 100),
      firstCap: FIRST_CREDIT_HARD_CAP,
      punitorios: 0,
      cftNote: 'CFT de referencia = TEA × 1,21 (IVA 21% sobre intereses)',
    },
  }
}

export type AdminOpsConfig = Awaited<ReturnType<typeof getAdminOpsConfig>>
