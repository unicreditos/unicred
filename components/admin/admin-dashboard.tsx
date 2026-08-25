'use client'

import {
  AdminAppShell,
  type AdminTabId,
} from '@/components/admin/admin-app-shell'
import { AdminContent } from '@/components/admin/admin-content'
import type { ClientFicha } from '@/app/actions/admin-ficha'
import type { AdminOpsDesk } from '@/app/actions/admin-ops'
import { adminUrl } from '@/lib/admin-nav'
import type { VariableBCRA } from '@/lib/bcra'
import type { StatsData } from '@/components/admin/summary-cards'
import { useRouter } from 'next/navigation'

type LoanData = Array<{
  id: string
  userId: string
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
}) {
  const router = useRouter()
  const tab = personaId ? 'usuarios' : activeTab
  const personaName = ficha?.user.name ?? users.find((u) => u.id === personaId)?.name

  function go(next: AdminTabId) {
    router.push(adminUrl(next))
  }

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
    >
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
      />
    </AdminAppShell>
  )
}
