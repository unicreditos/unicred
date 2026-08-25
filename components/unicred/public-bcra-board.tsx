import { getPublicMarketBoardCached, type PublicMarketBoard } from '@/lib/bcra-market'
import { Landmark } from 'lucide-react'
import Link from 'next/link'

const BCRA_API = 'https://www.bcra.gob.ar/apis-banco-central/'

async function loadBoard(): Promise<PublicMarketBoard | null> {
  try {
    return await getPublicMarketBoardCached()
  } catch (err) {
    console.warn('[public-bcra]', (err as Error).message)
    return null
  }
}

function formatFx(value: number) {
  const digits = value >= 100 ? 2 : value >= 1 ? 2 : 4
  return value.toLocaleString('es-AR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: 4,
  })
}

function formatIndicator(value: number) {
  return value.toLocaleString('es-AR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })
}

function formatFecha(value: string | null) {
  if (!value) return null
  const iso = value.includes('T') ? value : `${value}T12:00:00`
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function publicationDate(board: PublicMarketBoard) {
  return board.fx.find((row) => row.fecha)?.fecha ?? board.indicators.find((row) => row.fecha)?.fecha ?? null
}

export async function PublicBcraTicker() {
  const board = await loadBoard()
  if (!board?.fx.length) return null
  const fecha = formatFecha(publicationDate(board))
  const top = board.fx.slice(0, 6)

  return (
    <div className="border-b border-white/10 bg-brand-navy-800 text-white">
      <div className="mx-auto flex w-full max-w-7xl items-center gap-4 overflow-x-auto px-4 py-1.5 sm:px-6">
        <Link
          href="/datos-bcra"
          className="inline-flex shrink-0 items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-brand-cian-300 hover:text-white"
        >
          <Landmark className="h-3.5 w-3.5" />
          BCRA oficial
        </Link>
        <div className="flex min-w-0 flex-1 items-center gap-4 text-[12px] font-semibold tabular-nums">
          {top.map((row) => (
            <span key={row.moneda} className="inline-flex shrink-0 items-baseline gap-1.5">
              <span className="text-brand-cian-200">{row.moneda}</span>
              <span className="text-white">{formatFx(row.valor)}</span>
            </span>
          ))}
        </div>
        <p className="hidden shrink-0 text-[11px] font-medium text-slate-300/80 lg:block">
          Referencia{fecha ? ` · ${fecha}` : ''} · no es oferta de cambio
        </p>
      </div>
    </div>
  )
}

export async function PublicBcraBoard({
  compact = false,
  showEmpty = false,
}: {
  compact?: boolean
  showEmpty?: boolean
}) {
  const board = await loadBoard()
  if (!board?.fx.length) {
    if (!showEmpty) return null
    return (
      <div className="rounded-2xl border border-border/60 bg-slate-50/70 p-5 text-sm text-muted-foreground">
        El BCRA no respondió en este momento. Los datos oficiales se reintentan solos en la próxima consulta.
      </div>
    )
  }

  const fecha = formatFecha(publicationDate(board))
  const fx = compact ? board.fx.slice(0, 6) : board.fx.slice(0, 12)
  const indicators = compact ? board.indicators.slice(0, 4) : board.indicators.slice(0, 8)

  return (
    <div className="overflow-hidden rounded-3xl border border-border/60 bg-white shadow-sm ring-1 ring-slate-900/5">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/60 bg-slate-50/70 px-5 py-4 sm:px-6">
        <div>
          <p className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-brand-primary">
            <Landmark className="h-3.5 w-3.5" />
            Dato oficial BCRA
          </p>
          <h2 className="mt-1 text-lg font-black tracking-tight text-brand-navy sm:text-xl">
            Tipo de cambio de referencia
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Último valor publicado por el Banco Central. UNICRÉDITOS no es entidad de cambio ni cotiza compra o venta
            de divisas.
          </p>
        </div>
        <div className="text-right text-[11px] font-semibold text-muted-foreground">
          {fecha ? <p>Publicado {fecha}</p> : null}
          <p>API oficial · se refresca cada 15 min</p>
          {board.source === 'db_cache' ? <p>Último valor en caché local</p> : null}
        </div>
      </div>

      <div className={`grid gap-3 p-5 sm:p-6 ${compact ? 'sm:grid-cols-3 lg:grid-cols-6' : 'sm:grid-cols-3 lg:grid-cols-4'}`}>
        {fx.map((row) => (
          <div
            key={row.moneda}
            className="rounded-2xl border border-border/60 bg-slate-50/50 px-4 py-3 ring-1 ring-slate-900/4"
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-brand-primary">{row.moneda}</span>
              <span className="text-[10px] font-medium text-muted-foreground">ARS</span>
            </div>
            <p className="mt-1 text-xl font-black tabular-nums tracking-tight text-brand-navy">
              {formatFx(row.valor)}
            </p>
            <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">{row.descripcion}</p>
          </div>
        ))}
      </div>

      {indicators.length ? (
        <div className="border-t border-border/60 px-5 py-4 sm:px-6">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Variables principales
          </p>
          <div className={`mt-3 grid gap-3 ${compact ? 'md:grid-cols-2' : 'md:grid-cols-2 lg:grid-cols-4'}`}>
            {indicators.map((row) => (
              <div key={row.id} className="rounded-xl border border-border/50 px-3 py-2.5">
                <p className="line-clamp-2 text-[11px] font-medium leading-snug text-muted-foreground">{row.nombre}</p>
                <p className="mt-1 text-sm font-black tabular-nums text-brand-navy">
                  {formatIndicator(row.valor)}
                  {row.unidad ? <span className="ml-1 text-[10px] font-semibold text-muted-foreground">{row.unidad}</span> : null}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 bg-slate-50/50 px-5 py-3 text-[11px] leading-relaxed text-muted-foreground sm:px-6">
        <p>
          Fuente:{' '}
          <a href={BCRA_API} target="_blank" rel="noreferrer" className="font-semibold text-brand-primary hover:underline">
            api.bcra.gob.ar
          </a>
          . No constituye oferta, cotización propia ni invitación a operar cambio.
        </p>
        {compact ? (
          <Link href="/datos-bcra" className="font-semibold text-brand-primary hover:underline">
            Ver tablero completo
          </Link>
        ) : null}
      </div>
    </div>
  )
}
