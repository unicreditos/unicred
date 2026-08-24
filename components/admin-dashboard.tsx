'use client'

import { useRouter } from 'next/navigation'
import { setMerchantStatus } from '@/app/actions/admin'
import { formatARS } from '@/lib/finance'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import { Activity, ArrowDownToLine, ArrowUpRight, Bell, Building2, Check, ChevronDown, CircleDollarSign, ClipboardList, Database, FileText, LayoutDashboard, LogOut, Menu, Settings, ShieldCheck, Store, Users, WalletCards, X } from 'lucide-react'
import { signOut } from '@/lib/auth-client'

type Props = { user: { name: string }; stats: any; loans: any[]; merchants: any[]; variables: any[] }

const nav = [
  { label: 'Dashboard', icon: LayoutDashboard, active: true },
  { label: 'Solicitudes', icon: ClipboardList },
  { label: 'Clientes', icon: Users },
  { label: 'Créditos', icon: CircleDollarSign },
  { label: 'Comercios', icon: Store },
  { label: 'Pagos', icon: ArrowDownToLine },
  { label: 'Reportes', icon: FileText },
]

export function AdminDashboard({ user, stats, loans, merchants, variables }: Props) {
  const router = useRouter()
  const approve = async (id: string, status: 'active' | 'rejected') => {
    try { await setMerchantStatus(id, status); toast.success(status === 'active' ? 'Comercio aprobado' : 'Comercio rechazado'); router.refresh() }
    catch { toast.error('No autorizado') }
  }
  const pendingMerchants = merchants.filter((merchant) => merchant.status === 'pending')
  const recentLoans = loans.slice(0, 6)
  return (
    <div className="min-h-svh bg-[#f5f7fa] text-slate-900">
      <div className="flex min-h-svh">
        <aside className="hidden w-64 shrink-0 flex-col bg-[#071b3a] text-white lg:flex">
          <div className="flex h-20 items-center gap-3 px-6"><div className="flex size-10 items-center justify-center rounded-xl bg-[#0d6efd] shadow-lg shadow-blue-950/40"><WalletCards className="size-5" /></div><div><p className="font-semibold tracking-tight">UNICRÉDITOS</p><p className="text-[10px] text-blue-200">Panel de operaciones</p></div></div>
          <Separator className="bg-white/10" />
          <nav className="flex-1 space-y-1 px-3 py-6">{nav.map(({ label, icon: Icon, active }) => <button key={label} type="button" className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${active ? 'bg-[#0d6efd] text-white shadow-md shadow-blue-950/30' : 'text-blue-100/75 hover:bg-white/10 hover:text-white'}`}><Icon className="size-4" />{label}</button>)}<div className="my-5 border-t border-white/10" />{[{ label: 'Usuarios', icon: Users }, { label: 'Configuración', icon: Settings }, { label: 'Seguridad', icon: ShieldCheck }, { label: 'Soporte', icon: Bell }].map(({ label, icon: Icon }) => <button key={label} type="button" className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-blue-100/75 hover:bg-white/10 hover:text-white"><Icon className="size-4" />{label}</button>)}</nav>
          <div className="border-t border-white/10 p-4"><div className="flex items-center gap-3 rounded-lg bg-white/5 p-3"><div className="flex size-9 items-center justify-center rounded-full bg-[#18b778] text-sm font-bold">{user.name.charAt(0).toUpperCase()}</div><div className="min-w-0"><p className="truncate text-sm font-medium">{user.name}</p><p className="truncate text-[11px] text-blue-200/70">Administrador</p></div></div></div>
        </aside>
        <main className="min-w-0 flex-1">
          <header className="flex h-20 items-center justify-between border-b bg-white px-5 lg:px-9"><div className="flex items-center gap-3"><Button size="icon" variant="ghost" className="lg:hidden"><Menu className="size-5" /></Button><div><p className="text-xs font-medium text-slate-500">Centro de operaciones</p><h1 className="text-xl font-bold tracking-tight">Dashboard ejecutivo</h1></div></div><div className="flex items-center gap-2"><Button variant="outline" className="hidden gap-2 sm:flex"><span className="text-xs">01 mayo 2024 — 31 mayo 2024</span><ChevronDown className="size-3.5" /></Button><Button size="icon" variant="ghost" aria-label="Notificaciones"><Bell className="size-4" /></Button><Button variant="outline" size="sm" onClick={() => signOut({ fetchOptions: { onSuccess: () => router.push('/') } })}><LogOut className="mr-2 size-4" />Salir</Button></div></header>
          <div className="space-y-6 p-5 lg:p-9">
            <div className="flex items-end justify-between"><div><h2 className="text-2xl font-bold tracking-tight">Resumen general</h2><p className="mt-1 text-sm text-slate-500">Información registrada en UniCréditos. Sin datos ficticios.</p></div><Button variant="outline" size="sm" className="hidden gap-2 sm:flex"><ArrowDownToLine className="size-4" />Exportar</Button></div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Solicitudes totales" value={stats.loans.total} icon={<ClipboardList />} tone="blue" /><Metric label="Créditos activos" value={stats.loans.active} icon={<Check />} tone="green" /><Metric label="Volumen originado" value={formatARS(Number(stats.loans.volume))} icon={<CircleDollarSign />} tone="violet" /><Metric label="Comercios pendientes" value={stats.merchants.pending} icon={<Building2 />} tone="amber" /></div>
            <div className="grid gap-5 xl:grid-cols-[1.45fr_1fr]"><Card className="border-0 shadow-sm"><CardContent className="p-5"><div className="mb-5 flex items-center justify-between"><div><h3 className="font-semibold">Solicitudes recientes</h3><p className="text-xs text-slate-500">Últimas solicitudes registradas</p></div><Badge variant="outline">Datos reales</Badge></div>{recentLoans.length ? <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-sm"><thead><tr className="border-b text-left text-xs text-slate-500"><th className="pb-3 font-medium">ID</th><th className="pb-3 font-medium">Monto</th><th className="pb-3 font-medium">Estado</th><th className="pb-3 font-medium">Fecha</th></tr></thead><tbody>{recentLoans.map((loan) => <tr key={loan.id} className="border-b last:border-0"><td className="py-3 font-mono text-xs text-blue-700">#{String(loan.id).slice(0, 8)}</td><td className="py-3 font-medium">{formatARS(Number(loan.principal))}</td><td className="py-3"><Status status={loan.status} /></td><td className="py-3 text-xs text-slate-500">{new Date(loan.createdAt).toLocaleDateString('es-AR')}</td></tr>)}</tbody></table></div> : <EmptyState label="No hay solicitudes registradas" />}</CardContent></Card><Card className="border-0 shadow-sm"><CardContent className="p-5"><div className="mb-5"><h3 className="font-semibold">Estado de originación</h3><p className="text-xs text-slate-500">Distribución basada en registros actuales</p></div><div className="space-y-4"><ProgressRow label="Activos" value={stats.loans.active} total={Math.max(stats.loans.total, 1)} color="bg-[#18b778]" /><ProgressRow label="En evaluación" value={stats.loans.pending} total={Math.max(stats.loans.total, 1)} color="bg-[#0d6efd]" /><ProgressRow label="Rechazados" value={stats.loans.rejected} total={Math.max(stats.loans.total, 1)} color="bg-[#f0a52b]" /></div><p className="mt-6 rounded-lg bg-slate-50 p-3 text-xs leading-5 text-slate-500">La información se calcula desde la base de datos de UniCred. No se muestran porcentajes cuando no hay volumen suficiente.</p></CardContent></Card></div>
            <Card className="border-0 shadow-sm"><CardContent className="p-5"><Tabs defaultValue="comercios"><TabsList><TabsTrigger value="comercios">Comercios pendientes ({pendingMerchants.length})</TabsTrigger><TabsTrigger value="prestamos">Todos los préstamos</TabsTrigger><TabsTrigger value="bcra">Variables BCRA</TabsTrigger></TabsList><TabsContent value="comercios" className="mt-5">{pendingMerchants.length ? <div className="divide-y">{pendingMerchants.map((merchant) => <div key={merchant.id} className="flex flex-col gap-4 py-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-medium">{merchant.businessName}</p><p className="text-sm text-slate-500">CUIT {merchant.cuit} · {merchant.category || 'Rubro no informado'}</p></div><div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => approve(merchant.id, 'rejected')}><X className="mr-1 size-4" />Rechazar</Button><Button size="sm" onClick={() => approve(merchant.id, 'active')}><Check className="mr-1 size-4" />Aprobar</Button></div></div>)}</div> : <EmptyState label="No hay comercios pendientes" />}</TabsContent><TabsContent value="prestamos" className="mt-5"><div className="divide-y">{loans.slice(0, 10).map((loan) => <div key={loan.id} className="flex items-center justify-between py-3"><div><p className="font-mono text-xs">#{String(loan.id).slice(0, 8)}</p><p className="text-sm text-slate-500">{formatARS(Number(loan.principal))} · {loan.term} cuotas</p></div><Status status={loan.status} /></div>)}</div></TabsContent><TabsContent value="bcra" className="mt-5"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{variables.slice(0, 6).map((item) => <div key={item.id || item.name} className="rounded-lg border p-3"><p className="text-xs text-slate-500">{item.name || item.variable}</p><p className="mt-1 font-semibold">{item.value ?? 'Sin dato'}</p></div>)}</div></TabsContent></Tabs></CardContent></Card>
          </div>
        </main>
      </div>
    </div>
  )
}

function Metric({ label, value, icon, tone }: { label: string; value: React.ReactNode; icon: React.ReactNode; tone: 'blue' | 'green' | 'violet' | 'amber' }) { const styles = { blue: 'bg-blue-50 text-blue-600', green: 'bg-emerald-50 text-emerald-600', violet: 'bg-indigo-50 text-indigo-600', amber: 'bg-amber-50 text-amber-600' }; return <Card className="border-0 shadow-sm"><CardContent className="flex items-start justify-between p-5"><div><p className="text-xs font-medium text-slate-500">{label}</p><p className="mt-2 font-mono text-2xl font-bold tracking-tight">{value}</p><p className="mt-1 text-[11px] text-slate-400">Registros actuales</p></div><div className={`rounded-xl p-2.5 ${styles[tone]}`}>{icon}</div></CardContent></Card> }
function ProgressRow({ label, value, total, color }: { label: string; value: number; total: number; color: string }) { const percent = Math.round((value / total) * 100); return <div><div className="mb-2 flex justify-between text-xs"><span className="text-slate-600">{label}</span><span className="font-medium">{value} · {percent}%</span></div><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${color}`} style={{ width: `${percent}%` }} /></div></div> }
function Status({ status }: { status: string }) { const config: Record<string, { label: string; className: string }> = { active: { label: 'Activo', className: 'bg-emerald-50 text-emerald-700' }, approved: { label: 'Aprobado', className: 'bg-blue-50 text-blue-700' }, pending: { label: 'En evaluación', className: 'bg-amber-50 text-amber-700' }, rejected: { label: 'Rechazado', className: 'bg-red-50 text-red-700' } }; const item = config[status] || { label: status, className: 'bg-slate-100 text-slate-600' }; return <Badge className={`border-0 ${item.className}`}>{item.label}</Badge> }
function EmptyState({ label }: { label: string }) { return <div className="rounded-lg border border-dashed p-8 text-center text-sm text-slate-500">{label}</div> }
