import { BRAND } from '@/lib/brand'

function readEnv(...names: string[]) {
  for (const name of names) {
    const value = process.env[name]?.trim()
    if (value) return value
  }
  return ''
}

/**
 * Cuenta corriente ARS de RM International Group en Brubank.
 * Datos del estado de cuenta oficial (CBU / n° de cuenta / CUIT).
 * El alias es opcional: solo se muestra si está en el entorno.
 */
export const TREASURY_ACCOUNT = {
  bank: 'Brubank S.A.U.',
  bankCuit: '30-71589971-6',
  accountType: 'Cuenta corriente',
  currency: 'ARS',
  holder: BRAND.legalName,
  cuit: BRAND.cuit,
  accountNumber: readEnv('TREASURY_ACCOUNT_NUMBER') || '2503981510001',
  cbu: readEnv('TREASURY_CBU') || '1430001725039815100019',
  alias: readEnv('TREASURY_ALIAS', 'NEXT_PUBLIC_TREASURY_ALIAS') || null,
  address: BRAND.address,
} as const

export function treasuryForClient() {
  return {
    bank: TREASURY_ACCOUNT.bank,
    accountType: TREASURY_ACCOUNT.accountType,
    currency: TREASURY_ACCOUNT.currency,
    holder: TREASURY_ACCOUNT.holder,
    cuit: TREASURY_ACCOUNT.cuit,
    accountNumber: TREASURY_ACCOUNT.accountNumber,
    cbu: TREASURY_ACCOUNT.cbu,
    alias: TREASURY_ACCOUNT.alias,
    conceptHint: 'En el concepto / referencia poné el código de cupón de la cuota.',
  }
}

export type TreasuryClientView = ReturnType<typeof treasuryForClient>
