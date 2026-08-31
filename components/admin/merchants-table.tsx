'use client'

import {
  deleteMerchantAdmin,
  getMerchantDocumentsForAdmin,
  setMerchantStatus,
  updateMerchantAdmin,
} from '@/app/actions/admin'
import { Badge } from '@/components/ui/badge'
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
import { TAX_CONDITION_LABELS } from '@/lib/arca/tax-condition'
import { MERCHANT_DOC_LABELS } from '@/lib/merchant-kyb'
import { Check, Loader2, Pencil, Trash2, X } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { adminMerchantHref } from '@/lib/admin-nav'

type MerchantRow = {
  id: string
  businessName: string
  cuit: string
  category: string | null
  status: string
  personType?: string | null
  taxCondition?: string | null
  taxStatus?: string | null
  kybStatus?: string | null
  titularMatch?: string | null
  legalName?: string | null
  kybBlockers?: string[] | null
  phone?: string | null
  city?: string | null
  province?: string | null
  address?: string | null
  commissionRate?: string | number | null
}

function statusBadge(status: string) {
  const map: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    pending: { label: 'Pendiente', variant: 'secondary' },
    approved: { label: 'Activo', variant: 'default' },
    active: { label: 'Activo', variant: 'default' },
    rejected: { label: 'Rechazado', variant: 'destructive' },
  }
  const cfg = map[status] ?? { label: status, variant: 'outline' as const }
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>
}

function formatCUIT(v: string) {
  const s = v.replace(/\D/g, '')
  if (s.length !== 11) return v
  return `${s.slice(0, 2)}-${s.slice(2, 10)}-${s.slice(10)}`
}

export function MerchantsTable({ merchants }: { merchants: MerchantRow[] }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [docsByMerchant, setDocsByMerchant] = useState<Record<string, { id: string; type: string; fileName: string }[]>>({})
  const [edit, setEdit] = useState<MerchantRow | null>(null)
  const [del, setDel] = useState<MerchantRow | null>(null)
  const [form, setForm] = useState({
    businessName: '',
    legalName: '',
    cuit: '',
    category: '',
    phone: '',
    city: '',
    province: '',
    address: '',
    commissionRate: '',
  })

  useEffect(() => {
    let cancelled = false
    async function load() {
      const entries = await Promise.all(
        merchants
          .filter((m) => m.personType === 'JURIDICA')
          .map(async (m) => {
            try {
              const docs = await getMerchantDocumentsForAdmin(m.id)
              return [m.id, docs] as const
            } catch {
              return [m.id, []] as const
            }
          }),
      )
      if (cancelled) return
      setDocsByMerchant(Object.fromEntries(entries))
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [merchants])

  const handleStatus = (id: string, name: string, status: 'active' | 'rejected') => {
    const verb = status === 'active' ? 'aprobar' : 'rechazar'
    const confirmed = window.confirm(
      `¿Estás seguro de ${verb} el comercio "${name}"? La aprobación vuelve a consultar ARCA.`,
    )
    if (!confirmed) return

    startTransition(async () => {
      try {
        const r = await setMerchantStatus(id, status)
        if (r.ok) {
          toast.success(
            status === 'active' ? 'Comercio aprobado correctamente.' : 'Comercio rechazado.',
          )
          router.refresh()
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'No se pudo actualizar el estado del comercio.')
      }
    })
  }

  function openEdit(m: MerchantRow) {
    setEdit(m)
    setForm({
      businessName: m.businessName,
      legalName: m.legalName || '',
      cuit: formatCUIT(m.cuit),
      category: m.category || '',
      phone: m.phone || '',
      city: m.city || '',
      province: m.province || '',
      address: m.address || '',
      commissionRate: m.commissionRate != null ? String(m.commissionRate) : '8',
    })
  }

  return (
    <div className="rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre / Razón Social</TableHead>
            <TableHead>CUIT / ARCA</TableHead>
            <TableHead>KYB</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {!merchants.length && (
            <TableRow>
              <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                No hay comercios pendientes de aprobación.
              </TableCell>
            </TableRow>
          )}
          {merchants.map((m) => (
            <TableRow key={m.id}>
              <TableCell className="font-medium">
                <Link href={adminMerchantHref(m.id)} className="hover:underline">
                  {m.legalName || m.businessName}
                </Link>
                <div className="text-xs text-muted-foreground">{m.category ?? 'Sin rubro'}</div>
              </TableCell>
              <TableCell className="text-sm">
                <div className="font-mono">{formatCUIT(m.cuit)}</div>
                <div className="text-xs text-muted-foreground">
                  {m.personType === 'JURIDICA' ? 'Persona jurídica' : m.personType === 'FISICA' ? 'Persona física' : '—'}
                  {m.taxCondition ? ` · ${TAX_CONDITION_LABELS[m.taxCondition as keyof typeof TAX_CONDITION_LABELS] || m.taxCondition}` : ''}
                </div>
                {m.taxStatus ? <div className="text-xs text-muted-foreground">Clave {m.taxStatus}</div> : null}
              </TableCell>
              <TableCell>
                <div className="text-xs">{m.kybStatus ?? '—'}</div>
                {m.titularMatch ? <div className="text-xs text-muted-foreground">Titular {m.titularMatch}</div> : null}
                {Array.isArray(m.kybBlockers) && m.kybBlockers.length > 0 ? (
                  <div className="mt-1 text-xs text-amber-700">{m.kybBlockers[0]}</div>
                ) : null}
                {(docsByMerchant[m.id] ?? []).map((d) => (
                  <a
                    key={d.id}
                    className="mt-1 block text-xs text-primary underline"
                    href={`/api/admin/merchant-documents/${d.id}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {MERCHANT_DOC_LABELS[d.type as keyof typeof MERCHANT_DOC_LABELS] || d.fileName}
                  </a>
                ))}
              </TableCell>
              <TableCell>{statusBadge(m.status)}</TableCell>
              <TableCell className="text-right">
                <div className="inline-flex flex-wrap items-center justify-end gap-1">
                  {m.status === 'pending' ? (
                    <>
                      <Button
                        variant="default"
                        size="sm"
                        disabled={isPending || m.kybStatus === 'incomplete'}
                        onClick={() => handleStatus(m.id, m.businessName, 'active')}
                      >
                        {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                        Aprobar
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={isPending}
                        onClick={() => handleStatus(m.id, m.businessName, 'rejected')}
                      >
                        {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
                        Rechazar
                      </Button>
                    </>
                  ) : (
                    <Button size="sm" variant="ghost" className="h-8" asChild>
                      <Link href={adminMerchantHref(m.id)}>Ficha</Link>
                    </Button>
                  )}
                  <Button size="sm" variant="outline" className="h-8" disabled={isPending} onClick={() => openEdit(m)}>
                    <Pencil className="h-3.5 w-3.5" /> Editar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 text-destructive"
                    disabled={isPending}
                    onClick={() => setDel(m)}
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Eliminar
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={Boolean(edit)} onOpenChange={(open) => !open && setEdit(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar comercio</DialogTitle>
            <DialogDescription>Nombre, CUIT, rubro y comisión. El estado de adhesión se cambia con Aprobar / Rechazar.</DialogDescription>
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
            <Button variant="outline" onClick={() => setEdit(null)}>
              Cancelar
            </Button>
            <Button
              disabled={isPending || !edit}
              onClick={() => {
                if (!edit) return
                startTransition(async () => {
                  try {
                    await updateMerchantAdmin(edit.id, form)
                    toast.success('Comercio actualizado')
                    setEdit(null)
                    router.refresh()
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : 'No se pudo guardar el comercio.')
                  }
                })
              }}
            >
              {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(del)} onOpenChange={(open) => !open && setDel(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar comercio</DialogTitle>
            <DialogDescription>
              Se borra la adhesión. El titular vuelve a ser cliente. No se puede si hay créditos calificados o vigentes originados por este comercio.
            </DialogDescription>
          </DialogHeader>
          {del ? (
            <p className="text-sm">
              {del.legalName || del.businessName} · {formatCUIT(del.cuit)}
            </p>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDel(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={isPending || !del}
              onClick={() => {
                if (!del) return
                startTransition(async () => {
                  try {
                    await deleteMerchantAdmin(del.id)
                    toast.success('Comercio eliminado')
                    setDel(null)
                    router.refresh()
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : 'No se pudo eliminar el comercio.')
                  }
                })
              }}
            >
              Confirmar baja
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
