'use client'

import { approveLoan, markLoanAsActive, rejectLoan } from '@/app/actions/admin'
import { refreshAdminClientFicha, type ClientFicha, type ClientFichaStatus } from '@/app/actions/admin-ficha'
import { ClientFichaExpediente } from '@/components/admin/client-ficha-expediente'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { DecisionBanner, MetricTile } from '@/components/unicred/workspace-shell'
import { adminUrl } from '@/lib/admin-nav'
import { groupDni, initials } from '@/lib/didit-capture'
import { formatARS } from '@/lib/finance'
import { loanStatusLabel, paymentMethodLabel, paymentStatusLabel } from '@/lib/labels'
import { cn } from '@/lib/utils'
import { ArrowLeft, CheckCircle2, Loader2, RefreshCw, XCircle } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, type ReactNode } from 'react'
import { toast } from 'sonner'

const CHIP: Record<ClientFichaStatus, { label: string; className: string; dot: string }> = {
  al_dia: {
    label: 'Al día',
    className: 'bg-emerald-500/10 text-emerald-700 border-emerald-200',
    dot: 'bg-emerald-500',
  },
  vencido: {
    label: 'Con mora',
    className: 'bg-rose-500/10 text-rose-700 border-rose-200',
    dot: 'bg-rose-500',
  },
  pendiente: {
    label: 'Pendiente',
    className: 'bg-amber-500/10 text-amber-700 border-amber-200',
    dot: 'bg-amber-500',
  },
  finalizado: {
    label: 'Finalizado',
    className: 'bg-slate-100 text-slate-600 border-slate-200',
    dot: 'bg-slate-400',
  },
}

function StatusChip({ status }: { status: ClientFichaStatus }) {
  const chip = CHIP[status]
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium', chip.className)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', chip.dot)} />
      {chip.label}
    </span>
  )
}

function fmtDate(value: string | null | undefined) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function shortId(id: string) {
  const clean = id.replace(/^loan_/, '')
  if (clean.length > 12) return clean.slice(0, 4) + '…' + clean.slice(-4)
  return clean
}

function Field({ label, value, mono }: { label: string; value?: string | number | null; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-slate-500">{label}</p>
      <p className={cn('mt-1 truncate text-sm text-brand-navy-900', mono && 'font-mono')}>
        {value || value === 0 ? String(value) : '—'}
      </p>
    </div>
  )
}

function MediaGrid({ items }: { items: Array<{ label: string; url: string; kind: 'image' | 'video' }> }) {
  if (!items.length) {
    return <p className="px-4 py-8 text-center text-sm text-slate-500">Didit todavía no entregó archivos para esta sección.</p>
  }
  return (
    <div className="grid gap-3 p-4 sm:grid-cols-2">
      {items.map((item) => (
        <figure key={`${item.label}-${item.url}`} className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
          {item.kind === 'video' ? (
            <video src={item.url} controls className="aspect-video w-full bg-black object-contain" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.url} alt={item.label} className="aspect-[4/3] w-full bg-white object-contain" />
          )}
          <figcaption className="flex items-center justify-between gap-2 bg-white px-3 py-2 text-xs">
            <span className="text-slate-600">{item.label}</span>
            <a href={item.url} target="_blank" rel="noreferrer" className="font-medium text-brand-primary hover:underline">
              Abrir
            </a>
          </figcaption>
        </figure>
      ))}
    </div>
  )
}

function Panel({
  title,
  hint,
  children,
}: {
  title: string
  hint?: string
  children: ReactNode
}) {
  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <header className="border-b border-slate-100 px-4 py-3">
        <h2 className="text-sm font-semibold text-brand-navy-900">{title}</h2>
        {hint ? <p className="mt-0.5 text-xs text-slate-500">{hint}</p> : null}
      </header>
      {children}
    </section>
  )
}

export function ClientFicha({ ficha }: { ficha: ClientFicha }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<'cuenta' | 'identidad' | 'datos' | 'creditos' | 'expediente'>('cuenta')
  const lastPayment = ficha.payments.find((row) => row.status === 'paid') ?? ficha.payments[0] ?? null
  const portrait = ficha.didit.ids[0]?.media.find((item) => item.label.includes('Retrato'))?.url
  const id = ficha.didit.ids[0]
  const diditOk = ficha.kyc.status === 'approved' || ficha.didit.ids.some((item) => item.status === 'Approved')

  async function refresh() {
    setBusy(true)
    setError(null)
    try {
      await refreshAdminClientFicha(ficha.user.id)
      router.refresh()
    } catch (err) {
      setError((err as Error).message || 'No se pudo actualizar Didit.')
    } finally {
      setBusy(false)
    }
  }

  async function approveCredit(creditId: string) {
    if (!window.confirm('¿Calificar este crédito con las condiciones actuales? El cliente va a recibir el contrato para firmar.')) {
      return
    }
    setBusy(true)
    setError(null)
    try {
      const r = await approveLoan(creditId)
      if (!r.ok) {
        toast.error(r.error)
        setError(r.error)
        return
      }
      toast.success('Crédito calificado. El cliente puede firmar el contrato.')
      router.refresh()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'No se pudo aprobar el crédito'
      toast.error(msg)
      setError(msg)
    } finally {
      setBusy(false)
    }
  }

  async function disburseCredit(creditId: string, signed: boolean) {
    const ok = window.confirm(
      signed
        ? '¿Acreditar el desembolso y dejar el crédito vigente?'
        : 'El contrato todavía no está firmado. ¿Acreditar el desembolso igual y dejar el crédito vigente?',
    )
    if (!ok) return
    setBusy(true)
    setError(null)
    try {
      const r = await markLoanAsActive(creditId)
      if (!r.ok) {
        toast.error(r.error)
        setError(r.error)
        return
      }
      toast.success(
        'receiptNumber' in r && r.receiptNumber
          ? `Desembolso acreditado · ${r.receiptNumber}`
          : 'Crédito vigente y desembolso acreditado',
      )
      router.refresh()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'No se pudo desembolsar el crédito'
      toast.error(msg)
      setError(msg)
    } finally {
      setBusy(false)
    }
  }

  async function rejectCredit(creditId: string) {
    const reason = window.prompt('Motivo del rechazo (lo ve el cliente):', 'Score o capacidad de pago insuficiente')
    if (!reason || !reason.trim()) return
    setBusy(true)
    setError(null)
    try {
      const r = await rejectLoan(creditId, reason.trim())
      if (!r.ok) {
        toast.error(r.error)
        setError(r.error)
        return
      }
      toast.success('Crédito rechazado')
      router.refresh()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'No se pudo rechazar el crédito'
      toast.error(msg)
      setError(msg)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button asChild variant="ghost" size="sm" className="h-8 -ml-2 text-slate-600">
          <Link href={adminUrl('usuarios')}>
            <ArrowLeft /> Personas
          </Link>
        </Button>
        <Button type="button" size="sm" variant="outline" className="h-8" disabled={busy} onClick={() => void refresh()}>
          <RefreshCw className={cn(busy && 'animate-spin')} />
          Actualizar Didit
        </Button>
      </div>

      {error ? <DecisionBanner tone="critical" title="No se pudo actualizar Didit" detail={error} /> : null}

      {ficha.user.banned ? (
        <DecisionBanner tone="critical" title="Acceso bloqueado" detail="Esta persona no puede ingresar a UNICRÉDITOS." />
      ) : diditOk ? (
        <DecisionBanner
          tone="ok"
          title="Identidad verificada por Didit"
          detail="DNI, prueba de vida y face match los define Didit. No se marcan a mano."
        />
      ) : (
        <DecisionBanner
          tone="warn"
          title="Identidad incompleta"
          detail="Esta persona todavía no tiene una decisión Approved de Didit."
        />
      )}

      <section className="rounded-lg border border-slate-200 bg-white">
        <div className="flex flex-wrap items-start justify-between gap-4 px-4 py-4">
          <div className="flex min-w-0 items-start gap-3">
            {portrait ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={portrait} alt="" className="h-12 w-12 rounded-lg object-cover ring-1 ring-slate-200" />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-brand-navy-900 text-sm font-semibold text-white">
                {initials(ficha.user.name)}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500">Titular</p>
              <h2 className="truncate text-lg font-semibold tracking-tight text-brand-navy-900">{ficha.user.name}</h2>
              <p className="mt-0.5 font-mono text-[12px] text-slate-500">
                {groupDni(ficha.profile.dni)}
                {ficha.profile.cuil ? ` · CUIL ${ficha.profile.cuil}` : ''}
              </p>
              <p className="mt-1 truncate text-xs text-slate-500">{ficha.user.email}</p>
            </div>
          </div>
          <div className="text-right">
            <StatusChip status={ficha.chip} />
            <p className="mt-2 text-[11px] text-slate-500">Cliente desde {fmtDate(ficha.user.createdAt)}</p>
            {ficha.kyc.sessionId ? (
              <p className="mt-0.5 max-w-[16rem] truncate font-mono text-[10px] text-slate-400">Didit {ficha.kyc.sessionId}</p>
            ) : null}
          </div>
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-4">
        <MetricTile
          label="Saldo total"
          value={formatARS(ficha.totals.outstanding)}
          hint={`${ficha.credits.length} crédito${ficha.credits.length === 1 ? '' : 's'}`}
          tone={ficha.totals.overdueCount ? 'critical' : 'default'}
        />
        <MetricTile
          label="Cuotas vencidas"
          value={String(ficha.totals.overdueCount)}
          hint={ficha.totals.overdueCount ? 'Hay mora en cartera' : 'Sin atrasos'}
          tone={ficha.totals.overdueCount ? 'critical' : 'ok'}
        />
        <MetricTile
          label="Último pago"
          value={lastPayment ? formatARS(lastPayment.amount) : '—'}
          hint={lastPayment ? `${fmtDate(lastPayment.paidAt)} · ${paymentMethodLabel(lastPayment.method)}` : 'Sin cobros'}
          tone={lastPayment?.status === 'paid' ? 'ok' : 'default'}
        />
        <MetricTile
          label="Documentos"
          value={`${ficha.totals.documentsOk}/${ficha.totals.documentsTotal}`}
          hint="Validaciones Didit y perfil"
          tone={ficha.totals.documentsOk === ficha.totals.documentsTotal ? 'ok' : 'warn'}
        />
      </div>

      <div className="flex w-fit flex-wrap gap-1 rounded-lg border border-slate-200 bg-white p-1">
        {(
          [
            ['cuenta', 'Cuenta'],
            ['creditos', 'Créditos'],
            ['expediente', 'Expediente'],
            ['identidad', 'Identidad'],
            ['datos', 'Datos'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              'h-8 rounded-md px-3 text-xs font-medium transition',
              tab === id ? 'bg-brand-navy-900 text-white' : 'text-slate-600 hover:bg-slate-50',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'cuenta' ? (
        <div className="space-y-4">
          {lastPayment?.status === 'paid' ? (
            <DecisionBanner
              tone="ok"
              title={`Último cobro ${formatARS(lastPayment.amount)}`}
              detail={`${fmtDate(lastPayment.paidAt)} · ${paymentMethodLabel(lastPayment.method)}${lastPayment.receiptNumber ? ` · ${lastPayment.receiptNumber}` : ''}`}
              action={
                lastPayment.receiptId ? (
                  <Button asChild size="sm" variant="outline">
                    <a href={`/dashboard/documentos/recibo/${lastPayment.receiptId}`} target="_blank" rel="noreferrer">
                      Ver recibo
                    </a>
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <DecisionBanner tone="info" title="Sin cobros acreditados" detail="Cuando entre un pago, el recibo y el movimiento aparecen acá." />
          )}

          <Panel title="Historial de pagos" hint="Cada acreditación con su recibo, si ya se emitió">
            {ficha.payments.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-slate-500">Este cliente todavía no tiene pagos.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Medio</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Referencia</TableHead>
                      <TableHead className="text-right">Monto</TableHead>
                      <TableHead>Recibo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ficha.payments.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="text-xs">{fmtDate(row.paidAt)}</TableCell>
                        <TableCell className="text-xs">{paymentMethodLabel(row.method)}</TableCell>
                        <TableCell className="text-xs">{paymentStatusLabel(row.status)}</TableCell>
                        <TableCell className="font-mono text-[11px]">{row.reference || '—'}</TableCell>
                        <TableCell className="text-right font-mono tabular-nums">{formatARS(row.amount)}</TableCell>
                        <TableCell>
                          {row.receiptId ? (
                            <a className="text-xs font-medium text-brand-primary hover:underline" href={`/dashboard/documentos/recibo/${row.receiptId}`} target="_blank" rel="noreferrer">
                              {row.receiptNumber || 'Abrir'}
                            </a>
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </Panel>

          <Panel title="Movimientos de cuenta" hint="Cuotas, desembolsos y cobros de este titular">
            <div className="divide-y divide-slate-100">
              {[
                ...ficha.payments.map((row) => ({
                  id: `p-${row.id}`,
                  at: row.paidAt,
                  title: `Pago ${paymentMethodLabel(row.method)}`,
                  amount: row.amount,
                  tone: row.status === 'paid' ? 'in' : 'wait',
                  extra: row.receiptNumber,
                })),
                ...ficha.credits.flatMap((credit) => [
                  {
                    id: `d-${credit.id}`,
                    at: credit.disbursedAt,
                    title: `Desembolso ${shortId(credit.id)}`,
                    amount: credit.principal,
                    tone: credit.disbursementStatus === 'credited' ? 'out' : 'wait',
                    extra: credit.disbursementStatus,
                  },
                  ...credit.installments
                    .filter((row) => row.status !== 'pending')
                    .map((row) => ({
                      id: `i-${row.id}`,
                      at: row.paidAt || row.dueDate,
                      title: `Cuota #${row.number}`,
                      amount: row.amount,
                      tone: row.status === 'paid' ? 'in' : 'late',
                      extra: row.status === 'paid' ? 'Pagada' : 'Vencida',
                    })),
                ]),
              ]
                .filter((row) => row.at)
                .sort((a, b) => new Date(b.at || 0).getTime() - new Date(a.at || 0).getTime())
                .slice(0, 30)
                .map((row) => (
                  <div key={row.id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-brand-navy-900">{row.title}</p>
                      <p className="text-xs text-slate-500">
                        {fmtDate(row.at)}
                        {row.extra ? ` · ${row.extra}` : ''}
                      </p>
                    </div>
                    <p
                      className={cn(
                        'font-mono text-sm tabular-nums',
                        row.tone === 'late' ? 'text-rose-700' : row.tone === 'out' ? 'text-emerald-700' : 'text-brand-navy-900',
                      )}
                    >
                      {formatARS(row.amount)}
                    </p>
                  </div>
                ))}
            </div>
          </Panel>
        </div>
      ) : null}

      {tab === 'identidad' ? (
        <div className="space-y-4">
          <Panel title="Estado de validación" hint="El DNI, la prueba de vida y el face match los define Didit.">
            <div className="divide-y divide-slate-100">
              {ficha.documents.map((doc) => (
                <div key={doc.key} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-brand-navy-900">{doc.label}</p>
                    <p className="text-xs text-slate-500">{doc.source}</p>
                  </div>
                  {doc.ok ? (
                    <span className="inline-flex items-center gap-2 text-xs font-medium text-emerald-700">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Validado
                      {doc.href ? (
                        <a href={doc.href} target="_blank" rel="noreferrer" className="font-medium text-brand-primary hover:underline">
                          Abrir
                        </a>
                      ) : null}
                    </span>
                  ) : doc.href ? (
                    <a href={doc.href} target="_blank" rel="noreferrer" className="text-xs font-medium text-brand-primary hover:underline">
                      Consultar
                    </a>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-rose-700">
                      <XCircle className="h-3.5 w-3.5" /> Pendiente
                    </span>
                  )}
                </div>
              ))}
            </div>
          </Panel>

          {id ? (
            <Panel title="Datos extraídos del DNI" hint="OCR de la sesión Didit">
              <div className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3">
                <Field label="Nombre" value={id.fullName} />
                <Field label="Documento" value={id.documentNumber} mono />
                <Field label="CUIT/CUIL en DNI" value={id.taxNumber} mono />
                <Field label="Nacimiento" value={id.birthDate} />
                <Field label="Nacionalidad" value={id.nationality} />
                <Field label="Vencimiento" value={id.expirationDate} />
                <Field label="Domicilio del DNI" value={id.address} />
                <Field label="Domicilio geocodificado" value={id.formattedAddress} />
                <Field label="Estado Didit" value={id.status} />
                <Field label="Tipo" value={id.documentType} />
              </div>
            </Panel>
          ) : (
            <Panel title="Datos extraídos del DNI">
              <p className="px-4 py-8 text-center text-sm text-slate-500">
                Esta persona todavía no tiene una decisión Didit. Pedile que complete la verificación en UNICRÉDITOS.
              </p>
            </Panel>
          )}

          {ficha.didit.ids.map((item, index) => (
            <Panel key={`id-${index}`} title="Imágenes del documento" hint="Frente, dorso y retrato capturados por Didit">
              <MediaGrid items={item.media} />
            </Panel>
          ))}

          {ficha.didit.liveness.map((item, index) => (
            <Panel
              key={`live-${index}`}
              title={`Prueba de vida · ${item.method || 'Didit'}`}
              hint={item.score != null ? `Score ${item.score}` : 'Sin score'}
            >
              <MediaGrid items={item.media} />
            </Panel>
          ))}

          {ficha.didit.faces.map((item, index) => (
            <Panel
              key={`face-${index}`}
              title={`Face match · ${item.status}`}
              hint={item.score != null ? `${item.score.toFixed(2)}%` : 'Sin score'}
            >
              <MediaGrid items={item.media} />
            </Panel>
          ))}

          {ficha.didit.ip[0] ? (
            <Panel title="Análisis de IP" hint="Señal de riesgo de la sesión Didit">
              <div className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-4">
                <Field label="País" value={ficha.didit.ip[0].country} />
                <Field label="ISP" value={ficha.didit.ip[0].isp} />
                <Field label="VPN/Tor" value={ficha.didit.ip[0].isVpn ? 'Sí' : 'No'} />
                <Field label="Alertas" value={ficha.didit.ip[0].warnings.join(' · ') || 'Ninguna'} />
              </div>
            </Panel>
          ) : null}
        </div>
      ) : null}

      {tab === 'datos' ? (
        <div>
          <Panel title="Perfil UNICRÉDITOS" hint="Datos declarados y cuenta de desembolso">
            <div className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Email" value={ficha.user.email} />
              <Field label="Teléfono" value={ficha.profile.phone} />
              <Field label="CUIL" value={ficha.profile.cuil} mono />
              <Field label="DNI" value={ficha.profile.dni} mono />
              <Field label="Nacimiento" value={ficha.profile.birthDate} />
              <Field label="Situación laboral" value={ficha.profile.employmentStatus} />
              <Field label="Ingresos" value={ficha.profile.monthlyIncome != null ? formatARS(ficha.profile.monthlyIncome) : null} />
              <Field label="Score UNICRÉDITOS" value={ficha.profile.creditScore} />
              <Field label="Domicilio" value={ficha.profile.address} />
              <Field
                label="Localidad"
                value={[ficha.profile.city, ficha.profile.department, ficha.profile.province, ficha.profile.postalCode]
                  .filter(Boolean)
                  .join(' · ')}
              />
              {ficha.bcra ? (
                <>
                  <Field label="BCRA situación" value={ficha.bcra.worstSituation} />
                  <Field label="Deuda BCRA" value={ficha.bcra.totalDebt != null ? formatARS(ficha.bcra.totalDebt) : null} />
                </>
              ) : null}
              {ficha.bank.map((item) => (
                <Field
                  key={`${item.cbu}-${item.cvu}-${item.alias}`}
                  label={item.verified ? `Cuenta ${item.bankName}` : `${item.bankName} (sin verificar)`}
                  value={item.alias || item.cbu || item.cvu}
                  mono
                />
              ))}
            </div>
          </Panel>
        </div>
      ) : null}

      {tab === 'creditos' ? (
        <div className="space-y-4">
          {ficha.credits.length === 0 ? (
            <Panel title="Cartera">
              <p className="px-4 py-8 text-center text-sm text-slate-500">Este cliente todavía no tiene créditos.</p>
            </Panel>
          ) : (
            ficha.credits.map((credit) => {
              const progress = credit.term ? Math.min(100, (credit.paidCount / credit.term) * 100) : 0
              return (
                <Panel
                  key={credit.id}
                  title={`Crédito ${shortId(credit.id)}`}
                  hint={`Otorgado ${fmtDate(credit.createdAt)}`}
                >
                  <div className="space-y-4 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <StatusChip status={credit.chip} />
                        <span className="text-xs font-medium text-slate-600">{loanStatusLabel(credit.status)}</span>
                      </div>
                      <p className="text-xs text-slate-500">{credit.paidCount}/{credit.term} cuotas</p>
                    </div>
                    {credit.status === 'approved' ? (
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          size="sm"
                          className="h-8 bg-sky-600 hover:bg-sky-700"
                          disabled={busy}
                          onClick={() => void disburseCredit(credit.id, credit.contractStatus === 'accepted')}
                        >
                          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                          Acreditar desembolso
                        </Button>
                      </div>
                    ) : null}
                    {credit.status === 'pending' || credit.status === 'rejected' || credit.status === 'cancelled' ? (
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          size="sm"
                          className="h-8 bg-emerald-600 hover:bg-emerald-700"
                          disabled={busy}
                          onClick={() => void approveCredit(credit.id)}
                        >
                          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                          Aprobar crédito
                        </Button>
                        {credit.status !== 'rejected' ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="destructive"
                            className="h-8"
                            disabled={busy}
                            onClick={() => void rejectCredit(credit.id)}
                          >
                            <XCircle className="h-3.5 w-3.5" />
                            Rechazar
                          </Button>
                        ) : null}
                      </div>
                    ) : null}
                    <div className="grid gap-3 sm:grid-cols-3">
                      <Field label="Capital" value={formatARS(credit.principal)} />
                      <Field label="Cuota" value={formatARS(credit.installmentAmount)} />
                      <Field label="Saldo" value={formatARS(credit.outstanding)} />
                      <Field label="Vencidas" value={credit.overdueCount} />
                      <Field label="Próximo vencimiento" value={fmtDate(credit.nextDue)} />
                      <Field label="Cancelación (capital)" value={formatARS(credit.settlement.settlementAmount)} />
                      <Field label="Intereses a deducir" value={formatARS(credit.settlement.interestDeduction)} />
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-emerald-500" style={{ width: `${progress}%` }} />
                    </div>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>#</TableHead>
                            <TableHead>Vence</TableHead>
                            <TableHead className="text-right">Monto</TableHead>
                            <TableHead>Estado</TableHead>
                            <TableHead>Pagada</TableHead>
                            <TableHead>Recibo</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {credit.installments.map((row) => {
                            const rec = ficha.payments.find((p) => p.installmentId === row.id && p.receiptId)
                            return (
                            <TableRow key={row.id}>
                              <TableCell className="font-mono text-xs">{row.number}</TableCell>
                              <TableCell className="text-xs">{fmtDate(row.dueDate)}</TableCell>
                              <TableCell className="text-right font-mono tabular-nums">{formatARS(row.amount)}</TableCell>
                              <TableCell>
                                {row.status === 'paid' ? (
                                  <span className="text-xs font-medium text-emerald-700">Pagada</span>
                                ) : row.status === 'overdue' ? (
                                  <span className="text-xs font-medium text-rose-700">Vencida</span>
                                ) : (
                                  <span className="text-xs text-slate-500">Pendiente</span>
                                )}
                              </TableCell>
                              <TableCell className="text-xs">{fmtDate(row.paidAt)}</TableCell>
                              <TableCell>
                                {rec?.receiptId ? (
                                  <a className="text-xs font-medium text-brand-primary hover:underline" href={`/dashboard/documentos/recibo/${rec.receiptId}`} target="_blank" rel="noreferrer">
                                    {rec.receiptNumber || 'Ver'}
                                  </a>
                                ) : (
                                  <span className="text-xs text-slate-400">—</span>
                                )}
                              </TableCell>
                            </TableRow>
                            )
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </Panel>
              )
            })
          )}
        </div>
      ) : null}

      {tab === 'expediente' ? <ClientFichaExpediente ficha={ficha} /> : null}
    </div>
  )
}
