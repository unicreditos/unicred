import {
  getAdminStats,
  getAllLoans,
  getBcraVariables,
  getPendingMerchants,
  getAllBankAccounts,
  getAllUsers,
  getAdminAuditLog,
} from '@/app/actions/admin'
import { getAllKYCReviews } from '@/app/actions/kyc'
import { getAllDisbursements } from '@/app/actions/banking'
import { getAdminClientFicha } from '@/app/actions/admin-ficha'
import { getAdminOpsDesk } from '@/app/actions/admin-ops'
import { getAdminOpsConfig } from '@/app/actions/admin-config'
import { listAdminPayments } from '@/app/actions/admin-cases'
import { AdminDashboard } from '@/components/admin/admin-dashboard'
import { parseAdminTab } from '@/lib/admin-nav'
import { db } from '@/lib/db'
import {
  profile,
  user as userTable,
  loan as loansTable,
  bankAccount,
  loanProduct,
  loanContract,
} from '@/lib/db/schema'
import { ensureOriginacionSchema } from '@/lib/db/ensure-originacion'
import { getSession, requireAdmin, getDashboardUrlByRole, getRoleForUser } from '@/lib/session'
import { getAdminPermissions, listAdminRoles } from '@/lib/rbac'
import { listRiskRuleVersions } from '@/lib/risk-rules'
import { eq, inArray } from 'drizzle-orm'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Backoffice',
  robots: { index: false, follow: false },
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; persona?: string }>
}) {
  const { tab: rawTab, persona: personaId } = await searchParams
  const activeTab = personaId ? 'usuarios' : parseAdminTab(rawTab)
  const userId = await requireAdmin()
  const session = await getSession()
  if (!session?.user) {
    redirect('/sign-in')
  }

  await ensureOriginacionSchema()
  const [p] = await db
    .select({ role: profile.role })
    .from(profile)
    .where(eq(profile.userId, userId))
    .limit(1)

  if (!p || p.role !== 'admin') {
    const role = await getRoleForUser(userId)
    redirect(getDashboardUrlByRole(role))
  }

  const myPermissions = Array.from(await getAdminPermissions(userId))

  const fichaPromise = personaId
    ? getAdminClientFicha(personaId)
        .then((ficha) => ({ ficha, error: null as string | null }))
        .catch((err: unknown) => ({
          ficha: null,
          error: err instanceof Error ? err.message : 'No se pudo abrir la ficha.',
        }))
    : Promise.resolve({ ficha: null, error: null as string | null })

  // stats/loans/merchants/kyc/disbursements(base)/users/opsDesk se usan en TODAS las
  // pestañas (contadores del sidebar, buscador Ctrl+K, Torre de control), así que se
  // piden siempre. El resto solo lo necesita una pestaña puntual: pedirlo siempre
  // hacía que cambiar de pestaña re-consultara las 24 secciones del panel en cada click.
  const needsBcra = activeTab === 'bcra'
  const needsBankAccounts = activeTab === 'cuentas-bancarias'
  const needsProducts = activeTab === 'analytics' || activeTab === 'tarifas'
  const needsAuditLog = activeTab === 'logs_auditoria'
  const needsPayments = activeTab === 'pagos'
  const needsOpsConfig = activeTab === 'parametros'
  const needsDisbEnrichment = activeTab === 'desembolsos' || activeTab === 'aprobaciones'
  const needsRoles = activeTab === 'staff'
  const needsRiskRules = activeTab === 'scoring'

  // Antes cada fetch fallido volvía silenciosamente a ceros: un admin podía
  // ver "0 solicitudes" y pensar que la cartera está vacía cuando en
  // realidad la consulta explotó. dataErrors junta qué falló para mostrarlo
  // arriba en vez de tragárselo.
  const dataErrors: string[] = []
  function track<T>(label: string, fallback: T) {
    return (e: Error) => {
      console.error(`[admin] ${label} failed:`, e.message)
      dataErrors.push(label)
      return fallback
    }
  }

  const [stats, loans, merchants, bcra, kycRaw, disbRaw, bankAccounts, users, products, auditLog, fichaResult, opsDesk, payments, opsConfig, adminRoles, riskRuleVersions] = await Promise.all([
    getAdminStats().catch(track('Estadísticas del dashboard', { totalCustomers: 0, totalLoans: 0, activeLoans: 0, totalDisbursed: '0', pendingKYCs: 0, pendingDisbursements: 0, rejectedLoans: 0, approvedLoans: 0, disbursedLoans: 0, totalMerchants: 0, pendingMerchants: 0 } as any)),
    getAllLoans().catch(track('Créditos', [] as any[])),
    getPendingMerchants().catch(track('Comercios', [] as any[])),
    needsBcra
      ? getBcraVariables().catch(track('Variables BCRA', [] as any[]))
      : Promise.resolve([] as any[]),
    getAllKYCReviews(500).catch(track('Revisiones KYC', [] as any[])),
    getAllDisbursements(100).catch(track('Desembolsos', [] as any[])),
    needsBankAccounts
      ? getAllBankAccounts().catch(track('Cuentas bancarias', [] as any[]))
      : Promise.resolve([] as any[]),
    getAllUsers().catch(track('Usuarios', [] as any[])),
    needsProducts
      ? db.select().from(loanProduct).orderBy(loanProduct.name).catch(track('Productos', [] as any[]))
      : Promise.resolve([] as any[]),
    needsAuditLog
      ? getAdminAuditLog(200).catch(track('Auditoría', [] as any[]))
      : Promise.resolve([] as any[]),
    fichaPromise,
    getAdminOpsDesk().catch(
      track('Mesa de operaciones (cobranzas/pagos)', {
        generatedAt: new Date().toISOString(),
        market: { country: 'Argentina', currency: 'ARS' },
        kpis: {
          overdueCount: 0,
          overdueAmount: 0,
          due7Count: 0,
          due7Amount: 0,
          collectedMonth: 0,
          receiptsMonth: 0,
          pendingReview: 0,
          openTickets: 0,
        },
        installments: [],
        receipts: [],
        movements: [],
        openTickets: [],
        contracts: [],
      }),
    ),
    needsPayments
      ? listAdminPayments(200).catch(track('Pagos', { kpis: { total: 0, volume: 0, pending: 0, failed: 0 }, rows: [] }))
      : Promise.resolve({ kpis: { total: 0, volume: 0, pending: 0, failed: 0 }, rows: [] }),
    needsOpsConfig
      ? getAdminOpsConfig().catch(track('Configuración', null))
      : Promise.resolve(null),
    needsRoles
      ? listAdminRoles().catch(track('Roles', [] as Awaited<ReturnType<typeof listAdminRoles>>))
      : Promise.resolve([] as Awaited<ReturnType<typeof listAdminRoles>>),
    needsRiskRules
      ? listRiskRuleVersions().catch(track('Reglas de riesgo', [] as Awaited<ReturnType<typeof listRiskRuleVersions>>))
      : Promise.resolve([] as Awaited<ReturnType<typeof listRiskRuleVersions>>),
  ])

  const userIdsForDisb = needsDisbEnrichment ? Array.from(new Set(disbRaw.map((d) => d.userId))) : []
  const loanIdsForDisb = needsDisbEnrichment ? Array.from(new Set(disbRaw.map((d) => d.loanId).filter(Boolean) as string[])) : []
  const bankIdsForDisb = needsDisbEnrichment ? Array.from(new Set(disbRaw.map((d) => d.bankAccountId).filter(Boolean) as string[])) : []

  const [custRows, loanRows, bankRows, contractRows] = needsDisbEnrichment
    ? await Promise.all([
        userIdsForDisb.length
          ? db
              .select({
                userId: profile.userId,
                fullName: userTable.name,
                cuil: profile.cuil,
                email: userTable.email,
              })
              .from(profile)
              .leftJoin(userTable, eq(profile.userId, userTable.id))
              .where(inArray(profile.userId, userIdsForDisb))
          : Promise.resolve([]),
        loanIdsForDisb.length
          ? db
              .select({
                id: loansTable.id,
                principal: loansTable.principal,
                term: loansTable.term,
                totalAmount: loansTable.totalAmount,
                status: loansTable.status,
              })
              .from(loansTable)
              .where(inArray(loansTable.id, loanIdsForDisb))
          : Promise.resolve([]),
        bankIdsForDisb.length
          ? db
              .select({
                id: bankAccount.id,
                bankName: bankAccount.bankName,
                accountType: bankAccount.accountType,
                cbu: bankAccount.cbu,
                cvu: bankAccount.cvu,
                alias: bankAccount.alias,
                holderName: bankAccount.holderName,
                holderCuil: bankAccount.holderCuil,
              })
              .from(bankAccount)
              .where(inArray(bankAccount.id, bankIdsForDisb))
          : Promise.resolve([]),
        loanIdsForDisb.length
          ? db
              .select({
                id: loanContract.id,
                loanId: loanContract.loanId,
                status: loanContract.status,
              })
              .from(loanContract)
              .where(inArray(loanContract.loanId, loanIdsForDisb))
          : Promise.resolve([]),
      ])
    : [[], [], [], []]

  const custMap = new Map(custRows.map((r: any) => [r.userId, r]))
  const loanMap = new Map(loanRows.map((r: any) => [r.id, r]))
  const bankMap = new Map(bankRows.map((r: any) => [r.id, r]))
  const contractMap = new Map(contractRows.map((r: any) => [r.loanId, r]))

  const disbursementList = disbRaw.map((d) => ({
    ...d,
    customer: custMap.get(d.userId) ?? null,
    loan: d.loanId ? loanMap.get(d.loanId) ?? null : null,
    bankAccount: d.bankAccountId ? bankMap.get(d.bankAccountId) ?? null : null,
    contract: d.loanId ? contractMap.get(d.loanId) ?? null : null,
  }))

  return (
    <AdminDashboard
      user={{
        id: session.user.id,
        name: session.user.name ?? null,
        email: session.user.email ?? null,
        image: session.user.image ?? null,
      }}
      stats={stats as any}
      loans={loans as any}
      merchants={merchants as any}
      bcra={bcra as any}
      kycList={kycRaw as any}
      disbursementList={disbursementList as any}
      bankAccounts={bankAccounts as any}
      users={users as any}
      products={products as any}
      auditLog={auditLog as any}
      activeTab={activeTab}
      personaId={personaId ?? null}
      ficha={fichaResult.ficha}
      fichaError={fichaResult.error}
      opsDesk={opsDesk}
      payments={payments}
      opsConfig={opsConfig}
      myPermissions={myPermissions}
      adminRoles={adminRoles}
      riskRuleVersions={riskRuleVersions}
      dataErrors={dataErrors}
    />
  )
}
