import { PedirFunnel } from '@/components/pedir/funnel'
import { BRAND } from '@/lib/brand'
import { db } from '@/lib/db'
import { bankAccount, kycVerification, profile } from '@/lib/db/schema'
import { getSession } from '@/lib/session'
import { and, desc, eq } from 'drizzle-orm'
import type { Metadata } from 'next'
import { Suspense } from 'react'

export const metadata: Metadata = {
  title: `Solicitud · ${BRAND.company}`,
  description: 'Completá tu solicitud de préstamo personal online.',
  alternates: { canonical: '/pedir/solicitud' },
}

export const dynamic = 'force-dynamic'

async function FunnelLoader() {
  const session = await getSession()
  const userId = session?.user?.id

  if (!userId) {
    return <PedirFunnel initialProfile={null} kycApproved={false} hasBank={false} loggedIn={false} />
  }

  const [prof] = await db.select().from(profile).where(eq(profile.userId, userId)).limit(1)
  const [kyc] = await db
    .select({ status: kycVerification.status, provider: kycVerification.provider })
    .from(kycVerification)
    .where(eq(kycVerification.userId, userId))
    .limit(1)
  const banks = await db
    .select({ id: bankAccount.id })
    .from(bankAccount)
    .where(and(eq(bankAccount.userId, userId), eq(bankAccount.isActive, true)))
    .orderBy(desc(bankAccount.isPrimary))
    .limit(1)

  const kycApproved =
    (kyc?.provider === 'didit' && kyc.status === 'approved') || prof?.kycStatus === 'approved'

  return (
    <PedirFunnel
      loggedIn
      kycApproved={Boolean(kycApproved)}
      hasBank={banks.length > 0}
      initialProfile={
        prof
          ? {
              cuil: prof.cuil,
              dni: prof.dni,
              phone: prof.phone,
              birthDate: prof.birthDate,
              province: prof.province,
              department: prof.department,
              city: prof.city,
              postalCode: prof.postalCode,
              address: prof.address,
              monthlyIncome: prof.monthlyIncome,
              employmentStatus: prof.employmentStatus,
              kycStatus: prof.kycStatus,
            }
          : null
      }
    />
  )
}

export default function PedirSolicitudPage() {
  return (
    <Suspense
      fallback={
        <div className="lp-container py-32 text-center text-sm text-[var(--lp-muted)]">Cargando solicitud…</div>
      }
    >
      <FunnelLoader />
    </Suspense>
  )
}
