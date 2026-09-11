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
    <div id="contenido-principal" className="relative flex min-h-svh flex-col overflow-hidden bg-[#F4F6F3]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 70% 50% at 10% -10%, rgba(32,189,90,0.12), transparent 55%), radial-gradient(ellipse 55% 40% at 100% 0%, rgba(12,22,18,0.06), transparent 50%), linear-gradient(180deg, #eef2ef 0%, #F4F6F3 38%, #F4F6F3 100%)',
        }}
      />
      <div
        aria-hidden
        className="auth-float-pattern pointer-events-none absolute inset-x-0 top-0 h-[42%] opacity-[0.04]"
      />

      <header className="relative z-10 flex items-center px-5 py-5 sm:px-10">
        <BrandLogo showText />
      </header>

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 pb-14 pt-2">
        {headline ? (
          <div className="mb-8 max-w-2xl text-center">
            <h1
              suppressHydrationWarning
              className="font-display text-3xl font-medium tracking-tight text-brand-navy-900 sm:text-4xl"
            >
              {headline}
            </h1>
            {lede ? (
              <p
                suppressHydrationWarning
                className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-brand-navy-600 sm:text-base"
              >
                {lede}
              </p>
            ) : null}
          </div>
        ) : null}

        <div
          className={cn(
            'w-full rounded-2xl border border-brand-navy-200/90 bg-white shadow-[0_24px_60px_rgba(12,22,18,0.10)]',
            size === 'sm' && 'max-w-[420px] p-8 sm:p-10',
            size === 'md' && 'max-w-lg p-8 sm:p-10',
            size === 'wide' && 'max-w-5xl p-6 sm:p-10',
            className,
          )}
        >
          {children}
        </div>

        <p className="mt-8 max-w-md text-center text-[11px] leading-relaxed text-brand-navy-400">
          {GROUP.productLine}. {groupOperatorLine()}
        </p>
      </div>
    </div>
  )
}
