import { BRAND, legalCuitLabel, publicBrandWebsite } from '@/lib/brand'
import { docDateTime } from '@/lib/document-format'
import { formatARSDecimal } from '@/lib/finance'
import { CheckCircle2 } from 'lucide-react'

/**
 * Ticket de pago de servicios — modelo del PDF de muestra
 * (¡Pago exitoso! / Operación / Empresa / Cuenta / Importe / Fecha / Código).
 * No usa el membrete legal de cuotas.
 */
export function ServicePaymentTicketPrintable({
  receipt,
}: {
  receipt: {
    id: string
    receiptNumber: string
    receiptType?: string
    issuedAt: Date | string
    paidAt?: Date | string | null
    amount: string | number
    currency?: string
    referenceNumber?: string | null
    newBalance?: string | number | null
    loanSnapshot?: Record<string, unknown> | null
    branding?: { company?: string; cuit?: string | null } | null
  }
}) {
  const snap = receipt.loanSnapshot ?? {}
  const operation = String(snap.operationId ?? receipt.referenceNumber ?? receipt.receiptNumber)
  const empresa = String(snap.providerName ?? '—')
  const cuenta = String(snap.accountRef ?? '—')
  const auth = String(snap.authCode ?? '—')
  const company = receipt.branding?.company ?? BRAND.company
  const cuit = receipt.branding?.cuit ?? legalCuitLabel()

  return (
    <article className="service-ticket print-page mx-auto w-full max-w-[420px] bg-white text-slate-900">
      <header className="border-b border-slate-200 px-5 py-4 text-center">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-700">
          {company}
        </p>
        <p className="mt-1 text-sm font-semibold text-slate-800">Pagar servicios</p>
        <p className="mt-0.5 text-[11px] text-slate-500">{publicBrandWebsite()}</p>
      </header>

      <div className="px-5 py-6">
        <div className="rounded-2xl border-2 border-emerald-400/80 bg-white px-5 py-6 shadow-sm">
          <div className="flex flex-col items-center text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 text-white">
              <CheckCircle2 className="h-8 w-8" strokeWidth={2.5} />
            </span>
            <h1 className="mt-4 text-[22px] font-bold tracking-tight text-slate-900">
              ¡Pago exitoso!
            </h1>
            <p className="mt-1 text-sm text-slate-500">Tu pago fue procesado correctamente</p>
          </div>

          <dl className="mt-6 space-y-0 border-t border-slate-100 pt-2">
            <TicketRow label="Operación" value={operation} mono />
            <TicketRow label="Empresa" value={empresa} />
            <TicketRow label="Cuenta" value={cuenta} mono />
            <TicketRow
              label="Importe"
              value={formatARSDecimal(receipt.amount)}
              strong
              accent
            />
            <TicketRow label="Fecha" value={docDateTime(receipt.paidAt ?? receipt.issuedAt)} />
            <TicketRow label="Código de autorización" value={auth} mono accentBlue />
          </dl>
        </div>

        {receipt.newBalance != null && receipt.newBalance !== '' ? (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
              Saldo disponible
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums tracking-tight text-slate-900">
              {formatARSDecimal(receipt.newBalance)}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">ARS · Pesos argentinos</p>
          </div>
        ) : null}
      </div>

      <footer className="border-t border-slate-200 px-5 py-4 text-center text-[10px] leading-relaxed text-slate-500">
        <p className="font-semibold text-slate-700">
          Comprobante {receipt.receiptNumber}
        </p>
        <p className="mt-1">
          {company} · CUIT {cuit}
        </p>
        <p className="mt-1">
          Débito en billetera UNICRÉDITOS. Liquidación al prestador vía tesorería RM.
        </p>
        <p className="mt-2 font-mono text-[9px] text-slate-400">{receipt.id}</p>
      </footer>
    </article>
  )
}

function TicketRow({
  label,
  value,
  mono,
  strong,
  accent,
  accentBlue,
}: {
  label: string
  value: string
  mono?: boolean
  strong?: boolean
  accent?: boolean
  accentBlue?: boolean
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-slate-100 py-2.5 last:border-0">
      <dt className="shrink-0 text-[13px] text-slate-500">{label}</dt>
      <dd
        className={[
          'text-right text-[13px] tabular-nums',
          mono ? 'font-mono' : '',
          strong ? 'text-base font-bold' : 'font-semibold',
          accent ? 'text-emerald-600' : accentBlue ? 'text-sky-600' : 'text-slate-900',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {value}
      </dd>
    </div>
  )
}
