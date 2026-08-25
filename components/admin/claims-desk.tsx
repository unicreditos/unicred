'use client'

import { listOpenClaimsAdmin, respondClaimAdmin } from '@/app/actions/claims'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { supportCase } from '@/lib/db/schema'
import { Scale, Loader2 } from 'lucide-react'
import { useEffect, useState, useTransition } from 'react'

type Claim = typeof supportCase.$inferSelect

const STATUS: Record<string, string> = {
  open: 'Abierto',
  in_review: 'En revisión',
  resolved: 'Respondido',
  closed: 'Cerrado',
}

export function AdminClaimsDesk() {
  const [rows, setRows] = useState<Claim[]>([])
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const refresh = () => {
    listOpenClaimsAdmin()
      .then(setRows)
      .catch((err: Error) => setError(err.message))
  }

  useEffect(() => {
    refresh()
  }, [])

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4">
      <div>
        <h2 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
          <Scale className="h-5 w-5 text-brand-primary" />
          Reclamos Ley 24.240
        </h2>
        <p className="text-sm text-muted-foreground">
          Mesa de Defensa del Consumidor. Plazo máximo de respuesta: 10 días hábiles.
        </p>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {!rows.length ? (
        <p className="rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground">
          No hay reclamos cargados.
        </p>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <article key={row.id} className="rounded-xl border bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold">{row.subject}</p>
                  <p className="font-mono text-[11px] text-muted-foreground">
                    {row.id} · {row.category} · {row.userId.slice(0, 10)}
                  </p>
                </div>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold">
                  {STATUS[row.status] ?? row.status}
                </span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{row.body}</p>
              {row.response ? (
                <p className="mt-3 rounded-lg bg-emerald-50 p-3 text-sm">{row.response}</p>
              ) : (
                <div className="mt-3 space-y-2">
                  <Textarea
                    value={drafts[row.id] ?? ''}
                    onChange={(e) => setDrafts((d) => ({ ...d, [row.id]: e.target.value }))}
                    placeholder="Respuesta al cliente"
                    rows={3}
                  />
                  <Button
                    size="sm"
                    disabled={pending}
                    onClick={() => {
                      startTransition(async () => {
                        try {
                          await respondClaimAdmin(row.id, drafts[row.id] ?? '')
                          setDrafts((d) => ({ ...d, [row.id]: '' }))
                          refresh()
                        } catch (err) {
                          setError(err instanceof Error ? err.message : 'No se pudo responder.')
                        }
                      })
                    }}
                    className="gap-1.5"
                  >
                    {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                    Responder y cerrar
                  </Button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
