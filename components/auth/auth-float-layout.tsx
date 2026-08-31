'use client'

import type { ReactNode } from 'react'
import { BrandLogo } from '@/components/unicred/dashboard-kit'
import { GROUP, groupOperatorLine } from '@/lib/brand'
import { cn } from '@/lib/utils'

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
    <div id="contenido-principal" className="relative flex min-h-svh flex-col bg-[#F3F5F4]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-[10%] h-[48%] overflow-hidden"
      >
        <div className="auth-float-pattern absolute inset-0 opacity-[0.055]" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#F3F5F4] via-transparent to-[#F3F5F4]" />
      </div>
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[38%] h-[28rem] w-[46rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#20BD5A]/[0.06] blur-3xl"
      />

      <header className="relative z-10 flex items-center px-5 py-5 sm:px-10">
        <BrandLogo showText />
      </header>

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 pb-14 pt-2">
        {headline ? (
          <div className="mb-8 max-w-2xl text-center">
            <h1
              suppressHydrationWarning
              className="text-3xl font-semibold tracking-tight text-brand-navy-800 sm:text-4xl"
            >
              {headline}
            </h1>
            {lede ? (
              <p
                suppressHydrationWarning
                className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base"
              >
                {lede}
              </p>
            ) : null}
          </div>
        ) : null}

        <div
          className={cn(
            'w-full rounded-xl border border-slate-200/90 bg-white shadow-[0_18px_50px_rgba(12,22,18,0.10)]',
            size === 'sm' && 'max-w-[420px] p-8 sm:p-10',
            size === 'md' && 'max-w-lg p-8 sm:p-10',
            size === 'wide' && 'max-w-5xl p-6 sm:p-10',
            className,
          )}
        >
          {children}
        </div>

        <p className="mt-8 max-w-md text-center text-[11px] leading-relaxed text-slate-400">
          {GROUP.productLine}. {groupOperatorLine()}
        </p>
      </div>
    </div>
  )
}
