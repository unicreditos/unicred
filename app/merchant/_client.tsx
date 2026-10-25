"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "@/lib/auth-client"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"


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
import {
  formatPercent,
} from "@/lib/finance"
import { BRAND } from "@/lib/brand"
import {
  MERCHANT_DOC_LABELS,
  type MerchantDocType,
  type RepresentativeRole,
} from "@/lib/merchant-kyb"
import { TAX_CONDITION_LABELS } from "@/lib/arca/tax-condition"
import { getDiditPublicConfig } from "@/app/actions/didit"
import { registerMerchant, lookupMerchantAfip } from "@/app/actions/merchant"
import { DiditVerifyButton } from "@/components/didit-verify-button"


import { WorkspaceShell, type WorkspaceNavItem } from "@/components/unicred/workspace-shell"
import { SupportChatPanel } from "@/components/support/support-chat"
import { DocumentosTab } from "@/app/merchant/_documentos"
import { CatalogTab } from "@/components/merchant/catalog"
import { NewSaleTab } from "@/components/merchant/new-sale"
import { OrdersTab } from "@/components/merchant/orders"
import { CustomersTab, OverviewTab } from "@/components/merchant/overview"
import { SettlementsTab } from "@/components/merchant/settlements"
import type { Commerce } from "@/components/merchant/shared"
import {
  Banknote,
  ChevronDown,
  Handshake,
  Headphones,
  HelpCircle,
  Inbox,
  Package,
  LayoutDashboard,
  Mail,
  Sparkles,
  Store,
  Ticket,
  Users,
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
  | "venta"
  | "operaciones"
  | "catalogo"
  | "liquidaciones"
  | "clientes"
  | "profile"
  | "documentos"
  | "ayuda"

const MERCHANT_NAV: WorkspaceNavItem[] = [
  { id: "overview", label: "Inicio", icon: LayoutDashboard, group: "Comercio" },
  { id: "venta", label: "Nueva venta", icon: Sparkles, group: "Comercio" },
  { id: "operaciones", label: "Operaciones", icon: Inbox, group: "Comercio" },
  { id: "catalogo", label: "Catálogo", icon: Package, group: "Comercio" },
  { id: "liquidaciones", label: "Liquidaciones", icon: Banknote, group: "Finanzas" },
  { id: "clientes", label: "Clientes", icon: Users, group: "Finanzas" },
  { id: "profile", label: "Datos", icon: Store, group: "Cuenta" },
  { id: "documentos", label: "Documentación", icon: Mail, group: "Cuenta" },
  { id: "ayuda", label: "Ayuda", icon: Handshake, group: "Cuenta" },
]

const MERCHANT_TITLES: Record<TabValue, { title: string; subtitle: string }> = {
  overview: { title: "Mesa del comercio", subtitle: "Ventas en cuotas, entregas y próximo pago" },
  venta: { title: "Nueva venta en cuotas", subtitle: "Anticipo del 30% a UNICRÉDITOS, el resto en cuotas" },
  operaciones: { title: "Operaciones", subtitle: "Cada venta, de la revisión a la entrega" },
  catalogo: { title: "Catálogo", subtitle: "Productos que vendés en cuotas" },
  liquidaciones: { title: "Liquidaciones", subtitle: "Te pagamos todos los viernes lo entregado" },
  clientes: { title: "Clientes", subtitle: "Personas que compraron en cuotas en tu local" },
  profile: { title: "Datos del comercio", subtitle: "CUIT, rubro y domicilio para la adhesión" },
  documentos: { title: "Documentación y mensajes", subtitle: "Qué falta cargar y mensajes de Unicréditos" },
  ayuda: { title: "Ayuda", subtitle: "Operación del panel y contacto" },
}

const MERCHANT_TAB_IDS = Object.keys(MERCHANT_TITLES) as TabValue[]

const MERCHANT_STATUS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "En revisión", variant: "secondary" },
  active: { label: "Habilitado", variant: "default" },
  paused: { label: "Pausado", variant: "outline" },
  rejected: { label: "Rechazado", variant: "destructive" },
}

function StatusBadge({ status }: { status: string }) {
  const v = MERCHANT_STATUS[status] ?? MERCHANT_STATUS.pending
  return <Badge variant={v.variant}>{v.label}</Badge>
}

export function MerchantTabsClient({
  user,
  merchant,
  commerce,
  defaultTab,
  supportCaseId,
  titularDiditApproved = false,
  documents = [],
}: {
  user: { name: string; email: string }
  merchant: MerchantType | null
  commerce: Commerce | null
  defaultTab?: string
  supportCaseId?: string
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
    if (requested === "ayuda" || requested === "documentos") return requested
    return "profile"
  })()

  const [activeTab, setActiveTab] = useState<TabValue>(initTab)

  function goNav(id: string) {
    if (merchant?.status !== "active" && id !== "profile" && id !== "documentos" && id !== "ayuda") {
      setActiveTab("profile")
      return
    }
    setActiveTab(id as TabValue)
  }

  const copy = MERCHANT_TITLES[activeTab]
  const merchantReady = merchant?.status === 'active'
  const nav = merchantReady
    ? MERCHANT_NAV
    : MERCHANT_NAV.filter((item) => item.id === 'profile' || item.id === 'documentos' || item.id === 'ayuda')
  const mobileNav = merchantReady
    ? [
        { id: 'overview', label: 'Inicio', icon: LayoutDashboard },
        { id: 'venta', label: 'Vender', icon: Sparkles },
        { id: 'operaciones', label: 'Operaciones', icon: Inbox },
        { id: 'liquidaciones', label: 'Cobros', icon: Banknote },
      ]
    : [
        { id: 'profile', label: 'Datos', icon: Store },
        { id: 'documentos', label: 'Documentos', icon: Mail },
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
                {commerce ? <OverviewTab data={commerce} onGoto={goNav} /> : null}
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
              <TabsContent value="venta">
                {commerce ? <NewSaleTab data={commerce} onGoto={goNav} /> : null}
              </TabsContent>
              <TabsContent value="operaciones">
                {commerce ? <OrdersTab data={commerce} /> : null}
              </TabsContent>
              <TabsContent value="catalogo">
                {commerce ? <CatalogTab data={commerce} /> : null}
              </TabsContent>
              <TabsContent value="liquidaciones">
                {commerce ? <SettlementsTab data={commerce} /> : null}
              </TabsContent>
              <TabsContent value="clientes">
                {commerce ? <CustomersTab data={commerce} /> : null}
              </TabsContent>
              <TabsContent value="documentos">
                <div className="animate-in fade-in slide-in-from-bottom-2 duration-200">
                  <DocumentosTab />
                </div>
              </TabsContent>
              <TabsContent value="ayuda">
                <div className="animate-in fade-in slide-in-from-bottom-2 duration-200">
                  <AyudaTab initialCaseId={supportCaseId} />
                </div>
              </TabsContent>
            </Tabs>
      </div>
    </WorkspaceShell>
  )
}

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

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (window.location.hash !== '#kyb') return
    const t = window.setTimeout(() => {
      document.getElementById('kyb')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 120)
    return () => window.clearTimeout(t)
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
    <div className="grid gap-6 lg:grid-cols-3" id="kyb">
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

function AyudaTab({ initialCaseId }: { initialCaseId?: string }) {
  const faqs = [
    { q: "¿Cuándo se acredita el dinero de mi venta?", a: "Tesorería transfiere cuando confirma el desembolso del crédito del cliente. No hay plazo fijo de 24 a 48 horas." },
    { q: "¿Qué comisión cobra UNICRÉDITOS?", a: "La comisión por operación se acuerda comercialmente. La ves en Datos del Comercio y en cada liquidación." },
    { q: "¿Puedo cancelar una venta?", a: "No hay anulación automática desde el panel. Pedí a soporte antes del desembolso del cliente." },
    { q: "¿Qué documentos necesito para dar de alta mi comercio?", a: "El CUIT se consulta en el padrón ARCA: sale razón social, domicilio fiscal y si sos monotributista, IVA responsable inscripto o exento. La identidad del titular o representante se valida con Didit (DNI + selfie). Si el CUIT es de persona jurídica hay que adjuntar estatuto y acta de designación o poder. No se acepta una constancia AFIP subida a mano." },
    { q: "¿Hay límite de monto por operación?", a: "El crédito de consumo tiene tope de catálogo. El cliente también tiene que tener cuenta UNICRÉDITOS, KYC Didit e ingresos declarados." },
  ]
  const [open, setOpen] = useState<number | null>(0)

  return (
    <div className="space-y-6">
      <SupportChatPanel audience="merchant" initialCaseId={initialCaseId} />
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
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Headphones className="h-4 w-4 text-brand-primary" /> Atención al comercio
            </CardTitle>
            <CardDescription>Chat en línea en este panel. Lunes a viernes, 9 a 18 hs. Sin WhatsApp ni 0800 publicado.</CardDescription>
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
    </div>
  )
}
