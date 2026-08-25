import { PedirAccountClient } from '@/components/pedir/account'
import { PedirAppFrame } from '@/components/pedir/app-shell'
import { getMyInstallments, getMyLoans } from '@/app/actions/loans'
import { BRAND } from '@/lib/brand'
import { db } from '@/lib/db'
import { loanContract } from '@/lib/db/schema'
import { getRoleForUser, getSession } from '@/lib/session'
import { inArray } from 'drizzle-orm'
import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'

export const metadata: Metadata = {
  title: `Mi cuenta · ${BRAND.company}`,
  description: 'Estado de tus préstamos, cuotas y contratos.',
  alternates: { canonical: '/pedir/cuenta' },
}

export const dynamic = 'force-dynamic'

export default async function PedirCuentaPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; mp_status?: string }>
}) {
  const session = await getSession()
  if (!session?.user?.id) {
    redirect('/pedir/ingresar?callbackUrl=/pedir/cuenta')
  }

  const { ok, mp_status } = await searchParams
  const role = await getRoleForUser(session.user.id)

  if (role === 'admin' || role === 'merchant') {
    return (
      <PedirAppFrame backHref="/pedir">
        <div className="mx-auto max-w-lg px-4 py-12">
          <h1 className="lp-display text-3xl text-[var(--lp-ink)]">Cuenta no disponible</h1>
          <p className="mt-3 text-sm leading-relaxed text-[var(--lp-muted)]">
            Esta app es solo para personas que solicitan un préstamo personal. La sesión actual no corresponde a un
            cliente de este producto.
          </p>
          <Link href="/pedir" className="lp-btn lp-btn-primary mt-8">
            Ir al sitio público
          </Link>
        </div>
      </PedirAppFrame>
    )
  }

  const [loans, installments] = await Promise.all([
    getMyLoans().catch(() => [] as Awaited<ReturnType<typeof getMyLoans>>),
    getMyInstallments().catch(() => [] as Awaited<ReturnType<typeof getMyInstallments>>),
  ])

  const loanIds = loans.map((l) => l.id)
  const contracts = loanIds.length
    ? await db
        .select({
          id: loanContract.id,
          loanId: loanContract.loanId,
          status: loanContract.status,
        })
        .from(loanContract)
        .where(inArray(loanContract.loanId, loanIds))
    : []
  const contractByLoan = new Map(contracts.map((c) => [c.loanId, c]))

  return (
    <PedirAccountClient
      name={session.user.name ?? null}
      email={session.user.email ?? null}
      justSubmitted={ok === '1'}
      mpStatus={mp_status ?? null}
      loans={loans.map((l) => {
        const c = contractByLoan.get(l.id)
        return {
          id: l.id,
          principal: l.principal,
          term: l.term,
          installmentAmount: l.installmentAmount,
          status: l.status,
          createdAt: l.createdAt,
          scoreAtApproval: l.scoreAtApproval ?? null,
          contractId: c?.id ?? null,
          contractStatus: c?.status ?? null,
        }
      })}
      installments={installments.map((i) => ({
        id: i.id,
        loanId: i.loanId,
        number: i.number,
        amount: i.amount,
        dueDate: i.dueDate,
        status: i.status,
      }))}
    />
  )
}
