import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { kycVerification, profile } from '@/lib/db/schema'
import { WalletError } from '@/lib/wallet/ledger'

/**
 * Para MANDAR dinero (transferir, pagar un QR, retirar) o para COBRAR con QR de Mercado Pago (se abre una caja a su nombre)
 * la identidad tiene que estar verificada: es el control que
 * evita usar la billetera con una identidad no comprobada. Recibir una transferencia interna no lo exige.
 */
export async function assertIdentityVerified(userId: string, purpose: 'enviar dinero' | 'cobrar con QR' = 'enviar dinero'): Promise<{ cuil: string; dni: string | null }> {
  const [[prof], [kyc]] = await Promise.all([
    db.select({ kycStatus: profile.kycStatus, cuil: profile.cuil, dni: profile.dni }).from(profile).where(eq(profile.userId, userId)).limit(1),
    db.select({ status: kycVerification.status }).from(kycVerification).where(eq(kycVerification.userId, userId)).limit(1),
  ])
  if (prof?.kycStatus !== 'approved' || kyc?.status !== 'approved') {
    throw new WalletError(`Para ${purpose} primero tenés que verificar tu identidad.`)
  }
  const cuil = String(prof.cuil ?? '').replace(/\D/g, '')
  if (cuil.length !== 11) throw new WalletError('Completá tu CUIL en tus datos personales.')
  return { cuil, dni: prof.dni }
}
