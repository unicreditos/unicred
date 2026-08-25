import Link from 'next/link'
import type { ReactNode } from 'react'
import { Card } from '@/components/ui/card'
import { BrandLogo } from '@/components/unicred/dashboard-kit'

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
    <main className="flex min-h-svh items-center justify-center px-4 py-10">
      <Card className="w-full max-w-sm border-border p-6">
        <Link href="/" className="mb-6 inline-flex">
          <BrandLogo showText />
        </Link>
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
        {children}
        {footer ? <div className="mt-6 text-center text-sm text-muted-foreground">{footer}</div> : null}
      </Card>
    </main>
  )
}
