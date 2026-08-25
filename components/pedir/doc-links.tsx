import Link from 'next/link'

export function PedirDocLinks({
  contractId,
  loanId,
}: {
  contractId?: string | null
  loanId?: string | null
}) {
  const items = [
    contractId ? { href: `/pedir/docs/contrato/${contractId}`, label: 'Contrato' } : null,
    contractId ? { href: `/pedir/docs/pagare/${contractId}`, label: 'Pagaré' } : null,
    loanId ? { href: `/pedir/docs/cuponera/${loanId}`, label: 'Cuponera' } : null,
  ].filter(Boolean) as { href: string; label: string }[]

  if (!items.length) return null

  return (
    <nav className="flex flex-wrap gap-1 text-[11px]">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className="rounded-full border border-[var(--lp-line)] bg-[var(--lp-paper)] px-2.5 py-1 font-semibold text-[var(--lp-ink)] hover:border-[var(--lp-ink)]/35"
        >
          {item.label}
        </Link>
      ))}
    </nav>
  )
}
