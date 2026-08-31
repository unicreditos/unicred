import { documentPrintPath } from '@/lib/documents/customer-view'
import Link from 'next/link'

export function DocumentPackLinks({
  contractId,
  receiptId,
  loanId,
  intimable = false,
}: {
  contractId?: string | null
  receiptId?: string | null
  loanId?: string | null
  intimable?: boolean
}) {
  const items = [
    contractId ? { href: documentPrintPath('contrato', contractId), label: 'Contrato' } : null,
    contractId ? { href: documentPrintPath('pagare', contractId), label: 'Pagaré' } : null,
    contractId ? { href: documentPrintPath('estado-deuda', contractId), label: 'Estado de deuda' } : null,
    loanId ? { href: documentPrintPath('talonario', loanId), label: 'Cuponera' } : null,
    contractId && intimable ? { href: documentPrintPath('intimacion', contractId), label: 'Intimación' } : null,
    loanId ? { href: documentPrintPath('solvencia', loanId), label: 'Solvencia' } : null,
    loanId ? { href: documentPrintPath('libre-deuda', loanId), label: 'Libre deuda' } : null,
    loanId ? { href: documentPrintPath('cancelacion', loanId), label: 'Cancelación' } : null,
    receiptId ? { href: documentPrintPath('recibo', receiptId), label: 'Recibo' } : null,
    receiptId ? { href: documentPrintPath('liquidacion', receiptId), label: 'Liquidación' } : null,
  ].filter(Boolean) as { href: string; label: string }[]

  if (!items.length) return null

  return (
    <nav className="hidden flex-wrap gap-1 text-[11px] sm:flex">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className="rounded border border-slate-300 bg-white px-2 py-1 font-medium text-slate-700 hover:border-slate-500"
        >
          {item.label}
        </Link>
      ))}
    </nav>
  )
}
