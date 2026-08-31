'use client'

import { InAppDocumentPanel } from '@/components/dashboard/in-app-document-panel'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { documentKindTitle, type CustomerDocKind } from '@/lib/documents/customer-view'
import { formatARS } from '@/lib/finance'
import { loanStatusLabel } from '@/lib/labels'
import { canWithdrawAcceptance, WITHDRAWAL_DAYS } from '@/lib/legal/withdrawal'
import { asMoraRows, evaluateIntimation, evaluateRefinance, MAX_REFINANCES } from '@/lib/legal/mora'
import { cn } from '@/lib/utils'
import { ArrowLeft, FileText, Scale } from 'lucide-react'

type LoanLite = {
  id: string
  status: string
  principal: string | number
  term: number
  disbursedAt?: Date | string | null
}

type ContractLite = {
  id: string
  loanId: string
  templateName: string
  version: number | string
  status: string
  createdAt: Date | string
  acceptedAt?: Date | string | null
  acceptedIp?: string | null
  signatureData?: unknown
  loan?: LoanLite | null
}

type BcraReportLite = {
  id: string
  reportNumber: string
  createdAt: Date | string
  scoreAtGeneration?: number | null
}

type InstallmentLite = {
  loanId: string
  number: number
  amount: string | number
  dueDate: Date | string
  status: string
}

type DocItem = {
  kind: CustomerDocKind
  id: string
  title: string
  detail: string
}

export function CustomerDocumentsDesk({
  mode,
  ownerUserId,
  loans,
  contracts,
  bcraReports,
  installments = [],
  lastBcraScore,
  activeKind,
  activeId,
  isPending,
  onOpen,
  onBack,
  onGenBCRA,
  onGenContract,
  onAcceptContract,
  onWithdraw,
  onRefinance,
}: {
  mode: 'documentaciones' | 'contrato' | 'pagare' | 'talonario'
  ownerUserId: string
  loans: LoanLite[]
  contracts: ContractLite[]
  bcraReports: BcraReportLite[]
  installments?: InstallmentLite[]
  lastBcraScore?: number | null
  activeKind: CustomerDocKind | null
  activeId: string | null
  isPending: boolean
  onOpen: (kind: CustomerDocKind, id: string) => void
  onBack: () => void
  onGenBCRA: (checkId?: string | null) => void
  onGenContract: (loanId: string) => void
  onAcceptContract: (contractId: string) => void
  onWithdraw: (loanId: string) => void
  onRefinance?: (loanId: string) => void
}) {
  const latestContract = contracts[0] ?? null
  const funded = loans.filter((l) => l.status === 'approved' || l.status === 'active')

  if (mode === 'contrato') {
    const contract = (activeId && contracts.find((c) => c.id === activeId)) || latestContract
    return (
      <DocumentStage
        title="Contrato de préstamo"
        empty="Todavía no hay un contrato emitido para tus créditos."
        items={contracts.map((c) => ({
          kind: 'contrato' as const,
          id: c.id,
          title: `${c.templateName} v${c.version}`,
          detail: `Emisión ${new Date(c.createdAt as Date).toLocaleDateString('es-AR')} · ${c.status === 'accepted' ? 'Aceptado' : 'Pendiente de firma'}`,
        }))}
        activeKind="contrato"
        activeId={contract?.id ?? activeId}
        pendingLoan={funded.find((l) => !contracts.some((c) => c.loanId === l.id))}
        isPending={isPending}
        onOpen={onOpen}
        onGenContract={onGenContract}
        actions={
          contract ? (
            <ContractActions
              contract={contract}
              loans={loans}
              installments={installments}
              isPending={isPending}
              onAcceptContract={onAcceptContract}
              onWithdraw={onWithdraw}
              onRefinance={onRefinance}
            />
          ) : null
        }
      />
    )
  }

  if (mode === 'pagare') {
    const contract = (activeId && contracts.find((c) => c.id === activeId)) || latestContract
    return (
      <DocumentStage
        title="Pagaré"
        empty="El pagaré se emite junto con el contrato. Cuando haya un contrato, lo ves acá."
        items={contracts.map((c) => ({
          kind: 'pagare' as const,
          id: c.id,
          title: `Pagaré ${c.templateName} v${c.version}`,
          detail: `Emisión ${new Date(c.createdAt as Date).toLocaleDateString('es-AR')}`,
        }))}
        activeKind="pagare"
        activeId={contract?.id ?? activeId}
        isPending={isPending}
        onOpen={onOpen}
      />
    )
  }

  if (mode === 'talonario') {
    const loanIds = Array.from(new Set([...loans.map((l) => l.id), ...contracts.map((c) => c.loanId)].filter(Boolean)))
    const items: DocItem[] = loanIds.map((id) => {
      const loan = loans.find((l) => l.id === id)
      return {
        kind: 'talonario' as const,
        id,
        title: loan ? `Talonario · ${formatARS(loan.principal)}` : `Talonario ${id.slice(0, 8)}`,
        detail: loan ? `${loan.term} cuotas · ${loanStatusLabel(loan.status)}` : 'Cronograma de cuotas',
      }
    })
    const currentId = (activeId && items.some((i) => i.id === activeId) ? activeId : items[0]?.id) ?? null
    return (
      <DocumentStage
        title="Talonario de cuotas"
        empty="El talonario se emite con el crédito. Cuando haya un préstamo, el cronograma se abre acá."
        items={items}
        activeKind="talonario"
        activeId={currentId}
        isPending={isPending}
        onOpen={onOpen}
      />
    )
  }

  const catalog: DocItem[] = [
    ownerUserId
      ? {
          kind: 'arca' as const,
          id: ownerUserId,
          title: 'Constancia ARCA',
          detail: 'Razón social, domicilio fiscal e impuestos del padrón WSAA',
        }
      : null,
    ...bcraReports.map((r) => ({
      kind: 'bcra' as const,
      id: r.id,
      title: `Informe BCRA ${r.reportNumber}`,
      detail: `Emisión ${new Date(r.createdAt as Date).toLocaleDateString('es-AR')} · Score ${r.scoreAtGeneration ?? lastBcraScore ?? '—'}`,
    })),
    ...contracts.flatMap((c) => {
      const loan = c.loan ?? loans.find((l) => l.id === c.loanId)
      const rows: DocItem[] = [
        {
          kind: 'contrato',
          id: c.id,
          title: 'Contrato de préstamo',
          detail: `${c.templateName} v${c.version} · ${loanStatusLabel(loan?.status)}`,
        },
        {
          kind: 'pagare',
          id: c.id,
          title: 'Pagaré',
          detail: `Vinculado al contrato ${c.templateName}`,
        },
        {
          kind: 'estado-deuda',
          id: c.id,
          title: 'Estado de deuda',
          detail: loan ? `${formatARS(loan.principal)} · ${loan.term} cuotas` : 'Cronograma del crédito',
        },
      ]
      if (c.loanId) {
        rows.push({
          kind: 'talonario',
          id: c.loanId,
          title: 'Talonario de cuotas',
          detail: 'Cronograma para pagar desde tu cuenta',
        })
      }
      if (loan?.status === 'active' || loan?.status === 'approved') {
        rows.push({
          kind: 'solvencia',
          id: c.loanId,
          title: 'Certificado de solvencia',
          detail: 'Se emite si el crédito está al día',
        })
        rows.push({
          kind: 'cancelacion',
          id: c.loanId,
          title: 'Liquidación de cancelación',
          detail: 'Capital remanente para cancelar anticipado',
        })
      }
      if (loan?.status === 'paid') {
        rows.push({
          kind: 'libre-deuda',
          id: c.loanId,
          title: 'Constancia de libre deuda',
          detail: 'Crédito cancelado',
        })
      }
      if (
        evaluateIntimation(
          asMoraRows(installments.filter((row) => row.loanId === c.loanId)),
          lastRefinanceFromSignature(c.signatureData),
        ).ok
      ) {
        rows.push({
          kind: 'intimacion',
          id: c.id,
          title: 'Intimación de mora',
          detail: 'Cuotas con más de 30 días de atraso',
        })
      }
      return rows
    }),
  ].filter(Boolean) as DocItem[]

  const resolvedId =
    activeId || (activeKind === 'arca' && ownerUserId ? ownerUserId : null)
  const viewing =
    activeKind && resolvedId
      ? (catalog.find((d) => d.kind === activeKind && d.id === resolvedId) ?? {
          kind: activeKind,
          id: resolvedId,
          title: documentKindTitle(activeKind),
          detail: '',
        })
      : null

  if (viewing) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" /> Todos los documentos
          </Button>
          <p className="text-sm font-medium text-slate-600">{viewing.title}</p>
        </div>
        <InAppDocumentPanel kind={viewing.kind} id={viewing.id} />
      </div>
    )
  }

  const groups = [
    { label: 'Identidad fiscal', items: catalog.filter((i) => i.kind === 'arca') },
    { label: 'Central de Deudores BCRA', items: catalog.filter((i) => i.kind === 'bcra') },
    {
      label: 'Expediente del crédito',
      items: catalog.filter((i) => i.kind !== 'arca' && i.kind !== 'bcra'),
    },
  ].filter((g) => g.items.length)

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Documentaciones</CardTitle>
          <CardDescription>
            Abrí un documento por vez. Se muestra en esta pantalla, sin salir de tu cuenta.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {catalog.length === 0 ? (
            <p className="text-sm text-muted-foreground">Todavía no hay documentos emitidos.</p>
          ) : (
            groups.map((group) => (
              <div key={group.label} className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                  {group.label}
                </p>
                {group.items.map((item) => (
                  <button
                    key={`${item.kind}-${item.id}`}
                    type="button"
                    className="flex w-full items-center justify-between gap-3 rounded-xl border bg-white px-4 py-3 text-left transition hover:border-brand-primary/40 hover:bg-slate-50"
                    onClick={() => onOpen(item.kind, item.id)}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-brand-navy-900">{item.title}</p>
                      <p className="text-xs text-muted-foreground">{item.detail}</p>
                    </div>
                    <Badge variant="outline">Abrir</Badge>
                  </button>
                ))}
              </div>
            ))
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Scale className="h-4 w-4 text-primary" /> Informe BCRA
          </CardTitle>
          <CardDescription>
            {bcraReports.length
              ? 'Generá un informe nuevo a partir de tu última consulta a Central de Deudores.'
              : 'Generá el informe imprimible de tu consulta a Central de Deudores.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button type="button" size="sm" disabled={isPending} onClick={() => onGenBCRA(null)}>
            {bcraReports.length ? 'Generar otro informe' : 'Generar informe'}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

function lastRefinanceFromSignature(data: unknown) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null
  const list = (data as { refinanciaciones?: Array<{ at?: string }> }).refinanciaciones
  return list?.[list.length - 1]?.at ?? null
}

function refinanceUsed(data: unknown) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return 0
  const list = (data as { refinanciaciones?: unknown[] }).refinanciaciones
  return Array.isArray(list) ? list.length : 0
}

function DocumentStage({
  title,
  empty,
  items,
  activeKind,
  activeId,
  pendingLoan,
  isPending,
  onOpen,
  onGenContract,
  actions,
}: {
  title: string
  empty: string
  items: DocItem[]
  activeKind: CustomerDocKind
  activeId: string | null
  pendingLoan?: LoanLite
  isPending?: boolean
  onOpen: (kind: CustomerDocKind, id: string) => void
  onGenContract?: (loanId: string) => void
  actions?: React.ReactNode
}) {
  const current = activeId ? items.find((i) => i.id === activeId) : items[0]
  return (
    <div className="space-y-4">
      {pendingLoan && onGenContract ? (
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <p className="text-sm font-semibold">Crédito sin contrato</p>
              <p className="text-xs text-muted-foreground">
                {formatARS(pendingLoan.principal)} · {pendingLoan.term} cuotas
              </p>
            </div>
            <Button type="button" size="sm" disabled={isPending} onClick={() => onGenContract(pendingLoan.id)}>
              Generar contrato
            </Button>
          </CardContent>
        </Card>
      ) : null}
      {items.length > 1 ? (
        <div className="flex flex-wrap gap-2">
          {items.map((item) => (
            <Button
              key={item.id}
              type="button"
              size="sm"
              variant={item.id === current?.id ? 'default' : 'outline'}
              onClick={() => onOpen(item.kind, item.id)}
            >
              {item.title}
            </Button>
          ))}
        </div>
      ) : null}
      {current ? (
        <>
          {actions}
          <InAppDocumentPanel kind={activeKind} id={current.id} />
        </>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <FileText className="h-5 w-5 text-primary" /> {title}
            </CardTitle>
            <CardDescription>{empty}</CardDescription>
          </CardHeader>
        </Card>
      )}
    </div>
  )
}

function ContractActions({
  contract,
  loans,
  installments,
  isPending,
  onAcceptContract,
  onWithdraw,
  onRefinance,
}: {
  contract: ContractLite
  loans: LoanLite[]
  installments: InstallmentLite[]
  isPending: boolean
  onAcceptContract: (contractId: string) => void
  onWithdraw: (loanId: string) => void
  onRefinance?: (loanId: string) => void
}) {
  const loan = contract.loan ?? loans.find((l) => l.id === contract.loanId)
  const withdraw = canWithdrawAcceptance({
    contractStatus: contract.status,
    acceptedAt: contract.acceptedAt,
    loanStatus: loan?.status,
    disbursedAt: loan?.disbursedAt,
  })
  const canRefi =
    onRefinance &&
    contract.status === 'accepted' &&
    evaluateRefinance(asMoraRows(installments.filter((row) => row.loanId === contract.loanId)), refinanceUsed(contract.signatureData)).ok
  return (
    <div className={cn('flex flex-wrap items-center gap-2 rounded-xl border bg-white px-4 py-3')}>
      <Badge
        variant={contract.status === 'accepted' ? 'default' : 'outline'}
        className={contract.status === 'accepted' ? 'bg-emerald-500 hover:bg-emerald-500' : ''}
      >
        {contract.status === 'accepted' ? 'Aceptado' : contract.status === 'pending_acceptance' ? 'Pendiente de firma' : contract.status}
      </Badge>
      {contract.status === 'pending_acceptance' ? (
        <Button type="button" size="sm" disabled={isPending} onClick={() => onAcceptContract(contract.id)}>
          Aceptar contrato y pagaré
        </Button>
      ) : null}
      {canRefi ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={isPending}
          onClick={() => {
            if (
              window.confirm(
                `¿Refinanciar el saldo en cuotas iguales? Quedan ${MAX_REFINANCES - refinanceUsed(contract.signatureData)} de ${MAX_REFINANCES}.`,
              )
            ) {
              onRefinance?.(contract.loanId)
            }
          }}
        >
          Refinanciar saldo
        </Button>
      ) : null}
      {withdraw ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={isPending}
          onClick={() => {
            if (
              window.confirm(
                `¿Arrepentirte de este crédito? Tenés ${WITHDRAWAL_DAYS} días corridos desde la firma. Solo si todavía no se acreditó.`,
              )
            ) {
              onWithdraw(contract.loanId)
            }
          }}
        >
          Arrepentirme ({WITHDRAWAL_DAYS} días)
        </Button>
      ) : null}
    </div>
  )
}
