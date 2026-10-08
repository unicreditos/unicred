import Link from 'next/link'
import { desc, eq } from 'drizzle-orm'
import { getLoanProducts } from '@/app/actions/loans'
import { getMyBankAccounts } from '@/app/actions/banking'
import { BCRAScore } from '@/components/dashboard/bcra-score'
import { LoanRequestSimulator } from '@/components/dashboard/loan-request'
import { ButtonLink, Callout, Pad, PageHead, SectionTitle } from '@/components/uc/blocks'
import { Icon } from '@/components/uc/icons'
import { db } from '@/lib/db'
import { bcraCheck } from '@/lib/db/schema'
import { loadCustomer, profileProgress } from '@/lib/customer/load'
import { parseLoanIntent } from '@/lib/loan-intent'

export const metadata = { title: 'Solicitar crédito' }

export default async function SolicitarPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = await searchParams
  const { userId, profile, loans, identityVerified } = await loadCustomer()

  const [products, lastCheck, accounts] = await Promise.all([
    getLoanProducts().catch(() => []),
    db
      .select()
      .from(bcraCheck)
      .where(eq(bcraCheck.userId, userId))
      .orderBy(desc(bcraCheck.createdAt))
      .limit(1)
      .then((r) => r[0] ?? null)
      .catch(() => null),
    getMyBankAccounts().catch(() => []),
  ])

  const intent = parseLoanIntent(sp)
  const active = loans.filter((l) => l.status === 'active')
  const inFlight = loans.filter((l) => l.status === 'pending' || l.status === 'approved')
  const progress = profileProgress(profile)
  const ready = identityVerified && progress.pct === 100

  return (
    <>
      <PageHead
        title="Solicitar crédito"
        description="Simulá el monto y las cuotas. Evaluamos tu pedido con tu perfil, tu situación en el BCRA y tu capacidad de pago."
      />

      {active.length > 0 || inFlight.length > 0 ? (
        <Callout icon="credit" title={active.length ? `Tenés ${active.length} crédito${active.length === 1 ? '' : 's'} vigente${active.length === 1 ? '' : 's'}` : 'Ya tenés un pedido en curso'}>
          No se puede pedir otro hasta cancelar o terminar el actual. Seguilo desde <Link href="/dashboard/creditos">Mis créditos</Link>.
        </Callout>
      ) : (
        <div style={{ display: 'grid', gap: 20 }}>
          {!ready ? (
            <Callout icon="alert" title="Antes de pedir tu crédito" tone="warning">
              Perfil {progress.pct}% completo · identidad {identityVerified ? 'verificada' : 'sin verificar'}.{' '}
              <Link href="/dashboard/perfil">Completar ahora</Link>
            </Callout>
          ) : null}
          <BCRAScore profile={profile} lastBcraCheck={lastCheck} />
          <LoanRequestSimulator
            products={products}
            identityReady={identityVerified}
            initialAmount={intent.amount}
            initialTerm={intent.term}
          />
        </div>
      )}

      <SectionTitle title="Cómo sigue tu solicitud" aside="5 pasos" />
      <Pad>
        <ol className="uc-vflow">
          <li>
            <span className="uc-step-n">1</span>
            <div><b>Simulá y elegí tu plan</b><small>Monto y cantidad de cuotas, con el costo financiero total a la vista.</small></div>
          </li>
          <li>
            <span className="uc-step-n" style={identityVerified ? { borderColor: 'var(--uc-success)', color: 'var(--uc-success)' } : undefined}>
              {identityVerified ? <Icon name="check" size="xs" /> : 2}
            </span>
            <div>
              <b>Validá tu identidad</b>
              <small>{identityVerified ? 'Ya la validaste. No tenés que repetirla.' : 'Selfie, DNI y prueba de vida desde Perfil.'}</small>
            </div>
          </li>
          <li>
            <span className="uc-step-n">3</span>
            <div><b>Confirmá la cuenta donde recibís el dinero</b><small>{accounts.length ? 'Ya cargaste una cuenta.' : 'Cargá un CBU, CVU o alias a tu nombre en Perfil.'}</small></div>
          </li>
          <li className="uc-manual">
            <span className="uc-step-n">4</span>
            <div><b>Evaluación</b><small>Los casos claros se resuelven al instante. Si el tuyo necesita una revisión manual, una persona de Finanzas lo analiza y te avisamos por email.</small></div>
          </li>
          <li className="uc-money">
            <span className="uc-step-n">5</span>
            <div><b>Firmá el contrato y recibí el dinero</b><small>Lo transferimos a tu cuenta apenas firmes.</small></div>
          </li>
        </ol>
      </Pad>
      <div className="uc-section-gap" />
      <ButtonLink href="/dashboard/creditos">Ver mis créditos</ButtonLink>
    </>
  )
}
