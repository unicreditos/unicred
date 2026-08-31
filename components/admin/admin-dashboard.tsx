'use client'

import {
  AdminAppShell,
  type AdminTabId,
} from '@/components/admin/admin-app-shell'
import { AdminCommandPalette } from '@/components/admin/admin-command-palette'
import { AdminContent } from '@/components/admin/admin-content'
import type { ClientFicha } from '@/app/actions/admin-ficha'
import type { AdminOpsDesk } from '@/app/actions/admin-ops'
import type { AdminOpsConfig } from '@/app/actions/admin-config'
import type { AdminPaymentsDesk } from '@/app/actions/admin-cases'
import { adminUrl } from '@/lib/admin-nav'
import type { VariableBCRA } from '@/lib/bcra'
import type { StatsData } from '@/components/admin/summary-cards'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'

type LoanData = Array<{
  id: string
  userId: string
  merchantId?: string | null
  productId?: string | null
  principal: string | number
  term: number
  status: string
  scoreAtApproval: number | null
  createdAt: Date | string
  contractId?: string | null
  contractStatus?: string | null
}>

type MerchantData = Array<{
  id: string
  businessName: string
  cuit: string
  category: string | null
  status: string
}>

type KYCItem = any
type DisbursementItem = any
type BankAccountItem = any

export function AdminDashboard({
  user,
  stats,
  loans,
  merchants,
  bcra,
  kycList = [],
  disbursementList = [],
  bankAccounts = [],
  users = [],
  products = [],
  auditLog = [],
  activeTab = 'overview',
  personaId = null,
  ficha = null,
  fichaError = null,
  opsDesk,
  payments,
  opsConfig = null,
}: {
  user: {
    id: string
    name: string | null | undefined
    email: string | null | undefined
    image: string | null | undefined
  } | null
  stats: StatsData
  loans: LoanData
  merchants: MerchantData
  bcra: VariableBCRA[]
  kycList?: KYCItem[]
  disbursementList?: DisbursementItem[]
  bankAccounts?: BankAccountItem[]
  users?: any[]
  products?: any[]
  auditLog?: any[]
  activeTab?: AdminTabId
  personaId?: string | null
  ficha?: ClientFicha | null
  fichaError?: string | null
  opsDesk: AdminOpsDesk
  payments?: AdminPaymentsDesk
  opsConfig?: AdminOpsConfig | null
}) {
  const router = useRouter()
  const [searchOpen, setSearchOpen] = useState(false)
  const tab = personaId ? 'usuarios' : activeTab
  const personaName = ficha?.user.name ?? users.find((u) => u.id === personaId)?.name

  function go(next: AdminTabId) {
    router.push(adminUrl(next))
  }

  const counts = useMemo(
    () => ({
      pendingLoans: loans.filter((l) => l.status === 'pending').length,
      pendingKyc: kycList.filter((k: { status: string }) =>
        ['pending_review', 'pending', 'reviewing', 'submitted', 'in_review'].includes(k.status),
      ).length,
      overdue: opsDesk.kpis.overdueCount,
      pendingDisb: disbursementList.filter((d: { status: string }) => d.status === 'pending' || d.status === 'processing')
        .length,
      pendingMerchants: merchants.filter((m) => m.status === 'pending').length,
    }),
    [loans, kycList, opsDesk.kpis.overdueCount, disbursementList, merchants],
  )

  return (
    <AdminAppShell
      user={{
        id: user?.id ?? '',
        name: user?.name ?? null,
        email: user?.email ?? null,
        image: user?.image ?? null,
      }}
      activeTab={tab}
      onTabChange={go}
      title={personaId ? (personaName || 'Ficha de cliente') : undefined}
      subtitle={personaId ? 'Cuenta, cobranzas, recibos y expediente' : undefined}
      counts={counts}
      onSearchRequest={() => setSearchOpen(true)}
    >
      <AdminCommandPalette
        open={searchOpen}
        onOpenChange={setSearchOpen}
        users={users}
        loans={loans}
        merchants={merchants}
        onNavigate={go}
      />
      <AdminContent
        activeTab={tab}
        personaId={personaId}
        ficha={ficha}
        fichaError={fichaError}
        opsDesk={opsDesk}
        stats={stats}
        loans={loans}
        merchants={merchants}
        bcra={bcra}
        kycList={kycList}
        disbursementList={disbursementList}
        bankAccounts={bankAccounts}
        users={users}
        products={products}
        auditLog={auditLog}
        currentAdminId={user?.id ?? ''}
        onNavigate={go}
        payments={payments}
        opsConfig={opsConfig}
      />
    </AdminAppShell>
  )
}
