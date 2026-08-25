'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
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
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">Tabla de amortización</CardTitle>
            <CardDescription>
              Sistema francés. TNA {tna != null ? formatPercent(tna) : '—'}
              {cft != null ? ` · CFT ${formatPercent(cft)}` : ''}. Sin seguros ni gastos de otorgamiento.
            </CardDescription>
          </div>
          <button
            type="button"
            className="text-xs font-medium text-primary"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? 'Ocultar detalle' : 'Ver capital e interés'}
          </button>
        </div>
      </CardHeader>
      {open ? (
        <CardContent>
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
                    <TableCell className="font-mono text-sm">#{row.number}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{formatARS(row.installment)}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{formatARS(row.capital)}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{formatARS(row.interest)}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{formatARS(row.balance)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      ) : null}
    </Card>
  )
}
