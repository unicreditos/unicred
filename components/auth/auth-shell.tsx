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
    <AuthFloatLayout headline={title} lede={description}>
      {children}
      {footer ? <div className="mt-6 text-sm text-brand-navy-600">{footer}</div> : null}
    </AuthFloatLayout>
  )
}
