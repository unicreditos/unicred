'use client'

import { getMerchantDocumentsForAdmin, setMerchantStatus } from '@/app/actions/admin'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
import { Check, Loader2, X } from 'lucide-react'
import { useEffect, useState, useTransition } from 'react'
import { toast } from 'sonner'

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
}

function statusBadge(status: string) {
  const map: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    pending: { label: 'Pendiente', variant: 'secondary' },
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
  const [isPending, startTransition] = useTransition()
  const [docsByMerchant, setDocsByMerchant] = useState<Record<string, { id: string; type: string; fileName: string }[]>>({})

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
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'No se pudo actualizar el estado del comercio.')
      }
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
                <div>{m.legalName || m.businessName}</div>
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
                {m.status === 'pending' ? (
                  <div className="inline-flex items-center gap-1">
                    <Button
                      variant="default"
                      size="sm"
                      disabled={isPending || m.kybStatus === 'incomplete'}
                      onClick={() => handleStatus(m.id, m.businessName, 'active')}
                    >
                      {isPending ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Check className="h-3.5 w-3.5" />
                      )}
                      Aprobar
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={isPending}
                      onClick={() => handleStatus(m.id, m.businessName, 'rejected')}
                    >
                      {isPending ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <X className="h-3.5 w-3.5" />
                      )}
                      Rechazar
                    </Button>
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground">Sin acciones</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
