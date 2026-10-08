import { KYCBiometricPanel } from '@/components/dashboard/kyc-biometric-panel'
import { Badge, CardHead, Kv, Pad, PageHead } from '@/components/uc/blocks'
import { loadCustomerKyc, loadCustomerShell } from '@/lib/customer/load'
import { getOrCreateProfile } from '@/lib/session'
import { fdate } from '@/lib/uc/format'

export const metadata = { title: 'Identidad' }

const STATE: Record<string, { label: string; tone: 'success' | 'danger' | 'warning' | 'neutral' }> = {
  approved: { label: 'Verificada', tone: 'success' },
  verified: { label: 'Verificada', tone: 'success' },
  rejected: { label: 'Rechazada', tone: 'danger' },
  reviewing: { label: 'En revisión', tone: 'warning' },
  submitted: { label: 'En revisión', tone: 'warning' },
  pending: { label: 'Pendiente', tone: 'warning' },
}

export default async function IdentidadPage() {
  const { userId } = await loadCustomerShell()
  const [profile, kyc] = await Promise.all([getOrCreateProfile(), loadCustomerKyc(userId)])
  const identityVerified = kyc?.provider === 'didit' && kyc.status === 'approved'
  const st = identityVerified ? STATE.approved : (STATE[kyc?.status ?? ''] ?? { label: 'Sin verificar', tone: 'neutral' as const })

  return (
    <>
      <PageHead title="Identidad" description="Validación biométrica con Didit: documento, prueba de vida y coincidencia facial. Se hace una sola vez." />
      <Pad style={{ marginBottom: 20 }}>
        <CardHead title="Estado de tu validación" aside={<Badge tone={st.tone}>{st.label}</Badge>} />
        <Kv
          rows={[
            ['Estado', st.label],
            ['Fecha', <span key="f" className="uc-num">{kyc?.reviewedAt ? fdate(kyc.reviewedAt as Date) : kyc?.updatedAt ? fdate(kyc.updatedAt as Date) : '—'}</span>],
            ['Método', identityVerified ? 'Selfie + DNI + prueba de vida' : 'Didit (en esta misma pantalla)'],
          ]}
        />
        <p className="uc-note" style={{ marginTop: 14 }}>
          Si cambiás tu DNI, te pediremos validar tu identidad de nuevo.
        </p>
      </Pad>
      <KYCBiometricPanel kyc={kyc} profile={profile} />
    </>
  )
}
