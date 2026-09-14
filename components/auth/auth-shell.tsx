'use client'

import type { ReactNode } from 'react'
import { AuthFloatLayout } from '@/components/auth/auth-float-layout'
import { cn } from '@/lib/utils'

export function AuthAlert({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      role="alert"
      className={cn(
        'rounded-xl border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm leading-relaxed text-destructive',
        className,
      )}
    >
      {children}
    </div>
  )
}

export function AuthNotice({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'rounded-xl border border-border bg-muted/50 px-4 py-3 text-sm leading-relaxed text-brand-navy-700',
        className,
      )}
    >
      {children}
    </div>
  )
}

export function AuthShell({
  title,
  description,
  children,
  footer,
}: {
  title: string
  description: string
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <AuthFloatLayout>
      <div className="mb-7 text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-brand-navy-800">{title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>
      </div>
      {children}
      {footer ? <div className="mt-6 text-center text-sm text-muted-foreground">{footer}</div> : null}
    </AuthFloatLayout>
  )
}
