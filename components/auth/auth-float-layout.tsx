'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { Guilloche } from '@/components/landing/guilloche'
import { BrandLogo } from '@/components/unicred/dashboard-kit'
import { groupOperatorLine } from '@/lib/brand'
import { PERSONAL_QUOTE } from '@/lib/loan-catalog'
import { cn } from '@/lib/utils'
import { Check } from 'lucide-react'

const PROMISES = [
  'TNA, TEA y CFT a la vista antes de firmar',
  'Sin punitorios, gastos de otorgamiento ni seguros',
  '10 días para arrepentirte, sin costo',
  'Contrato, pagaré y recibos siempre en tu panel',
] as const

/** Pantalla dividida: panel de marca a la izquierda, formulario a la derecha. */
export function AuthFloatLayout({
  children,
  headline,
  lede,
  size = 'sm',
  className,
}: {
  children: ReactNode
  headline?: string
  lede?: string
  size?: 'sm' | 'md' | 'wide'
  className?: string
}) {
  return (
    <div id="contenido-principal" className="grid min-h-svh bg-paper lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <aside className="relative hidden overflow-hidden bg-brand-navy-800 text-white lg:flex lg:flex-col lg:justify-between lg:p-12">
        <Guilloche className="absolute -bottom-80 -right-80 h-[52rem] w-[52rem]" petals={30} />
        <BrandLogo showText light className="relative" />

        <div className="relative max-w-md">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-brand-primary-300">
            Préstamo personal · referencia
          </p>
          <p className="mt-3 font-display text-6xl font-extrabold leading-none tracking-[-0.04em] text-signal-amber tabular-nums">
            CFT {PERSONAL_QUOTE.cftLabel}
          </p>
          <h2 className="mt-8 font-display text-[2.6rem] font-extrabold leading-[1.02] tracking-[-0.035em]">
            El costo completo, antes de firmar.
          </h2>
          <ul className="mt-8 space-y-3.5">
            {PROMISES.map((p) => (
              <li key={p} className="flex items-start gap-3 text-[15px] leading-snug text-white/80">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-primary-300 text-brand-navy-900">
                  <Check className="h-3 w-3" strokeWidth={3} aria-hidden />
                </span>
                {p}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative max-w-md text-xs leading-relaxed text-white/65">{groupOperatorLine()}</p>
      </aside>

      <div className="flex flex-col px-5 py-6 sm:px-10 lg:px-14 lg:py-10">
        <div className="flex items-center justify-between">
          <div className="lg:hidden">
            <BrandLogo showText />
          </div>
          <Link
            href="/"
            className="ml-auto text-sm font-medium text-brand-navy-500 transition hover:text-brand-navy-900"
          >
            Volver al inicio
          </Link>
        </div>

        <div className="flex flex-1 flex-col justify-center py-10">
          <div
            className={cn(
              'mx-auto w-full',
              size === 'sm' && 'max-w-[420px]',
              size === 'md' && 'max-w-lg',
              size === 'wide' && 'max-w-xl',
              className,
            )}
          >
            {headline ? (
              <div className="mb-8">
                <h1
                  suppressHydrationWarning
                  className="font-display text-4xl font-extrabold leading-[1.1] tracking-[-0.03em] text-brand-navy-900 sm:text-[2.75rem]"
                >
                  {headline}
                </h1>
                {lede ? (
                  <p
                    suppressHydrationWarning
                    className="mt-3 max-w-md text-base leading-relaxed text-brand-navy-600"
                  >
                    {lede}
                  </p>
                ) : null}
              </div>
            ) : null}
            {children}
          </div>
        </div>

        <p className="text-center text-xs leading-relaxed text-brand-navy-500 lg:hidden">{groupOperatorLine()}</p>
      </div>
    </div>
  )
}
