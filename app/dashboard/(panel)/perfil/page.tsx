import { KYCProfileForm } from '@/components/dashboard/kyc-profile-form'
import { CardHead, Grid, Kv, Pad, PageHead, ProgressBar, SectionTitle } from '@/components/uc/blocks'
import { fmtDni } from '@/lib/uc/admin'
import { loadCustomer, oneLineAddress, profileProgress } from '@/lib/customer/load'
import { fdate } from '@/lib/uc/format'

export const metadata = { title: 'Datos personales' }

export default async function PerfilPage() {
  const { user, profile, identityVerified } = await loadCustomer()
  const progress = profileProgress(profile)

  return (
    <>
      <PageHead title="Datos personales" description="Tu información de contacto, domicilio e ingresos. Se usa para evaluar tu crédito." />
      <Grid cols="21">
        <Pad>
          <CardHead title="Tus datos" aside={<span>{progress.done} de {progress.total} completos</span>} />
          <Kv
            rows={[
              ['Nombre', user.name],
              ['DNI', <span key="d" className="uc-num">{fmtDni(profile?.dni) || '—'}</span>],
              ['CUIL', <span key="c" className="uc-num">{profile?.cuil || '—'}</span>],
              ['Nacimiento', <span key="n" className="uc-num">{profile?.birthDate ? fdate(`${profile.birthDate}T12:00:00-03:00`) : '—'}</span>],
              ['Email', user.email],
              ['Celular', <span key="t" className="uc-num">{profile?.phone || '—'}</span>],
              ['Domicilio', oneLineAddress(profile) || '—'],
            ]}
          />
        </Pad>
        <Pad>
          <CardHead title="Perfil completo" />
          <div className="uc-big uc-num">{progress.pct}%</div>
          <div style={{ margin: '12px 0' }}>
            <ProgressBar value={progress.pct} label="Perfil completo" />
          </div>
          <p className="uc-note">
            {progress.pct === 100
              ? identityVerified
                ? 'Todo listo para pedir tu crédito.'
                : 'Falta validar tu identidad para poder pedir un crédito.'
              : `Falta: ${progress.steps.filter((s) => !s.done).map((s) => s.label.toLowerCase()).join(', ')}.`}
          </p>
        </Pad>
      </Grid>
      <SectionTitle title="Editar mis datos" aside="Completá o corregí tu información" />
      <KYCProfileForm
        key={profile?.updatedAt ? String(profile.updatedAt) : 'profile'}
        initialProfile={profile}
        user={{ name: user.name, email: user.email }}
        diditApproved={identityVerified}
      />
    </>
  )
}
