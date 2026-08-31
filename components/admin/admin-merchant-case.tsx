'use client'

import { deleteMerchantAdmin, setMerchantStatus, updateMerchantAdmin } from '@/app/actions/admin'
import type { AdminMerchantCase } from '@/app/actions/admin-cases'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { DecisionBanner, MetricTile } from '@/components/unicred/workspace-shell'
import { adminClientHref, adminLoanHref, adminPaymentHref, adminUrl } from '@/lib/admin-nav'
import { TAX_CONDITION_LABELS } from '@/lib/arca/tax-condition'
import { formatARS } from '@/lib/finance'
import { kycStatusLabel, loanStatusLabel, merchantStatusLabel, paymentStatusLabel } from '@/lib/labels'
import { MERCHANT_DOC_LABELS } from '@/lib/merchant-kyb'
import { ArrowLeft, Pencil, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'

function formatCUIT(v: string) {
  const s = v.replace(/\D/g, '')
  if (s.length !== 11) return v
  return `${s.slice(0, 2)}-${s.slice(2, 10)}-${s.slice(10)}`
}

function fmtDate(value: string | null | undefined) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function Field({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-slate-500">{label}</p>
      <p className="mt-1 truncate text-sm text-brand-navy-900">{value || value === 0 ? String(value) : '—'}</p>
    </div>
  )
}

export function AdminMerchantCaseView({ data }: { data: AdminMerchantCase }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [editOpen, setEditOpen] = useState(false)
  const { merchant, owner } = data
  const [form, setForm] = useState({
    businessName: merchant.businessName,
    legalName: merchant.legalName || '',
    cuit: formatCUIT(merchant.cuit),
    category: merchant.category || '',
    phone: merchant.phone || '',
    city: merchant.city || '',
    province: merchant.province || '',
    address: merchant.address || '',
    commissionRate: String(merchant.commissionRate),
  })
  const taxLabel =
    merchant.taxCondition
      ? TAX_CONDITION_LABELS[merchant.taxCondition as keyof typeof TAX_CONDITION_LABELS] || merchant.taxCondition
      : null

  function setStatus(status: 'active' | 'rejected') {
    const verb = status === 'active' ? 'aprobar' : 'rechazar'
    if (!window.confirm(`¿${verb} el comercio "${merchant.businessName}"?`)) return
    start(async () => {
      try {
        const r = await setMerchantStatus(merchant.id, status)
        if (r.ok) toast.success(status === 'active' ? 'Comercio habilitado.' : 'Comercio rechazado.')
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'No se pudo actualizar el comercio.')
      }
    })
  }

  function remove() {
    if (!window.confirm(`¿Eliminar el comercio "${merchant.businessName}"? El titular vuelve a ser cliente.`)) return
    start(async () => {
      try {
        await deleteMerchantAdmin(merchant.id)
        toast.success('Comercio eliminado')
        router.push(adminUrl('comercios'))
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'No se pudo eliminar el comercio.')
      }
    })
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button asChild variant="ghost" size="sm" className="h-8 -ml-2 text-slate-600">
          <Link href={adminUrl('comercios')}>
            <ArrowLeft /> Comercios
          </Link>
        </Button>
        <div className="flex flex-wrap gap-2">
          {merchant.status === 'pending' ? (
            <>
              <Button size="sm" className="h-8" disabled={pending || merchant.kybStatus === 'incomplete'} onClick={() => setStatus('active')}>
                Aprobar
              </Button>
              <Button size="sm" variant="destructive" className="h-8" disabled={pending} onClick={() => setStatus('rejected')}>
                Rechazar
              </Button>
            </>
          ) : null}
          <Button size="sm" variant="outline" className="h-8" disabled={pending} onClick={() => setEditOpen(true)}>
            <Pencil /> Editar
          </Button>
          <Button size="sm" variant="ghost" className="h-8 text-destructive" disabled={pending} onClick={() => remove()}>
            <Trash2 /> Eliminar
          </Button>
        </div>
      </div>

      {merchant.kybBlockers.length > 0 ? (
        <DecisionBanner tone="warn" title="KYB incompleto" detail={merchant.kybBlockers[0]} />
      ) : merchant.status === 'active' || merchant.status === 'approved' ? (
        <DecisionBanner tone="ok" title="Comercio habilitado" detail="Puede originar ventas a crédito." />
      ) : merchant.status === 'rejected' ? (
        <DecisionBanner tone="critical" title="Comercio rechazado" detail="No opera en la red." />
      ) : (
        <DecisionBanner tone="warn" title="Pendiente de adhesión" detail="Falta la aprobación de mesa." />
      )}

      <section className="rounded-lg border border-slate-200 bg-white">
        <div className="grid gap-4 px-4 py-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Nombre de fantasía" value={merchant.businessName} />
          <Field label="Razón social" value={merchant.legalName} />
          <Field label="CUIT" value={formatCUIT(merchant.cuit)} />
          <Field label="Estado" value={merchantStatusLabel(merchant.status)} />
          <Field label="Tipo" value={merchant.personType === 'JURIDICA' ? 'Persona jurídica' : merchant.personType === 'FISICA' ? 'Persona física' : '—'} />
          <Field label="Condición IVA" value={taxLabel} />
          <Field label="KYB" value={merchant.kybStatus} />
          <Field label="Comisión" value={`${merchant.commissionRate.toLocaleString('es-AR')}%`} />
          <Field label="Rubro" value={merchant.category} />
          <Field label="Localidad" value={[merchant.city, merchant.province].filter(Boolean).join(', ')} />
          <Field label="Teléfono" value={merchant.phone} />
          <Field label="Alta" value={fmtDate(merchant.createdAt)} />
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white">
        <header className="border-b border-slate-100 px-4 py-3">
          <h3 className="text-sm font-semibold">Titular</h3>
        </header>
        <div className="grid gap-4 px-4 py-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Nombre" value={owner.name} />
          <Field label="Correo" value={owner.email} />
          <Field label="CUIL" value={owner.cuil} />
          <Field label="Identidad" value={kycStatusLabel(owner.kycStatus)} />
        </div>
        <div className="border-t border-slate-100 px-4 py-3 text-xs">
          <Link href={adminClientHref(owner.id)} className="text-brand-primary hover:underline">
            Abrir ficha del titular
          </Link>
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-3">
        <MetricTile label="Créditos originados" value={String(data.loans.length)} />
        <MetricTile label="Pagos" value={String(data.payments.length)} />
        <MetricTile label="Documentos" value={String(data.documents.length)} />
      </div>

      <section className="rounded-lg border border-slate-200 bg-white">
        <header className="border-b border-slate-100 px-4 py-3">
          <h3 className="text-sm font-semibold">Documentos KYB</h3>
        </header>
        {data.documents.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">Sin archivos cargados.</p>
        ) : (
          <ul className="divide-y">
            {data.documents.map((doc) => (
              <li key={doc.id} className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
                <span>{MERCHANT_DOC_LABELS[doc.type as keyof typeof MERCHANT_DOC_LABELS] || doc.fileName}</span>
                <a className="text-xs underline" href={`/api/admin/merchant-documents/${doc.id}`} target="_blank" rel="noreferrer">
                  Ver
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white">
        <header className="border-b border-slate-100 px-4 py-3">
          <h3 className="text-sm font-semibold">Créditos de este comercio</h3>
        </header>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead className="text-right">Capital</TableHead>
                <TableHead>Cuotas</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Fecha</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.loans.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                    Todavía no originó créditos.
                  </TableCell>
                </TableRow>
              ) : (
                data.loans.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <Link href={adminLoanHref(item.id, item.status)} className="font-mono text-xs hover:underline">
                        {item.id.slice(0, 8)}…
                      </Link>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatARS(item.principal)}</TableCell>
                    <TableCell>{item.term}</TableCell>
                    <TableCell>{loanStatusLabel(item.status)}</TableCell>
                    <TableCell className="text-xs">{fmtDate(item.createdAt)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      {data.payments.length > 0 ? (
        <section className="rounded-lg border border-slate-200 bg-white">
          <header className="border-b border-slate-100 px-4 py-3">
            <h3 className="text-sm font-semibold">Pagos asociados</h3>
          </header>
          <ul className="divide-y">
            {data.payments.slice(0, 20).map((p) => (
              <li key={p.id} className="flex justify-between px-4 py-2 text-sm">
                <Link href={adminPaymentHref(p.id)} className="hover:underline">
                  {paymentStatusLabel(p.status)} · {formatARS(p.amount)}
                </Link>
                <span className="text-xs text-slate-500">{fmtDate(p.createdAt)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar comercio</DialogTitle>
            <DialogDescription>Los cambios quedan en la adhesión. El estado se cambia con Aprobar / Rechazar.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2 space-y-1.5">
              <Label>Nombre de fantasía</Label>
              <Input value={form.businessName} onChange={(e) => setForm((f) => ({ ...f, businessName: e.target.value }))} />
            </div>
            <div className="sm:col-span-2 space-y-1.5">
              <Label>Razón social</Label>
              <Input value={form.legalName} onChange={(e) => setForm((f) => ({ ...f, legalName: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>CUIT</Label>
              <Input className="font-mono" value={form.cuit} onChange={(e) => setForm((f) => ({ ...f, cuit: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Rubro</Label>
              <Input value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Teléfono</Label>
              <Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Comisión %</Label>
              <Input value={form.commissionRate} onChange={(e) => setForm((f) => ({ ...f, commissionRate: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Provincia</Label>
              <Input value={form.province} onChange={(e) => setForm((f) => ({ ...f, province: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Ciudad</Label>
              <Input value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} />
            </div>
            <div className="sm:col-span-2 space-y-1.5">
              <Label>Domicilio</Label>
              <Input value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Cancelar
            </Button>
            <Button
              disabled={pending}
              onClick={() => {
                start(async () => {
                  try {
                    await updateMerchantAdmin(merchant.id, form)
                    toast.success('Comercio actualizado')
                    setEditOpen(false)
                    router.refresh()
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : 'No se pudo guardar el comercio.')
                  }
                })
              }}
            >
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
