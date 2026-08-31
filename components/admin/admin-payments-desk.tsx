'use client'

import type { AdminPaymentsDesk } from '@/app/actions/admin-cases'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { MetricTile, OpsFloor } from '@/components/unicred/workspace-shell'
import { adminClientHref, adminLoanHref, adminPaymentHref } from '@/lib/admin-nav'
import { formatARS } from '@/lib/finance'
import { paymentMethodLabel, paymentStatusLabel } from '@/lib/labels'
import Link from 'next/link'
import { useMemo, useState } from 'react'

function fmtDate(value: string | null | undefined) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function AdminPaymentsDesk({ desk }: { desk: AdminPaymentsDesk }) {
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('all')

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase()
    return desk.rows.filter((row) => {
      if (status !== 'all' && row.status !== status) return false
      if (!term) return true
      const blob = `${row.id} ${row.userName ?? ''} ${row.userEmail ?? ''} ${row.externalId ?? ''} ${row.referenceNumber ?? ''} ${row.loanId ?? ''}`.toLowerCase()
      return blob.includes(term)
    })
  }, [desk.rows, q, status])

  return (
    <OpsFloor>
      <div className="grid shrink-0 grid-cols-2 gap-1.5 sm:grid-cols-4">
        <MetricTile label="Pagos" value={desk.kpis.total.toLocaleString('es-AR')} hint="Incluye todos los estados" />
        <MetricTile label="Volumen acreditado" value={formatARS(desk.kpis.volume)} hint="status = pagado" />
        <MetricTile label="En proceso" value={String(desk.kpis.pending)} tone={desk.kpis.pending ? 'warn' : 'ok'} />
        <MetricTile label="Fallidos / anulados" value={String(desk.kpis.failed)} tone={desk.kpis.failed ? 'warn' : 'ok'} />
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-1.5 rounded-lg border bg-card p-1.5">
        <Input
          placeholder="Cliente, ID, referencia, crédito…"
          className="h-8 w-72"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select
          className="h-8 rounded-md border border-input bg-card px-3 text-xs"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          aria-label="Filtrar por estado"
        >
          <option value="all">Todos los estados</option>
          <option value="paid">Acreditados</option>
          <option value="pending">Pendientes</option>
          <option value="processing">En proceso</option>
          <option value="pending_review">A verificar</option>
          <option value="failed">Rechazados</option>
        </select>
        <span className="text-[11px] text-muted-foreground">
          {filtered.length} de {desk.rows.length}
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-auto rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead className="text-right">Importe</TableHead>
              <TableHead>Medio</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Crédito</TableHead>
              <TableHead>Referencia</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                  No hay pagos con ese filtro.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="text-xs">{fmtDate(row.paidAt || row.createdAt)}</TableCell>
                  <TableCell>
                    <Link href={adminClientHref(row.userId)} className="text-sm font-medium hover:underline">
                      {row.userName || row.userEmail || 'Cliente'}
                    </Link>
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">{formatARS(row.amount)}</TableCell>
                  <TableCell className="text-xs">{paymentMethodLabel(row.method)}</TableCell>
                  <TableCell>
                    <Link href={adminPaymentHref(row.id)} className="hover:underline">
                      {paymentStatusLabel(row.status)}
                    </Link>
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {row.loanId ? (
                      <Link href={adminLoanHref(row.loanId)} className="hover:underline">
                        {row.loanId.slice(0, 8)}…
                      </Link>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-[11px] text-muted-foreground">
                    {row.externalId || row.referenceNumber || '—'}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </OpsFloor>
  )
}
