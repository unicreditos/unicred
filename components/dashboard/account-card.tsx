import Link from 'next/link'
import { ArrowRightLeft, Banknote, QrCode, ScanLine } from 'lucide-react'
import { PrivacyToggle, PrivateText } from '@/components/dashboard/private-amount'
import { CopyButton } from '@/components/wallet/copy-button'
import { formatCbu } from '@/lib/format'
import { formatMoney } from '@/lib/money'
import { cn } from '@/lib/utils'

const action =
  'inline-flex h-10 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3 text-[13px] font-medium @2xl:gap-2 @2xl:px-4 @2xl:text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-white/70 [&_svg]:size-4'

/** Tarjeta principal del tablero: saldo disponible, datos para recibir dinero y las operaciones más usadas. */
export function AccountCard({
  balance,
  held,
  alias,
  cvu,
  holder,
  active,
  canOperate,
}: {
  balance: string
  held: string
  alias: string
  cvu: string
  holder: string | null
  active: boolean
  canOperate: boolean
}) {
  const updatedAt = new Intl.DateTimeFormat('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date())
  return (
    <section
      aria-label="Cuenta en pesos"
      className="@container relative isolate overflow-hidden rounded-2xl p-6 text-white shadow-card sm:p-8"
      style={{ backgroundImage: 'linear-gradient(135deg, #1a2358 0%, #101637 55%, #0a0e26 100%)' }}
    >
      <svg aria-hidden="true" className="pointer-events-none absolute -right-16 -top-20 -z-10 size-[26rem] opacity-[0.07]" viewBox="0 0 200 200" fill="none" stroke="white">
        {[30, 48, 66, 84, 102].map((r) => (
          <circle key={r} cx="100" cy="100" r={r} strokeWidth="1" />
        ))}
      </svg>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="flex items-center gap-1 text-sm font-medium text-white/75">
            Cuenta en pesos · ARS
            <PrivacyToggle />
          </p>
          <p className="tnum mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">
            <PrivateText text={formatMoney(balance)} />
          </p>
          <p className="mt-2 text-[13px] text-white/70">
            {Number(held) > 0 ? (
              <>
                <PrivateText text={formatMoney(held)} /> retenidos en retiros pendientes ·{' '}
              </>
            ) : null}
            Saldo disponible para operar
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <span className={cn('inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium', active ? 'bg-white/12 text-white' : 'bg-red-500/25 text-white')}>
          <span className={cn('size-1.5 rounded-full', active ? 'bg-emerald-400' : 'bg-red-400')} aria-hidden="true" />
          {active ? 'Cuenta activa' : 'Cuenta bloqueada'}
        </span>
          <span className="text-xs text-white/60">Actualizado a las {updatedAt}</span>
        </div>
      </div>

      <dl className="mt-8 grid gap-x-8 gap-y-4 @lg:grid-cols-2">
        <div>
          <dt className="text-xs font-medium uppercase tracking-wider text-white/60">Alias</dt>
          <dd className="mt-1 flex items-center gap-1 text-[15px] font-medium">
            <span className="tnum truncate">{alias}</span>
            <CopyButton value={alias} label="el alias" className="text-white/70 hover:bg-white/10 hover:text-white" />
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wider text-white/60">CVU interno{holder ? ` · ${holder}` : ''}</dt>
          <dd className="mt-1 flex items-center gap-1 text-[15px] font-medium">
            <span className="tnum truncate">{formatCbu(cvu)}</span>
            <CopyButton value={cvu} label="el CVU" className="text-white/70 hover:bg-white/10 hover:text-white" />
          </dd>
        </div>
      </dl>

      <div className="mt-7 grid grid-cols-2 gap-2 @2xl:flex @2xl:flex-wrap">
        {canOperate ? (
          <Link href="/dashboard/billetera/transferir" className={cn(action, 'bg-white text-[#0f1530] hover:bg-white/90')}>
            <ArrowRightLeft aria-hidden="true" />
            Transferir
          </Link>
        ) : (
          <Link href="/dashboard/perfil/identidad" className={cn(action, 'bg-white text-[#0f1530] hover:bg-white/90')}>
            Verificar identidad para operar
          </Link>
        )}
        <Link href="/dashboard/billetera/qr" className={cn(action, 'bg-white/12 text-white hover:bg-white/20')}>
          <QrCode aria-hidden="true" />
          Cobrar con QR
        </Link>
        <Link href="/dashboard/billetera/pagar" className={cn(action, 'bg-white/12 text-white hover:bg-white/20')}>
          <ScanLine aria-hidden="true" />
          Pagar con QR
        </Link>
        <Link href="/dashboard/billetera/retirar" className={cn(action, 'bg-white/12 text-white hover:bg-white/20')}>
          <Banknote aria-hidden="true" />
          Retirar
        </Link>
      </div>
    </section>
  )
}
