'use client'

import type { ReactNode } from 'react'
import { AuthFloatLayout } from '@/components/auth/auth-float-layout'

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
