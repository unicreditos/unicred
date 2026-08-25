'use client'

import { setMerchantStatus } from '@/app/actions/admin'
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
import { Check, Loader2, X } from 'lucide-react'
import { useTransition } from 'react'
import { toast } from 'sonner'

type MerchantRow = {
  id: string
  businessName: string
  cuit: string
  category: string | null
  status: string
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

  const handleStatus = (id: string, name: string, status: 'active' | 'rejected') => {
    const verb = status === 'active' ? 'aprobar' : 'rechazar'
    const confirmed = window.confirm(
      `¿Estás seguro de ${verb} el comercio "${name}"? Esta acción no se puede deshacer.`,
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
      } catch {
        toast.error('No se pudo actualizar el estado del comercio.')
      }
    })
  }

  return (
    <div className="rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre / Razón Social</TableHead>
            <TableHead>CUIT</TableHead>
            <TableHead>Categoría</TableHead>
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
              <TableCell className="font-medium">{m.businessName}</TableCell>
              <TableCell className="font-mono text-sm">{formatCUIT(m.cuit)}</TableCell>
              <TableCell className="text-muted-foreground">
                {m.category ?? 'Sin categoría'}
              </TableCell>
              <TableCell>{statusBadge(m.status)}</TableCell>
              <TableCell className="text-right">
                {m.status === 'pending' ? (
                  <div className="inline-flex items-center gap-1">
                    <Button
                      variant="default"
                      size="sm"
                      disabled={isPending}
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
