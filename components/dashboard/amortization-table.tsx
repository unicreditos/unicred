'use client'

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { SectionCard } from '@/components/unicred/dashboard-kit'
import { frenchAmortizationSchedule, formatARS, formatPercent } from '@/lib/finance'
import { useMemo, useState } from 'react'

export function AmortizationTable({
  principal,
  monthlyRate,
  term,
  tna,
  cft,
}: {
  principal: number
  monthlyRate: number
  term: number
  tna?: number | string | null
  cft?: number | string | null
}) {
  const [open, setOpen] = useState(false)
  const rows = useMemo(
    () => frenchAmortizationSchedule(principal, monthlyRate, term),
    [principal, monthlyRate, term],
  )
  if (!rows.length) return null

  return (
    <SectionCard
      title="Tabla de amortización"
      description={`Sistema francés. TNA ${tna != null ? formatPercent(tna) : '—'}${cft != null ? ` · CFT ${formatPercent(cft)}` : ''}. Sin seguros ni gastos de otorgamiento.`}
      action={
        <button
          type="button"
          className="text-xs font-medium text-brand-primary hover:underline"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? 'Ocultar detalle' : 'Ver capital e interés'}
        </button>
      }
      bodyClassName={open ? 'p-4 sm:p-5' : 'hidden'}
    >
      {open ? (
      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cuota</TableHead>
              <TableHead className="text-right">Importe</TableHead>
              <TableHead className="text-right">Capital</TableHead>
              <TableHead className="text-right">Interés</TableHead>
              <TableHead className="text-right">Saldo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.number}>
                <TableCell className="font-mono text-sm tabular-nums">#{row.number}</TableCell>
                <TableCell className="text-right font-mono text-sm tabular-nums">{formatARS(row.installment)}</TableCell>
                <TableCell className="text-right font-mono text-sm tabular-nums">{formatARS(row.capital)}</TableCell>
                <TableCell className="text-right font-mono text-sm tabular-nums">{formatARS(row.interest)}</TableCell>
                <TableCell className="text-right font-mono text-sm tabular-nums">{formatARS(row.balance)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      ) : null}
    </SectionCard>
  )
}
