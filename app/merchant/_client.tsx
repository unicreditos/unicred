"use client"

import { useState, useMemo, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "@/lib/auth-client"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import {
  Tabs,
  TabsContent,
} from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import {
  formatARS,
  formatPercent,
  computeFrenchAmortization,
} from "@/lib/finance"
import { catalogByType } from "@/lib/loan-catalog"
import { BRAND } from "@/lib/brand"
import {
  MERCHANT_DOC_LABELS,
  type MerchantDocType,
  type RepresentativeRole,
} from "@/lib/merchant-kyb"
import { TAX_CONDITION_LABELS } from "@/lib/arca/tax-condition"
import { getDiditPublicConfig } from "@/app/actions/didit"
import { registerMerchant, lookupMerchantAfip, createMerchantSale } from "@/app/actions/merchant"
import { DiditVerifyButton } from "@/components/didit-verify-button"
import { cn } from "@/lib/utils"
import {
  KpiCard,
  SectionCard,
  LineChart,
  DonutChart,
  ProgressBar,
  StatusChip,
} from "@/components/unicred/dashboard-kit"
import { DecisionBanner, MetricTile, WorkspaceShell, type WorkspaceNavItem } from "@/components/unicred/workspace-shell"
import {
  BadgeCheck,
  Banknote,
  BarChart3,
  Calculator,
  ChartNoAxesCombined,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleDot,
  Clock3,
  CreditCard,
  Download,
  FileBarChart,
  FileSpreadsheet,
  FileText,
  Handshake,
  Headphones,
  HelpCircle,
  Inbox,
  LayoutDashboard,
  Mail,
  MessageCircle,
  Phone,
  Receipt,
  Scale,
  Sparkles,
  Store,
  Ticket,
  TrendingUp,
  Users,
  Wallet,
  XCircle,
  Zap,
  AlertCircle,
  FileJson,
} from "lucide-react"

type MerchantType = {
  id: string
  userId: string
  businessName: string
  cuit: string
  category: string | null
  province: string | null
  city: string | null
  address: string | null
  phone: string | null
  status: string
  personType?: string | null
  taxCondition?: string | null
  taxStatus?: string | null
  legalName?: string | null
  monotributoCategory?: string | null
  titularMatch?: string | null
  representativeRole?: string | null
  kybStatus?: string | null
  kybBlockers?: string[] | null
  commissionRate: string | number
  createdAt: Date
  updatedAt: Date
}

type MerchantDocRow = {
  id: string
  type: string
  fileName: string
  mime: string
  size: number
  status: string
  createdAt: Date
}

type SaleType = {
  id: string
  userId: string
  merchantId: string | null
  type: string
  principal: string | number
  term: number
  monthlyRate: string | number
  tna: string | number
  installmentAmount: string | number
  totalAmount: string | number
  cft: string | number | null
  status: string
  purpose: string | null
  createdAt: Date
}

const PROVINCES = [
  "Buenos Aires", "CABA", "Catamarca", "Chaco", "Chubut", "Córdoba",
  "Corrientes", "Entre Ríos", "Formosa", "Jujuy", "La Pampa", "La Rioja",
  "Mendoza", "Misiones", "Neuquén", "Río Negro", "Salta", "San Juan",
  "San Luis", "Santa Cruz", "Santa Fe", "Santiago del Estero", "Tierra del Fuego", "Tucumán",
]

const CATEGORIES = [
  "Alimentos y bebidas", "Indumentaria y calzado", "Electrónica y electrodomésticos",
  "Muebles y hogar", "Salud y belleza", "Educación",
  "Automotriz", "Construcción", "Turismo y hotelería",
  "Servicios profesionales", "Otros",
]

type TabValue =
  | "overview"
  | "venta_rapida"
  | "profile"
  | "sales"
  | "solicitudes_recibidas"
  | "customers"
  | "liquidations"
  | "conciliacion"
  | "reportes"
  | "ayuda"

const MERCHANT_NAV: WorkspaceNavItem[] = [
  { id: "overview", label: "Inicio", icon: LayoutDashboard, group: "Comercio" },
  { id: "venta_rapida", label: "Nueva venta", icon: Sparkles, group: "Comercio" },
  { id: "sales", label: "Ventas", icon: CreditCard, group: "Operación" },
  { id: "solicitudes_recibidas", label: "Solicitudes", icon: Inbox, group: "Operación" },
  { id: "customers", label: "Clientes", icon: Users, group: "Operación" },
  { id: "liquidations", label: "Liquidaciones", icon: Banknote, group: "Finanzas" },
  { id: "conciliacion", label: "Conciliación", icon: Scale, group: "Finanzas" },
  { id: "reportes", label: "Reportes", icon: ChartNoAxesCombined, group: "Finanzas" },
  { id: "profile", label: "Datos", icon: Store, group: "Cuenta" },
  { id: "ayuda", label: "Ayuda", icon: Handshake, group: "Cuenta" },
]

const MERCHANT_TITLES: Record<TabValue, { title: string; subtitle: string }> = {
  overview: { title: "Mesa del comercio", subtitle: "Adhesión, ventas financiadas y neto a liquidar" },
  venta_rapida: { title: "Nueva venta", subtitle: "Originá una operación en el local" },
  profile: { title: "Datos del comercio", subtitle: "CUIT, rubro y domicilio para la adhesión" },
  sales: { title: "Ventas en cuotas", subtitle: "Alta de operación financiada" },
  solicitudes_recibidas: { title: "Solicitudes", subtitle: "Estado de cada venta enviada a UNICRÉDITOS" },
  customers: { title: "Clientes", subtitle: "Tomadores asociados a tus ventas" },
  liquidations: { title: "Liquidaciones", subtitle: "Bruto, comisión y neto a favor" },
  conciliacion: { title: "Conciliación", subtitle: "Ventas versus lo esperado a cobrar" },
  reportes: { title: "Reportes", subtitle: "Volumen originado por período" },
  ayuda: { title: "Ayuda", subtitle: "Operación del panel y contacto" },
}

const MERCHANT_TAB_IDS = Object.keys(MERCHANT_TITLES) as TabValue[]

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string; icon: any }> = {
    pending: { variant: "secondary", label: "Pendiente", icon: AlertCircle },
    approved: { variant: "outline", label: "Aprobado", icon: CheckCircle2 },
    disbursed: { variant: "outline", label: "Desembolsado", icon: Banknote },
    active: { variant: "default", label: "Activo", icon: CheckCircle2 },
    paid: { variant: "outline", label: "Cancelado", icon: CheckCircle2 },
    rejected: { variant: "destructive", label: "Rechazado", icon: XCircle },
  }
  const v = variants[status] ?? variants.pending
  const Icon = v.icon
  return (
    <Badge variant={v.variant as any} className="gap-1">
      <Icon className="h-3 w-3" /> {v.label}
    </Badge>
  )
}

export function MerchantTabsClient({
  user,
  merchant,
  sales,
  defaultTab,
  titularDiditApproved = false,
  documents = [],
}: {
  user: { name: string; email: string }
  merchant: MerchantType | null
  sales: SaleType[]
  defaultTab?: string
  titularDiditApproved?: boolean
  documents?: MerchantDocRow[]
}) {
  const { data: session } = useSession()

  const initTab: TabValue = (() => {
    const requested =
      defaultTab && MERCHANT_TAB_IDS.includes(defaultTab as TabValue)
        ? (defaultTab as TabValue)
        : merchant
          ? "overview"
          : "profile"
    if (merchant?.status === "active") return requested
    if (requested === "ayuda") return "ayuda"
    return "profile"
  })()

  const [activeTab, setActiveTab] = useState<TabValue>(initTab)

  function goNav(id: string) {
    if (merchant?.status !== "active" && id !== "profile" && id !== "ayuda") {
      setActiveTab("profile")
      return
    }
    setActiveTab(id as TabValue)
  }

  const commissionRate = merchant ? Number(merchant.commissionRate) : 8
  const totals = useMemo(() => {
    let totalPrincipal = 0
    let totalGross = 0
    let receivedCount = 0
    let activeCount = 0
    let rejectedCount = 0
    const customers = new Set<string>()
    for (const s of sales) {
      const p = Number(s.principal) || 0
      const t = Number(s.totalAmount) || 0
      totalPrincipal += p
      totalGross += t
      if (s.status === "active" || s.status === "approved") activeCount++
      if (s.status === "paid") receivedCount++
      if (s.status === "rejected") rejectedCount++
      const cname = extractCustomerName(s.purpose)
      if (cname && cname !== "—") customers.add(cname)
    }
    const commission = (totalGross * commissionRate) / 100
    return {
      totalPrincipal,
      totalGross,
      totalCommission: commission,
      totalNet: totalGross - commission,
      receivedCount,
      activeCount,
      rejectedCount,
      totalOps: sales.length,
      totalCustomers: customers.size,
      avgTicket: sales.length ? totalPrincipal / sales.length : 0,
    }
  }, [sales, commissionRate])

  const copy = MERCHANT_TITLES[activeTab]
  const merchantReady = merchant?.status === 'active'
  const nav = merchantReady
    ? MERCHANT_NAV
    : MERCHANT_NAV.filter((item) => item.id === 'profile' || item.id === 'ayuda')
  const mobileNav = merchantReady
    ? [
        { id: 'overview', label: 'Inicio', icon: LayoutDashboard },
        { id: 'venta_rapida', label: 'Vender', icon: Sparkles },
        { id: 'sales', label: 'Ventas', icon: CreditCard },
        { id: 'liquidations', label: 'Cobros', icon: Banknote },
      ]
    : [
        { id: 'profile', label: 'Datos', icon: Store },
        { id: 'ayuda', label: 'Ayuda', icon: Handshake },
      ]

  return (
    <WorkspaceShell
      role="merchant"
      nav={nav}
      activeId={activeTab}
      onNavigate={goNav}
      title={copy?.title ?? "Comercio"}
      subtitle={copy?.subtitle}
      user={{
        name: session?.user?.name ?? user.name,
        email: session?.user?.email ?? user.email,
        image: session?.user?.image,
      }}
      onProfile={() => setActiveTab("profile")}
      mobileTabs={mobileNav}
    >
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
            <Tabs value={activeTab} className="w-full">
              <TabsContent value="overview">
                <MerchantOverview
                  merchant={merchant}
                  sales={sales}
                  totals={totals}
                  onTab={goNav}
                />
              </TabsContent>
              <TabsContent value="profile">
                <Card>
                  <CardHeader>
                    <CardTitle>Registro / Perfil de Comercio</CardTitle>
                    <CardDescription>
                      El CUIT se valida en el padrón ARCA (monotributo, RI o exento). Didit verifica a la persona titular o representante. La constancia no se sube a mano.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <MerchantProfileForm
                      existing={merchant}
                      titularDiditApproved={titularDiditApproved}
                      documents={documents}
                    />
                  </CardContent>
                </Card>
              </TabsContent>
              <TabsContent value="venta_rapida">
                <div className="animate-in fade-in slide-in-from-bottom-2 duration-200">
                  <VentaRapidaTab merchant={merchant} titularDiditApproved={titularDiditApproved} onCreated={() => { /* refresh handled by router.refresh in parent init, fallback noop */ }} />
                </div>
              </TabsContent>
              <TabsContent value="sales">
                <Card>
                  <CardHeader>
                    <CardTitle>Ventas en Cuotas</CardTitle>
                    <CardDescription>
                      Registrá una venta financiada. Se genera el plan de cuotas para el cliente.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <SaleForm merchant={merchant} titularDiditApproved={titularDiditApproved} />
                  </CardContent>
                </Card>
              </TabsContent>
              <TabsContent value="solicitudes_recibidas">
                <div className="animate-in fade-in slide-in-from-bottom-2 duration-200">
                  <SolicitudesRecibidasTab sales={sales} />
                </div>
              </TabsContent>
              <TabsContent value="customers">
                <CustomersTab sales={sales} />
              </TabsContent>
              <TabsContent value="liquidations">
                <LiquidationsTab merchant={merchant} sales={sales} totals={totals} />
              </TabsContent>
              <TabsContent value="conciliacion">
                <div className="animate-in fade-in slide-in-from-bottom-2 duration-200">
                  <ConciliacionTab merchant={merchant} sales={sales} totals={totals} />
                </div>
              </TabsContent>
              <TabsContent value="reportes">
                <div className="animate-in fade-in slide-in-from-bottom-2 duration-200">
                  <ReportesTab sales={sales} totals={totals} />
                </div>
              </TabsContent>
              <TabsContent value="ayuda">
                <div className="animate-in fade-in slide-in-from-bottom-2 duration-200">
                  <AyudaTab />
                </div>
              </TabsContent>
            </Tabs>
      </div>
    </WorkspaceShell>
  )
}

function MerchantOverview({
  merchant,
  sales,
  totals,
  onTab,
}: {
  merchant: MerchantType | null
  sales: SaleType[]
  totals: MerchantTotals
  onTab: (t: TabValue) => void
}) {
  const lastSales = [...sales].slice(0, 8)
  const pendingSales = sales.filter((s) => s.status === 'pending')
  const months: { label: string; value: number }[] = []
  const now = new Date()
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const label = d.toLocaleDateString('es-AR', { month: 'short' }).replace('.', '')
    const value = sales
      .filter((row) => {
        const c = new Date(row.createdAt)
        return c.getFullYear() === d.getFullYear() && c.getMonth() === d.getMonth()
      })
      .reduce((acc, row) => acc + (Number(row.principal) || 0), 0)
    months.push({ label, value })
  }
  const hasVolume = months.some((m) => m.value > 0)

  const banner = !merchant
    ? {
        tone: 'info' as const,
        title: 'Registrá el comercio para operar',
        detail: 'Sin adhesión no se originan ventas en cuotas.',
        tab: 'profile' as TabValue,
        cta: 'Completar datos',
      }
    : merchant.status === 'pending'
      ? {
          tone: 'warn' as const,
          title: 'Adhesión en evaluación',
          detail: 'UNICRÉDITOS no habilita originación hasta validar CUIT y ficha.',
          tab: 'profile' as TabValue,
          cta: 'Ver ficha',
        }
      : merchant.status === 'rejected'
        ? {
            tone: 'critical' as const,
            title: 'Adhesión rechazada',
            detail: 'Revisá los datos del comercio o contactá a UNICRÉDITOS.',
            tab: 'profile' as TabValue,
            cta: 'Revisar datos',
          }
        : pendingSales.length
          ? {
              tone: 'warn' as const,
              title: `${pendingSales.length} venta${pendingSales.length === 1 ? '' : 's'} pendiente${pendingSales.length === 1 ? '' : 's'} de crédito`,
              detail: 'El cliente todavía no tiene el préstamo vigente.',
              tab: 'solicitudes_recibidas' as TabValue,
              cta: 'Ver solicitudes',
            }
          : {
              tone: 'ok' as const,
              title: 'Comercio habilitado',
              detail: 'Podés originar ventas. El neto se liquida descontando la comisión pactada.',
              tab: 'venta_rapida' as TabValue,
              cta: 'Nueva venta',
            }

  return (
    <div className="space-y-5">
      <DecisionBanner
        tone={banner.tone}
        title={banner.title}
        detail={banner.detail}
        action={
          <Button
            size="sm"
            variant={banner.tone === 'ok' ? 'default' : 'outline'}
            onClick={() => onTab(banner.tab)}
            disabled={banner.tab === 'venta_rapida' && merchant?.status !== 'active'}
          >
            {banner.cta}
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          title="Ventas del mes"
          value={formatARS(totals.totalPrincipal)}
          icon={<CreditCard className="h-5 w-5" />}
          footer={`${totals.totalOps} operaciones · ticket ${formatARS(totals.avgTicket)}`}
        />
        <KpiCard
          title="Créditos otorgados"
          value={String(totals.activeCount)}
          icon={<CheckCircle2 className="h-5 w-5" />}
          iconBg="bg-emerald-50 text-emerald-600"
          footer={`${totals.receivedCount} cobradas`}
          tone="up"
        />
        <KpiCard
          title="Clientes nuevos"
          value={String(totals.totalCustomers)}
          icon={<Users className="h-5 w-5" />}
          footer={merchant?.businessName ?? 'Sin adhesión'}
        />
        <KpiCard
          title="Neto a liquidar"
          value={formatARS(totals.totalNet)}
          icon={<Banknote className="h-5 w-5" />}
          footer={`Comisión ${formatPercent(merchant?.commissionRate ?? 8)}`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:col-span-3">
          <h2 className="text-sm font-semibold text-brand-navy-900">Ventas por mes</h2>
          <p className="mb-3 text-xs text-slate-500">Capital originado en los últimos 6 meses</p>
          {hasVolume ? (
            <LineChart
              points={months.map((m) => m.value)}
              labels={months.map((m) => m.label)}
              color="#00C853"
              height={220}
              yFormatter={(v) => formatARS(v)}
            />
          ) : (
            <p className="py-8 text-center text-sm text-slate-500">Todavía no hay ventas en el período.</p>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:col-span-2">
          <h2 className="text-sm font-semibold text-brand-navy-900">Estado de ventas</h2>
          <p className="mb-3 text-xs text-slate-500">Cartera de este comercio</p>
          <DonutChart
            centerTitle="Ops"
            centerValue={String(totals.totalOps)}
            segments={[
              { label: 'Vigentes', value: totals.activeCount, color: '#00C853', count: totals.activeCount },
              { label: 'Cobradas', value: totals.receivedCount, color: '#20BD5A', count: totals.receivedCount },
              { label: 'Rechazadas', value: totals.rejectedCount, color: '#DC2626', count: totals.rejectedCount },
              { label: 'Otras', value: Math.max(0, totals.totalOps - totals.activeCount - totals.receivedCount - totals.rejectedCount), color: '#94A3B8' },
            ]}
          />
          <div className="mt-4 space-y-2 border-t border-slate-100 pt-3 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Bruto</span>
              <span className="font-semibold tabular-nums">{formatARS(totals.totalGross)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Comisión UNICRÉDITOS</span>
              <span className="font-semibold tabular-nums text-rose-700">− {formatARS(totals.totalCommission)}</span>
            </div>
            <Button variant="outline" size="sm" className="w-full" onClick={() => onTab('liquidations')}>
              Abrir liquidaciones
            </Button>
          </div>
        </section>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white">
        <header className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-brand-navy-900">Últimas operaciones</h2>
            <p className="text-xs text-slate-500">{lastSales.length ? 'Movimiento reciente' : 'Sin ventas registradas'}</p>
          </div>
          <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => onTab('sales')}>
            Nueva venta
          </Button>
        </header>
        {lastSales.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-slate-500">
            {merchant?.status === 'active'
              ? 'Registrá la primera venta en cuotas.'
              : 'Cuando el comercio esté habilitado vas a ver las operaciones acá.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                  <TableHead className="text-right">Cuotas</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Fecha</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lastSales.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <p className="text-sm font-medium">{extractCustomerName(row.purpose)}</p>
                      <p className="font-mono text-[11px] text-slate-500">{row.id.slice(0, 10)}</p>
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">{formatARS(row.principal)}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.term}</TableCell>
                    <TableCell>
                      <StatusChip
                        status={
                          row.status === 'approved'
                            ? 'aprobado'
                            : row.status === 'paid'
                              ? 'pagado'
                              : row.status === 'rejected'
                                ? 'rechazado'
                                : row.status === 'active'
                                  ? 'activo'
                                  : 'pendiente'
                        }
                      />
                    </TableCell>
                    <TableCell className="text-xs text-slate-500">
                      {new Date(row.createdAt).toLocaleDateString('es-AR')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
    </div>
  )
}

type MerchantTotals = any

function MerchantProfileForm({
  existing,
  titularDiditApproved = false,
  documents = [],
}: {
  existing: MerchantType | null
  titularDiditApproved?: boolean
  documents?: MerchantDocRow[]
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [looking, setLooking] = useState(false)
  const [uploading, setUploading] = useState<string | null>(null)
  const [diditOk, setDiditOk] = useState(titularDiditApproved)
  const [diditConfigured, setDiditConfigured] = useState<boolean | null>(null)
  const [diditError, setDiditError] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null)
  const [evaluation, setEvaluation] = useState<{
    personType: string
    taxCondition: string
    taxConditionLabel: string
    taxStatus: string
    legalName: string
    blockers: string[]
    warnings: string[]
    requiredDocuments: MerchantDocType[]
    canSubmit: boolean
    canPersist: boolean
    titularMatch: string
    monotributoCategory: string
  } | null>(null)
  const [form, setForm] = useState({
    businessName: existing?.businessName ?? "",
    cuit: existing?.cuit ?? "",
    category: existing?.category ?? "",
    province: existing?.province ?? "",
    city: existing?.city ?? "",
    address: existing?.address ?? "",
    phone: existing?.phone ?? "",
    representativeRole: (existing?.representativeRole as RepresentativeRole) || "titular",
  })

  useEffect(() => {
    void getDiditPublicConfig().then((cfg) => setDiditConfigured(cfg.configured))
  }, [])

  function upd<K extends keyof typeof form>(k: K, v: typeof form[K]) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  async function consultarArca() {
    setLooking(true)
    setMsg(null)
    try {
      const res = await lookupMerchantAfip(form.cuit)
      if (!res.ok) {
        setMsg({ type: "err", text: res.error })
        setEvaluation(null)
        return
      }
      setEvaluation(res.evaluation)
      if (res.padron) {
        setForm((f) => ({
          ...f,
          businessName: res.padron?.name || f.businessName,
          cuit: res.padron?.cuil || f.cuit,
          province: res.padron?.province || f.province,
          city: res.padron?.city || f.city,
          address: res.padron?.address || f.address,
          representativeRole:
            res.padron?.personType === "JURIDICA" && f.representativeRole === "titular"
              ? "presidente"
              : f.representativeRole,
        }))
      }
      if (res.evaluation.blockers.length && !res.evaluation.canPersist) {
        setMsg({ type: "err", text: res.evaluation.blockers[0] })
      }
    } catch (err: any) {
      setMsg({ type: "err", text: err?.message ?? "No se pudo consultar ARCA." })
    } finally {
      setLooking(false)
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!diditOk) {
      setMsg({ type: "err", text: "Verificá la identidad del titular con Didit antes de registrar el comercio." })
      return
    }
    setLoading(true)
    setMsg(null)
    try {
      const res = await registerMerchant({
        businessName: form.businessName.trim(),
        cuit: form.cuit.trim(),
        category: form.category,
        province: form.province,
        city: form.city,
        address: form.address,
        phone: form.phone,
        representativeRole: form.representativeRole,
      })
      if (res.ok) {
        setEvaluation(res.evaluation)
        setMsg({
          type: "ok",
          text: res.evaluation.canSubmit
            ? "Comercio enviado a revisión. ARCA y Didit ya están cruzados."
            : res.evaluation.blockers[0] || "Datos ARCA guardados. Completá el expediente societario.",
        })
        router.refresh()
      }
    } catch (err: any) {
      setMsg({ type: "err", text: err?.message ?? "Ocurrió un error." })
    } finally {
      setLoading(false)
    }
  }

  async function uploadDoc(type: MerchantDocType, file: File) {
    setUploading(type)
    setMsg(null)
    try {
      const data = new FormData()
      data.set("type", type)
      data.set("file", file)
      const res = await fetch("/api/merchant/documents", { method: "POST", body: data })
      const json = await res.json()
      if (!json.ok) {
        setMsg({ type: "err", text: json.error || "No se pudo adjuntar el archivo." })
        return
      }
      router.refresh()
    } catch (err: any) {
      setMsg({ type: "err", text: err?.message ?? "No se pudo adjuntar el archivo." })
    } finally {
      setUploading(null)
    }
  }

  async function removeDoc(id: string) {
    setMsg(null)
    const res = await fetch(`/api/merchant/documents?id=${encodeURIComponent(id)}`, { method: "DELETE" })
    const json = await res.json()
    if (!json.ok) {
      setMsg({ type: "err", text: json.error || "No se pudo borrar el archivo." })
      return
    }
    router.refresh()
  }

  const personType = evaluation?.personType || existing?.personType
  const taxLabel =
    evaluation?.taxConditionLabel ||
    (existing?.taxCondition ? TAX_CONDITION_LABELS[existing.taxCondition as keyof typeof TAX_CONDITION_LABELS] : "")
  const requiredDocs = evaluation?.requiredDocuments?.length
    ? evaluation.requiredDocuments
    : personType === "JURIDICA"
      ? (form.representativeRole === "apoderado"
          ? (["estatuto_contrato_social", "poder"] as MerchantDocType[])
          : (["estatuto_contrato_social", "acta_designacion"] as MerchantDocType[]))
      : []
  const lockedFromAfip = Boolean(evaluation?.legalName || existing?.legalName)

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <form onSubmit={submit} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="cuit">CUIT del comercio</Label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  id="cuit"
                  value={form.cuit}
                  onChange={(e) => upd("cuit", e.target.value)}
                  placeholder="30-12345678-9"
                  required
                />
                <Button type="button" variant="outline" disabled={looking || !form.cuit} onClick={() => void consultarArca()}>
                  {looking ? "Consultando…" : "Consultar ARCA"}
                </Button>
              </div>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="businessName">Razón social (padrón)</Label>
              <Input
                id="businessName"
                value={form.businessName}
                onChange={(e) => upd("businessName", e.target.value)}
                placeholder="Consultá el CUIT"
                required
                readOnly={lockedFromAfip}
              />
            </div>
            {personType ? (
              <div className="sm:col-span-2 grid gap-2 rounded-lg border bg-muted/40 p-3 text-sm">
                <p><span className="text-muted-foreground">Persona: </span>{personType === "JURIDICA" ? "Jurídica" : personType === "FISICA" ? "Física" : personType}</p>
                <p><span className="text-muted-foreground">Condición fiscal: </span>{taxLabel || existing?.taxCondition || "—"}</p>
                {(evaluation?.monotributoCategory || existing?.monotributoCategory) ? (
                  <p><span className="text-muted-foreground">Categoría monotributo: </span>{evaluation?.monotributoCategory || existing?.monotributoCategory}</p>
                ) : null}
                <p><span className="text-muted-foreground">Clave fiscal: </span>{evaluation?.taxStatus || existing?.taxStatus || "—"}</p>
                <p><span className="text-muted-foreground">Cruce titular: </span>{evaluation?.titularMatch || existing?.titularMatch || "—"}</p>
              </div>
            ) : null}
            {personType === "JURIDICA" ? (
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Rol del representante</Label>
                <Select
                  value={form.representativeRole}
                  onValueChange={(v) => upd("representativeRole", (v as RepresentativeRole) || "presidente")}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="presidente">Presidente / representante legal</SelectItem>
                    <SelectItem value="socio_gerente">Socio gerente</SelectItem>
                    <SelectItem value="administrador">Administrador</SelectItem>
                    <SelectItem value="apoderado">Apoderado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            <div className="space-y-1.5">
              <Label htmlFor="phone">Teléfono</Label>
              <Input
                id="phone"
                value={form.phone}
                onChange={(e) => upd("phone", e.target.value)}
                placeholder="+54 11 1234-5678"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="category">Categoría</Label>
              <Select
                value={form.category || "none"}
                onValueChange={(v) => upd("category", !v || v === "none" ? "" : v)}
              >
                <SelectTrigger id="category" className="w-full">
                  <SelectValue placeholder="Seleccionar categoría" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Sin especificar —</SelectItem>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="province">Provincia</Label>
              <Select
                value={form.province || "none"}
                onValueChange={(v) => upd("province", !v || v === "none" ? "" : v)}
              >
                <SelectTrigger id="province" className="w-full">
                  <SelectValue placeholder="Seleccionar provincia" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Sin especificar —</SelectItem>
                  {PROVINCES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="city">Ciudad</Label>
              <Input
                id="city"
                value={form.city}
                onChange={(e) => upd("city", e.target.value)}
                placeholder="Córdoba"
                readOnly={lockedFromAfip}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="address">Domicilio fiscal</Label>
              <Input
                id="address"
                value={form.address}
                onChange={(e) => upd("address", e.target.value)}
                placeholder="Sale del padrón ARCA"
                readOnly={lockedFromAfip}
              />
            </div>
          </div>

          {requiredDocs.length > 0 ? (
            <div className="space-y-3 rounded-lg border p-4">
              <p className="text-sm font-medium">Expediente de persona jurídica</p>
              <p className="text-xs text-muted-foreground">
                La constancia de inscripción no se adjunta: se lee del padrón ARCA. Subí estatuto y el instrumento de representación (PDF o imagen, hasta 4 MB).
              </p>
              {requiredDocs.map((type) => {
                const current = documents.find((d) => d.type === type)
                return (
                  <div key={type} className="flex flex-col gap-2 rounded-md bg-muted/40 p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-medium">{MERCHANT_DOC_LABELS[type]}</p>
                      {current ? (
                        <p className="text-xs text-muted-foreground">{current.fileName} · {Math.round(current.size / 1024)} KB</p>
                      ) : (
                        <p className="text-xs text-amber-700">Pendiente</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        type="file"
                        accept="application/pdf,image/jpeg,image/png,image/webp"
                        disabled={uploading === type}
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) void uploadDoc(type, file)
                          e.currentTarget.value = ""
                        }}
                      />
                      {current ? (
                        <Button type="button" variant="outline" size="sm" onClick={() => void removeDoc(current.id)}>
                          Quitar
                        </Button>
                      ) : null}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Monotributo, RI o exento persona física: no se piden estatutos. La constancia sale de ARCA y la identidad del titular de Didit.
            </p>
          )}

          {evaluation?.warnings?.length ? (
            <ul className="list-disc pl-4 text-xs text-muted-foreground">
              {evaluation.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          ) : null}

          {msg && (
            <div
              className={`rounded-lg px-3 py-2 text-sm ${
                msg.type === "ok"
                  ? "bg-primary/10 text-primary"
                  : "bg-destructive/10 text-destructive"
              }`}
            >
              {msg.text}
            </div>
          )}

          <div className="flex items-center gap-3">
            <Button type="submit" disabled={loading || !diditOk}>
              {loading ? "Guardando…" : existing ? "Guardar y revalidar ARCA" : "Registrar comercio"}
            </Button>
            {!diditOk ? (
              <p className="text-xs text-amber-700">Completá Didit del titular (derecha) antes de enviar el alta.</p>
            ) : null}
          </div>
        </form>
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Store className="h-4 w-4 text-primary" /> Estado
            </CardTitle>
            <CardDescription>Adhesión y expediente fiscal</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Alta</span>
              <StatusBadge status={existing?.status ?? "pending"} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">KYB</span>
              <span className="text-xs font-medium">
                {existing?.kybStatus === 'complete' || existing?.kybStatus === 'approved'
                  ? 'Completo'
                  : existing?.kybStatus === 'pending'
                    ? 'En revisión'
                    : 'Pendiente de completar'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Comisión</span>
              <span className="font-mono text-sm font-semibold">
                {formatPercent(existing?.commissionRate ?? 8)}
              </span>
            </div>
            {Array.isArray(existing?.kybBlockers) && existing.kybBlockers.length > 0 && (
              <ul className="rounded-lg bg-amber-50 p-3 text-xs text-amber-900 space-y-1">
                {existing.kybBlockers.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            )}
            {existing?.status === "pending" && (
              <p className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
                Queda pendiente de habilitación. Admin no puede activar si ARCA, Didit o el expediente societario no cierran.
              </p>
            )}
            {existing?.status === "rejected" && (
              <p className="rounded-lg bg-destructive/5 p-3 text-xs text-destructive">
                Solicitud rechazada. Corregí CUIT o expediente y volvé a consultar ARCA.
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Identidad Didit</CardTitle>
            <CardDescription>
              Persona física: DNI + selfie. Persona jurídica: el representante. La sociedad se valida con ARCA.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {diditConfigured === null ? (
              <p className="text-sm text-muted-foreground">Comprobando Didit…</p>
            ) : !diditConfigured ? (
              <p className="text-sm text-destructive">
                Didit no está disponible. Falta DIDIT_API_KEY en el proceso de Next. Reiniciá `next dev`.
              </p>
            ) : (
              <DiditVerifyButton
                mode="session"
                phone={form.phone}
                className="w-full"
                onError={setDiditError}
                onCompleted={(status) => {
                  if (status === "Approved" || status === "approved") setDiditOk(true)
                  router.refresh()
                }}
              />
            )}
            {diditError && <p className="text-sm text-destructive">{diditError}</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function SaleForm({
  merchant,
  titularDiditApproved = false,
}: {
  merchant: MerchantType | null
  titularDiditApproved?: boolean
}) {
  const router = useRouter()
  const disabled = !merchant || merchant.status !== "active" || !titularDiditApproved
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<
    | { type: "ok" | "err"; text: string; data?: { loanId: string; installmentAmount: number } }
    | null
  >(null)

  const [amount, setAmount] = useState<string>("")
  const [term, setTerm] = useState<number>(6)
  const catalogRate = catalogByType("consumo").monthlyRate
  const [zeroInterest, setZeroInterest] = useState(false)
  const monthlyRate = zeroInterest ? 0 : catalogRate
  const [customerName, setCustomerName] = useState<string>("")
  const [customerCuil, setCustomerCuil] = useState<string>("")

  const sim = useMemo(() => {
    const a = Number(amount) || 0
    if (a <= 0 || term < 1 || term > 24 || monthlyRate < 0) return null
    try {
      return computeFrenchAmortization(a, term, monthlyRate)
    } catch {
      return null
    }
  }, [amount, term, monthlyRate])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setMsg(null)
    try {
      const res = await createMerchantSale({
        amount: Number(amount),
        term,
        zeroInterest,
        customerName: customerName.trim(),
        customerCuil,
      })
      if (!res.ok) {
        setMsg({ type: "err", text: res.error })
      } else {
        setMsg({
          type: "ok",
          text:
            res.status === 'rejected'
              ? `Evaluada y rechazada: ${res.rejectionReason ?? 'sin detalle'}`
              : "Crédito originado a nombre del cliente. Tiene que firmar el contrato en su panel.",
          data: { loanId: res.loanId, installmentAmount: Number(res.installmentAmount) },
        })
        setAmount("")
        setCustomerName("")
        setCustomerCuil("")
        router.refresh()
      }
    } catch (err: any) {
      setMsg({ type: "err", text: err?.message ?? "Ocurrió un error." })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2">
        {disabled && (
          <div className="mb-4 rounded-lg border border-dashed border-amber-500/40 bg-amber-500/5 p-3 text-sm text-amber-700 dark:text-amber-400">
            <AlertCircle className="mr-1 inline h-4 w-4" />
            Necesitás que tu comercio esté <strong>aprobado</strong> para registrar ventas.
          </div>
        )}
        <form onSubmit={submit} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="customerName">Nombre del cliente</Label>
              <Input
                id="customerName"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Como figura en su cuenta UNICRÉDITOS"
                disabled={disabled || loading}
                required
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="customerCuil">CUIL del cliente</Label>
              <Input
                id="customerCuil"
                value={customerCuil}
                onChange={(e) => setCustomerCuil(e.target.value)}
                placeholder="20-12345678-3"
                disabled={disabled || loading}
                required
              />
              <p className="text-[11px] text-muted-foreground">Tiene que tener cuenta, KYC Didit e ingresos cargados. El crédito queda a su nombre.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="amount">Monto de la venta (ARS)</Label>
              <Input
                id="amount"
                type="number"
                min={1}
                step="1"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="250000"
                disabled={disabled || loading}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="term">Cantidad de cuotas</Label>
              <Select
                value={String(term)}
                onValueChange={(v) => setTerm(Number(v))}
                disabled={disabled || loading}
              >
                <SelectTrigger id="term" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 24 }, (_, i) => i + 1).map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n} cuota{n > 1 ? "s" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 sm:col-span-2 rounded-lg border bg-muted/40 px-3 py-2.5">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Tasa de catálogo (consumo)
              </p>
              <p className="font-mono text-sm font-semibold">{formatPercent(monthlyRate)} mensual</p>
              <label className="mt-2 flex items-start gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={zeroInterest}
                  onChange={(e) => setZeroInterest(e.target.checked)}
                  disabled={disabled || loading}
                />
                <span>
                  Promoción <strong>0% para el cliente</strong> (el comercio absorbe el interés).
                </span>
              </label>
              {!zeroInterest ? (
                <p className="text-xs text-muted-foreground">
                  La fija UNICRÉDITOS. El CFT lo paga el cliente.
                </p>
              ) : (
                <p className="text-xs text-emerald-700">Cuotas sin interés para el comprador.</p>
              )}
            </div>
          </div>

          {msg && (
            <div
              className={`rounded-lg px-3 py-2 text-sm ${
                msg.type === "ok"
                  ? "bg-primary/10 text-primary"
                  : "bg-destructive/10 text-destructive"
              }`}
            >
              {msg.text}
              {msg.data && (
                <div className="mt-2 grid grid-cols-2 gap-3 rounded-md bg-background/50 p-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">N° Operación</span>
                    <p className="font-mono font-semibold">{msg.data.loanId}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Valor cuota</span>
                    <p className="font-mono font-semibold">
                      {formatARS(msg.data.installmentAmount)}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex items-center gap-3">
            <Button type="submit" disabled={disabled || loading || !sim}>
              {loading ? "Confirmando…" : "Confirmar venta"}
            </Button>
          </div>
        </form>
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-primary" /> Simulación
            </CardTitle>
            <CardDescription>Valores estimados de la operación</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {sim ? (
              <>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Capital</span>
                  <span className="font-mono">
                    {formatARS(
                      sim.schedule.length
                        ? sim.installmentAmount * sim.schedule.length - sim.totalInterest
                        : 0,
                    )}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Cuotas</span>
                  <span className="font-mono">{term}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tasa mensual</span>
                  <span className="font-mono">{formatPercent(monthlyRate)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">TNA</span>
                  <span className="font-mono">{formatPercent(sim.tna)}</span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Valor cuota</span>
                  <span className="font-mono font-semibold text-primary">
                    {formatARS(sim.installmentAmount)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total a pagar</span>
                  <span className="font-mono font-semibold">{formatARS(sim.totalAmount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">CFT</span>
                  <span className="font-mono text-xs">{formatPercent(sim.cft)}</span>
                </div>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">
                Completá monto y cuotas para ver la simulación.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function extractCustomerName(purpose: string | null): string {
  if (!purpose) return "—"
  const marker = "— "
  const idx = purpose.indexOf(marker)
  return idx >= 0 ? purpose.slice(idx + marker.length).trim() : purpose
}

function CustomersTab({ sales }: { sales: SaleType[] }) {
  const grouped = useMemo(() => {
    const m = new Map<string, { total: number; count: number; lastAt: number }>()
    for (const s of sales) {
      const name = extractCustomerName(s.purpose)
      const cur = m.get(name) ?? { total: 0, count: 0, lastAt: 0 }
      cur.total += Number(s.principal) || 0
      cur.count += 1
      const t = new Date(s.createdAt).getTime()
      if (t > cur.lastAt) cur.lastAt = t
      m.set(name, cur)
    }
    return Array.from(m.entries())
      .map(([customer, v]) => ({ customer, ...v }))
      .sort((a, b) => b.total - a.total)
  }, [sales])

  const totalAmount = grouped.reduce((s, g) => s + g.total, 0)
  const totalOps = grouped.reduce((s, g) => s + g.count, 0)

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          label="Clientes únicos"
          value={String(grouped.length)}
          Icon={Users}
          tone="bg-primary/10 text-primary"
        />
        <StatCard
          label="Operaciones totales"
          value={String(totalOps)}
          Icon={FileSpreadsheet}
          tone="bg-sky-500/10 text-sky-700 dark:text-sky-400"
        />
        <StatCard
          label="Total vendido"
          value={formatARS(totalAmount)}
          Icon={TrendingUp}
          tone="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
          mono
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" /> Clientes
          </CardTitle>
          <CardDescription>Ventas agrupadas por cliente</CardDescription>
        </CardHeader>
        <CardContent className="max-h-[480px] overflow-auto pr-1">
          <Table>
            <TableHeader className="sticky top-0 bg-card">
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead className="text-right">Operaciones</TableHead>
                <TableHead className="text-right">Total vendido</TableHead>
                <TableHead className="text-right">Ticket promedio</TableHead>
                <TableHead className="text-right">Última compra</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {grouped.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="py-8 text-center text-muted-foreground"
                  >
                    Todavía no hay ventas registradas.
                  </TableCell>
                </TableRow>
              )}
              {grouped.map((g) => (
                <TableRow key={g.customer}>
                  <TableCell className="font-medium">{g.customer}</TableCell>
                  <TableCell className="text-right font-mono">{g.count}</TableCell>
                  <TableCell className="text-right font-mono font-semibold">
                    {formatARS(g.total)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-muted-foreground">
                    {formatARS(g.count ? g.total / g.count : 0)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs text-muted-foreground">
                    {g.lastAt
                      ? new Date(g.lastAt).toLocaleDateString("es-AR")
                      : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

function LiquidationsTab({
  merchant,
  sales,
  totals,
}: {
  merchant: MerchantType | null
  sales: SaleType[]
  totals: MerchantTotals
}) {
  const commissionRate = merchant ? Number(merchant.commissionRate) : 8
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total financiado"
          value={formatARS(totals.totalPrincipal ?? 0)}
          Icon={CreditCard}
          tone="bg-primary/10 text-primary"
          mono
        />
        <StatCard
          label={`Comisión UNICRÉDITOS (${formatPercent(commissionRate)})`}
          value={`- ${formatARS(totals.totalCommission ?? 0)}`}
          Icon={Receipt}
          tone="bg-rose-500/10 text-rose-700 dark:text-rose-400"
          mono
        />
        <StatCard
          label="Neto para comercio"
          value={formatARS(totals.totalNet ?? 0)}
          Icon={Wallet}
          tone="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
          mono
        />
        <StatCard
          label="Total liquidado"
          value={formatARS(totals.totalGross ?? 0)}
          Icon={Banknote}
          tone="bg-sky-500/10 text-sky-700 dark:text-sky-400"
          mono
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-4 w-4 text-primary" /> Detalle de ventas
          </CardTitle>
          <CardDescription>Todas las operaciones a liquidar</CardDescription>
        </CardHeader>
        <CardContent className="max-h-[560px] overflow-auto pr-1">
          <Table>
            <TableHeader className="sticky top-0 bg-card z-10">
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead className="text-right">Monto</TableHead>
                <TableHead className="text-right">Cuotas</TableHead>
                <TableHead className="text-right">Valor cuota</TableHead>
                <TableHead className="text-right">Comisión</TableHead>
                <TableHead className="text-right">Neto</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sales.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="py-8 text-center text-muted-foreground"
                  >
                    No hay ventas para liquidar todavía.
                  </TableCell>
                </TableRow>
              )}
              {sales.map((s) => {
                const monto = Number(s.principal) || 0
                const comm = (monto * commissionRate) / 100
                const net = monto - comm
                return (
                  <TableRow key={s.id}>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {new Date(s.createdAt).toLocaleDateString("es-AR")}
                    </TableCell>
                    <TableCell className="font-medium">
                      {extractCustomerName(s.purpose)}
                    </TableCell>
                    <TableCell className="text-right font-mono">{formatARS(monto)}</TableCell>
                    <TableCell className="text-right font-mono">{s.term}</TableCell>
                    <TableCell className="text-right font-mono">
                      {formatARS(s.installmentAmount)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-rose-600 dark:text-rose-400">
                      - {formatARS(comm)}
                    </TableCell>
                    <TableCell className="text-right font-mono font-semibold text-primary">
                      {formatARS(net)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={s.status} />
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

function StatCard({
  label,
  value,
  Icon,
  tone,
  mono,
}: {
  label: string
  value: string
  Icon: React.ComponentType<{ className?: string }>
  tone: string
  mono?: boolean
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p
              className={`mt-1 text-base font-semibold text-foreground ${
                mono ? "font-mono" : ""
              }`}
            >
              {value}
            </p>
          </div>
          <div
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${tone}`}
          >
            <Icon className="h-4.5 w-4.5" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function VentaRapidaTab({
  merchant,
  onCreated,
  titularDiditApproved = false,
}: {
  merchant: MerchantType | null
  onCreated: () => void
  titularDiditApproved?: boolean
}) {
  const router = useRouter()
  const disabled = !merchant || merchant.status !== "active" || !titularDiditApproved
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<null | { type: "ok" | "err"; text: string; data?: { loanId: string; installmentAmount: number } }>(null)
  const [amount, setAmount] = useState<string>("250000")
  const [term, setTerm] = useState<number>(6)
  const [customerName, setCustomerName] = useState("")
  const [customerEmail, setCustomerEmail] = useState("")
  const [customerPhone, setCustomerPhone] = useState("")
  const [customerCuil, setCustomerCuil] = useState("")
  const [zeroInterest, setZeroInterest] = useState(false)
  const catalogRate = catalogByType("consumo").monthlyRate
  const monthlyRate = zeroInterest ? 0 : catalogRate

  const sim = useMemo(() => {
    const a = Number(amount) || 0
    if (a <= 0 || term < 1 || term > 24) return null
    try {
      return computeFrenchAmortization(a, term, monthlyRate)
    } catch {
      return null
    }
  }, [amount, term, monthlyRate])

  const quickAmounts = [50000, 100000, 250000, 500000, 1000000]

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setMsg(null)
    try {
      const purposeTag = customerName ? `${customerPhone ? customerPhone + " | " : ""}${customerEmail ? customerEmail + " — " : "— "}${customerName}` : "Cliente Punto de Venta"
      const res = await createMerchantSale({
        amount: Number(amount),
        term,
        zeroInterest,
        customerName: purposeTag,
        customerCuil,
      })
      if (!res.ok) {
        setMsg({ type: "err", text: res.error })
      } else {
        setMsg({
          type: "ok",
          text:
            res.status === "rejected"
              ? `Evaluada y rechazada: ${res.rejectionReason ?? "sin detalle"}`
              : "Crédito a nombre del cliente. Tiene que firmar el contrato en su panel. No se envía WhatsApp.",
          data: { loanId: res.loanId, installmentAmount: Number(res.installmentAmount) },
        })
        setCustomerCuil("")
        onCreated()
        router.refresh()
      }
    } catch (err: any) {
      setMsg({ type: "err", text: err?.message ?? "Error al confirmar la venta." })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-12">
      <div className="lg:col-span-7 space-y-5">
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-brand-cian" /> Venta rápida
                </CardTitle>
                <CardDescription>
                  Completá 3 campos y generá la operación. Link de pago en menos de 10 segundos.
                </CardDescription>
              </div>
              <Badge variant="outline" className="h-6 border-brand-cian/30 bg-brand-cian/10 text-brand-cian">
                <Sparkles className="h-3 w-3 mr-1" /> 100% Online
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <div>
              <Label className="text-muted-foreground text-xs uppercase tracking-wider font-semibold">
                Monto sugerido
              </Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {quickAmounts.map((q) => (
                  <button
                    type="button"
                    key={q}
                    onClick={() => setAmount(String(q))}
                    className={
                      "rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all " +
                      (Number(amount) === q
                        ? "border-brand-primary bg-brand-primary/10 text-brand-primary shadow-sm"
                        : "border-border bg-card hover:border-brand-primary/40 hover:bg-brand-primary/5")
                    }
                  >
                    {formatARS(q)}
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={submit} className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="qr-cuil">CUIL del cliente</Label>
                  <Input
                    id="qr-cuil"
                    value={customerCuil}
                    onChange={(e) => setCustomerCuil(e.target.value)}
                    placeholder="20-12345678-3"
                    required
                    disabled={disabled || loading}
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="qr-name">Nombre del cliente</Label>
                  <Input
                    id="qr-name"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Nombre y apellido"
                    disabled={disabled || loading}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="qr-amount">Monto (ARS)</Label>
                  <Input
                    id="qr-amount"
                    type="number"
                    min={1}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    disabled={disabled || loading}
                    className="font-mono text-base font-bold"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="qr-term">Cuotas</Label>
                  <Select
                    value={String(term)}
                    onValueChange={(v) => setTerm(Number(v))}
                    disabled={disabled || loading}
                  >
                    <SelectTrigger id="qr-term">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 3, 6, 9, 12, 18, 24].map((n) => (
                        <SelectItem key={n} value={String(n)}>
                          {n} cuota{n > 1 ? "s" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <label className="flex items-start gap-2 rounded-lg border bg-muted/30 px-3 py-2.5 text-xs text-muted-foreground sm:col-span-2">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={zeroInterest}
                    onChange={(e) => setZeroInterest(e.target.checked)}
                    disabled={disabled || loading}
                  />
                  <span>
                    Promoción <strong>0% para el cliente</strong> (el comercio absorbe el interés).
                  </span>
                </label>
                <div className="space-y-1.5">
                  <Label htmlFor="qr-phone">Teléfono (opcional)</Label>
                  <Input
                    id="qr-phone"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="+54 9 11 1234-5678"
                    disabled={disabled || loading}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="qr-email">Email (opcional)</Label>
                  <Input
                    id="qr-email"
                    type="email"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    placeholder="cliente@email.com"
                    disabled={disabled || loading}
                  />
                </div>
              </div>

              {disabled && (
                <div className="rounded-lg border border-dashed border-amber-500/40 bg-amber-500/5 p-3 text-sm text-amber-700 dark:text-amber-400">
                  <AlertCircle className="mr-1 inline h-4 w-4" />
                  Tu comercio debe estar <strong>aprobado</strong> para emitir ventas.
                </div>
              )}

              {msg && (
                <div
                  className={
                    "rounded-lg px-3 py-2.5 text-sm " +
                    (msg.type === "ok" ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : "bg-destructive/10 text-destructive")
                  }
                >
                  {msg.text}
                  {msg.data && (
                    <div className="mt-2 grid grid-cols-3 gap-2 rounded-md bg-background/60 p-2 text-xs">
                      <div>
                        <p className="text-muted-foreground">Operación</p>
                        <p className="font-mono font-bold">#{msg.data.loanId.slice(-8)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Cuota</p>
                        <p className="font-mono font-bold">{formatARS(msg.data.installmentAmount)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">TNA</p>
                        <p className="font-mono font-bold">{formatPercent(sim?.tna ?? 0)}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <Button type="submit" size="lg" disabled={disabled || loading || !sim} className="w-full shadow-sm sm:w-auto sm:px-10">
                {loading ? (
                  <>Procesando…</>
                ) : (
                  <>
                    <Zap className="h-4.5 w-4.5" /> Generar link de pago
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <div className="lg:col-span-5 space-y-5">
        <Card className="border-brand-primary/20 shadow-md relative overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-brand-navy via-brand-primary to-brand-cian" />
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Calculator className="h-4 w-4 text-primary" /> Simulador en tiempo real
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="text-center py-4">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Valor cuota estimado</p>
                <p className="mt-2 font-mono text-4xl font-black uc-text-gradient">
                  {sim ? formatARS(sim.installmentAmount) : "—"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{term} cuotas mensuales fijas</p>
              </div>
              <div className="rounded-lg border border-border/60 bg-muted/30 divide-y divide-border/60 text-sm">
                {[
                  { k: "Capital financiado", v: sim ? formatARS(sim.schedule.length ? sim.installmentAmount * sim.schedule.length - sim.totalInterest : 0) : "—", mono: true },
                  { k: `Intereses (${formatPercent(monthlyRate)} mensual)`, v: sim ? formatARS(sim.totalInterest) : "—", mono: true },
                  { k: "TNA", v: sim ? formatPercent(sim.tna) : "—", mono: true },
                  { k: "CFT", v: sim ? formatPercent(sim.cft) : "—", mono: true },
                ].map((r) => (
                  <div key={r.k} className="flex items-center justify-between px-3 py-2 first:pt-3 last:pb-3">
                    <span className="text-muted-foreground">{r.k}</span>
                    <span className={"font-semibold " + (r.mono ? "font-mono" : "")}>{r.v}</span>
                  </div>
                ))}
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="font-bold">Total a devolver</span>
                <span className="font-mono text-xl font-black">{sim ? formatARS(sim.totalAmount) : "—"}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Flujo de aprobación</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-3 text-sm">
              {[
                { n: 1, t: "Confirmás la venta", d: "El sistema genera la operación y link único." },
                { n: 2, t: "Cliente firma el acuerdo", d: "100% online por DNI biométrico." },
                { n: 3, t: "Acreditás el dinero", d: "Desembolso en 24hs hábiles a tu CBU." },
              ].map((s) => (
                <li key={s.n} className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-primary/10 text-[11px] font-black text-brand-primary">
                    {s.n}
                  </span>
                  <div>
                    <p className="font-semibold">{s.t}</p>
                    <p className="text-xs text-muted-foreground">{s.d}</p>
                  </div>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function SolicitudesRecibidasTab({ sales }: { sales: SaleType[] }) {
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("all")

  const pendings = sales.filter((s) => s.status === "pending" || !s.status)
  const approved = sales.filter((s) => s.status === "approved" || s.status === "active")
  const rejected = sales.filter((s) => s.status === "rejected")
  const list = filter === "all" ? sales : filter === "pending" ? pendings : filter === "approved" ? approved : rejected

  const quickFilters: { id: typeof filter; label: string; count: number; tone: string }[] = [
    { id: "all", label: "Todas", count: sales.length, tone: "bg-muted" },
    { id: "pending", label: "Pendientes", count: pendings.length, tone: "bg-amber-500/10 text-amber-700" },
    { id: "approved", label: "Aprobadas", count: approved.length, tone: "bg-emerald-500/10 text-emerald-700" },
    { id: "rejected", label: "Rechazadas", count: rejected.length, tone: "bg-rose-500/10 text-rose-700" },
  ]

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {quickFilters.map((q) => (
          <button
            key={q.id}
            onClick={() => setFilter(q.id)}
            className={
              "rounded-xl border p-4 text-left transition-all " +
              (filter === q.id
                ? "border-brand-primary bg-brand-primary/5 shadow-sm ring-1 ring-brand-primary/30"
                : "border-border bg-card hover:border-brand-primary/30 hover:bg-muted/30")
            }
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">{q.label}</p>
              <span className="font-mono text-2xl font-black">{q.count}</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {q.count === 1 ? "solicitud" : "solicitudes"}
            </p>
          </button>
        ))}
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Inbox className="h-4 w-4 text-primary" /> Bandeja de solicitudes
            </CardTitle>
            <CardDescription>Todas las operaciones originadas desde tu comercio</CardDescription>
          </div>
          <div className="hidden items-center gap-2 sm:flex">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-9"
              onClick={() => {
                const rows = list.map((s) => ({
                  id: s.id,
                  monto: s.principal,
                  cuotas: s.term,
                  estado: s.status,
                  fecha: s.createdAt,
                }))
                const blob = new Blob([JSON.stringify(rows, null, 2)], { type: 'application/json' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = `unicreditos-ventas-${Date.now()}.json`
                a.click()
                URL.revokeObjectURL(url)
              }}
            >
              <FileSpreadsheet className="mr-1.5 h-4 w-4" /> Exportar
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0 sm:p-0">
          <div className="uc-scroll-thin overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                  <TableHead className="text-right">Cuotas</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Canal</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead className="text-right">Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="py-12 text-center text-muted-foreground">
                      <div className="flex flex-col items-center gap-2">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
                          <Inbox className="h-6 w-6 text-muted-foreground/60" />
                        </div>
                        <p className="font-semibold text-foreground">Sin solicitudes en esta categoría</p>
                        <p className="text-xs">Generá tu primera venta desde Venta Rápida.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
                {list.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{extractCustomerName(s.purpose)}</p>
                        <p className="truncate text-[11px] font-mono text-muted-foreground">#{s.id.slice(-8)}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono font-bold">{formatARS(s.principal)}</TableCell>
                    <TableCell className="text-right font-mono">{s.term}</TableCell>
                    <TableCell>
                      <StatusChip
                        status={
                          s.status === "approved"
                            ? "aprobado"
                            : s.status === "paid"
                              ? "pagado"
                              : s.status === "rejected"
                                ? "rechazado"
                                : s.status === "active"
                                  ? "activo"
                                  : "pendiente"
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="h-5 text-[10px] font-bold uppercase tracking-wider">
                        Mostrador
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs font-mono text-muted-foreground">
                      {new Date(s.createdAt).toLocaleDateString("es-AR")}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" className="h-7 text-xs">
                        Ver detalle <ChevronRight className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function ConciliacionTab({ merchant, sales, totals }: { merchant: MerchantType | null; sales: SaleType[]; totals: any }) {
  const commissionRate = merchant ? Number(merchant.commissionRate) : 8
  const rows = sales.map((s) => {
    const monto = Number(s.principal) || 0
    const comm = (monto * commissionRate) / 100
    return {
      id: s.id,
      cliente: extractCustomerName(s.purpose),
      fechaOp: new Date(s.createdAt),
      monto,
      comm,
      neto: monto - comm,
      status: s.status,
    }
  })
  const vigentes = rows.filter((r) => r.status === 'active' || r.status === 'paid' || r.status === 'disbursed')
  const enCurso = rows.filter((r) => r.status === 'pending' || r.status === 'approved')
  const totalVigente = vigentes.reduce((a, b) => a + b.neto, 0)
  const totalEnCurso = enCurso.reduce((a, b) => a + b.neto, 0)

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        Bruto, comisión y neto según tus ventas cargadas. No hay matching bancario automático ni fecha de depósito inventada.
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Neto de ventas" value={formatARS(totals.totalNet ?? 0)} Icon={Banknote} tone="bg-brand-primary/10 text-brand-primary" mono />
        <StatCard label="Créditos vigentes" value={formatARS(totalVigente)} Icon={CheckCircle2} tone="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" mono />
        <StatCard label="En originación" value={formatARS(totalEnCurso)} Icon={Clock3} tone="bg-amber-500/10 text-amber-700 dark:text-amber-500" mono />
      </div>

      <div className="grid gap-5 lg:grid-cols-12">
        <Card className="lg:col-span-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Scale className="h-4 w-4 text-primary" /> Ventas y comisión
            </CardTitle>
            <CardDescription>Estado real de cada operación enviada a UNICRÉDITOS</CardDescription>
          </CardHeader>
          <CardContent className="p-0 sm:p-0">
            <div className="uc-scroll-thin overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Operación</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead className="text-right">Venta</TableHead>
                    <TableHead className="text-right">Neto</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                        Todavía no hay ventas para conciliar.
                      </TableCell>
                    </TableRow>
                  )}
                  {rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-xs">#{r.id.slice(-8)}</TableCell>
                      <TableCell className="font-medium">{r.cliente}</TableCell>
                      <TableCell className="text-right font-mono">{formatARS(r.monto)}</TableCell>
                      <TableCell className="text-right font-mono font-bold">{formatARS(r.neto)}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{r.fechaOp.toLocaleDateString("es-AR")}</TableCell>
                      <TableCell>
                        <StatusBadge status={r.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <div className="lg:col-span-4 space-y-5">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Resumen</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="space-y-1.5">
                {[
                  { t: "Ventas brutas", v: formatARS(totals.totalGross ?? 0), cls: "" },
                  { t: `Comisión (${formatPercent(commissionRate)})`, v: `- ${formatARS(totals.totalCommission ?? 0)}`, cls: "text-rose-600 dark:text-rose-400" },
                ].map((r) => (
                  <div key={r.t} className="flex justify-between">
                    <span className="text-muted-foreground">{r.t}</span>
                    <span className={"font-mono font-semibold " + r.cls}>{r.v}</span>
                  </div>
                ))}
              </div>
              <Separator />
              <div className="flex items-center justify-between pt-1">
                <span className="font-bold">Neto estimado</span>
                <span className="text-lg font-semibold tabular-nums">{formatARS(totals.totalNet ?? 0)}</span>
              </div>
            </CardContent>
          </Card>
          <DecisionBanner
            tone="info"
            title="Sin exportes ni matching bancario"
            detail="Cuando tesorería registre la liquidación, el neto acreditado aparece en Liquidaciones. Si hay una diferencia, escribinos por /contacto."
          />
        </div>
      </div>
    </div>
  )
}

function monthlySalesSeries(sales: SaleType[], months = 6) {
  const now = new Date()
  const labels: string[] = []
  const amounts: number[] = []
  const counts: number[] = []
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = d.getFullYear() * 12 + d.getMonth()
    labels.push(d.toLocaleDateString("es-AR", { month: "short" }).replace(".", ""))
    const monthSales = sales.filter((s) => {
      const sd = new Date(s.createdAt)
      return sd.getFullYear() * 12 + sd.getMonth() === key
    })
    amounts.push(monthSales.reduce((sum, s) => sum + Number(s.principal || 0), 0))
    counts.push(monthSales.length)
  }
  return { labels, amounts, counts }
}

function ReportesTab({ sales, totals }: { sales: SaleType[]; totals: any }) {
  const { labels: mesesLabels, amounts: evolV, counts: evolQ } = monthlySalesSeries(sales)

  const catSegments = [
    { label: "Activos", value: totals.activeCount ?? 0, color: "#20BD5A" },
    { label: "Cobrados", value: totals.receivedCount ?? 0, color: "#10B981" },
    { label: "Rechazados", value: totals.rejectedCount ?? 0, color: "#F43F5E" },
  ].filter((s) => s.value > 0)

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        Totales reales de tus operaciones originadas en UNICRÉDITOS.
      </p>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard title="Volumen financiado" value={formatARS(totals.totalPrincipal ?? 0)} icon={<TrendingUp className="h-5 w-5" />} iconBg="bg-brand-primary/10 text-brand-primary" footer={<span className="text-xs text-muted-foreground">Capital originado en el período</span>} />
        <KpiCard title="Operaciones" value={(totals.totalOps ?? 0).toLocaleString("es-AR")} icon={<CreditCard className="h-5 w-5" />} iconBg="bg-sky-500/10 text-sky-700" />
        <KpiCard title="Ticket medio" value={formatARS(totals.avgTicket ?? 0)} icon={<BarChart3 className="h-5 w-5" />} iconBg="bg-amber-500/10 text-amber-600" />
        <KpiCard title="Clientes" value={(totals.totalCustomers ?? 0).toLocaleString("es-AR")} icon={<Users className="h-5 w-5" />} iconBg="bg-emerald-500/10 text-emerald-700" />
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        <SectionCard title="Evolución de ventas (6M)" description="Capital originado por mes, según tus operaciones" icon={<TrendingUp className="h-4 w-4 text-brand-primary" />} className="lg:col-span-8">
          <LineChart
            points={evolV}
            labels={mesesLabels}
            height={260}
            color="#20BD5A"
            fill
            yFormatter={(v) => (v >= 1000000 ? `$${(v / 1000000).toFixed(1)}M` : `$${(v / 1000).toFixed(0)}K`)}
          />
        </SectionCard>

        <SectionCard title="Mix de estados" description="Distribución actual" icon={<CircleDot className="h-4 w-4 text-brand-cian" />} className="lg:col-span-4">
          <div className="flex flex-col items-center justify-center py-2">
            <DonutChart
              segments={catSegments.length ? catSegments : [{ label: "Sin datos", value: 1, color: "#CBD5E1" }]}
              size={200}
              stroke={22}
              centerTitle="Ops"
              centerValue={(totals.totalOps ?? 0).toLocaleString("es-AR")}
            />
            <div className="mt-4 w-full space-y-2">
              {catSegments.length === 0 ? (
                <p className="text-center text-xs text-muted-foreground py-3">Sin datos para graficar.</p>
              ) : (
                catSegments.map((s) => {
                  const tot = catSegments.reduce((a, b) => a + b.value, 0)
                  const p = tot ? Math.round((s.value / tot) * 100) : 0
                  return (
                    <div key={s.label} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                          <span className="font-medium text-muted-foreground">{s.label}</span>
                        </div>
                        <span className="font-bold tabular-nums">{p}%</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${p}%`, backgroundColor: s.color }} />
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        <SectionCard title="Cantidad de operaciones (6M)" description="Operaciones reales por mes" icon={<ChartNoAxesCombined className="h-4 w-4 text-brand-primary" />} className="lg:col-span-7">
          <LineChart
            points={evolQ}
            labels={mesesLabels}
            height={230}
            color="#34D399"
            fill
            yFormatter={(v) => String(v)}
          />
        </SectionCard>

        <SectionCard
          title="Rendimiento"
          description="Indicadores de tus operaciones"
          icon={<FileBarChart className="h-4 w-4 text-brand-cian" />}
          className="lg:col-span-5"
        >
          <dl className="space-y-4 py-2">
            {[
              { t: 'Ticket medio', v: formatARS(totals.avgTicket ?? 0) },
              { t: 'Tasa de aprobación', v: `${totals.totalOps ? Math.round(((totals.activeCount ?? 0) + (totals.receivedCount ?? 0)) / totals.totalOps * 100) : 0}%` },
              { t: 'Clientes únicos', v: String(totals.totalCustomers ?? 0) },
              { t: 'Volumen neto estimado', v: formatARS(totals.totalNet ?? 0) },
            ].map((row) => (
              <div key={row.t} className="flex items-center justify-between border-b border-border/50 pb-3 last:border-0">
                <dt className="text-sm text-muted-foreground">{row.t}</dt>
                <dd className="text-sm font-bold tabular-nums text-brand-navy">{row.v}</dd>
              </div>
            ))}
          </dl>
        </SectionCard>
      </div>
    </div>
  )
}

function AyudaTab() {
  const faqs = [
    { q: "¿Cuándo se acredita el dinero de mi venta?", a: "Tesorería transfiere cuando confirma el desembolso del crédito del cliente. No hay plazo fijo de 24 a 48 horas." },
    { q: "¿Qué comisión cobra UNICRÉDITOS?", a: "La comisión por operación se acuerda comercialmente. La ves en Datos del Comercio y en cada liquidación." },
    { q: "¿Puedo cancelar una venta?", a: "No hay anulación automática desde el panel. Pedí a soporte antes del desembolso del cliente." },
    { q: "¿Qué documentos necesito para dar de alta mi comercio?", a: "El CUIT se consulta en el padrón ARCA: sale razón social, domicilio fiscal y si sos monotributista, IVA responsable inscripto o exento. La identidad del titular o representante se valida con Didit (DNI + selfie). Si el CUIT es de persona jurídica hay que adjuntar estatuto y acta de designación o poder. No se acepta una constancia AFIP subida a mano." },
    { q: "¿Hay límite de monto por operación?", a: "El crédito de consumo tiene tope de catálogo. El cliente también tiene que tener cuenta UNICRÉDITOS, KYC Didit e ingresos declarados." },
  ]
  const [open, setOpen] = useState<number | null>(0)

  return (
    <div className="grid gap-6 lg:grid-cols-12">
      <div className="lg:col-span-8 space-y-5">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HelpCircle className="h-5 w-5 text-primary" /> Centro de Ayuda UNICRÉDITOS Comercios
            </CardTitle>
            <CardDescription>Respuestas inmediatas a las dudas más frecuentes</CardDescription>
          </CardHeader>
          <CardContent className="divide-y divide-border/70">
            {faqs.map((f, i) => (
              <div key={i} className="py-4 first:pt-2 last:pb-2">
                <button
                  onClick={() => setOpen(open === i ? null : i)}
                  className="flex w-full items-start justify-between gap-3 text-left"
                >
                  <span className="font-semibold text-foreground">{f.q}</span>
                  <ChevronDown
                    className={
                      "h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-200 " +
                      (open === i ? "rotate-180 text-brand-primary" : "")
                    }
                  />
                </button>
                {open === i && (
                  <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{f.a}</p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Operación del panel</CardTitle>
            <CardDescription>No publicamos un monitor de uptime. Si una venta no carga o el desembolso no aparece, escribinos.</CardDescription>
          </CardHeader>
        </Card>
      </div>

      <div className="lg:col-span-4 space-y-5">
        <Card className="border-brand-primary/20 shadow-sm relative overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-brand-cian to-brand-primary" />
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Headphones className="h-4 w-4 text-brand-primary" /> Atención al comercio
            </CardTitle>
            <CardDescription>Lunes a viernes, 9 a 18 hs. Sin WhatsApp ni 0800 publicado.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button variant="outline" className="w-full justify-start gap-2" asChild>
              <a href={`mailto:${BRAND.merchantsEmail}`}>
                <Mail className="h-4 w-4" /> {BRAND.merchantsEmail}
              </a>
            </Button>
            <Button variant="outline" className="w-full justify-start gap-2" asChild>
              <a href="/contacto">
                <Ticket className="h-4 w-4" /> Formulario de contacto
              </a>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Horarios de atención</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {[
              { d: "Lunes a Viernes", h: "09:00 – 18:00 hs" },
              { d: "Sábados y feriados", h: "Sin atención" },
              { d: "WhatsApp / 0800", h: "No publicados" },
            ].map((r) => (
              <div key={r.d} className="flex items-center justify-between py-1 border-b border-border/50 last:border-0">
                <span className="text-muted-foreground">{r.d}</span>
                <span className="font-mono text-xs font-semibold">{r.h}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Recursos para comercios</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              Guías operativas y soporte comercial:{' '}
              <a className="font-semibold text-brand-primary" href={`mailto:${BRAND.merchantsEmail}`}>
                {BRAND.merchantsEmail}
              </a>
            </p>
            <Button asChild variant="outline" size="sm">
              <a href="/comercios">Ver beneficios de adhesión</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
