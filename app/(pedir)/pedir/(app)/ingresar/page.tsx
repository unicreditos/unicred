import { PedirAuthPanel } from '@/components/pedir/auth-panel'
import { BRAND } from '@/lib/brand'
import { getSession } from '@/lib/session'
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'

export const metadata: Metadata = {
  title: `Ingresar · ${BRAND.company}`,
  description: 'Ingresá o creá tu cuenta para pedir y gestionar tu préstamo personal.',
  alternates: { canonical: '/pedir/ingresar' },
}

export const dynamic = 'force-dynamic'

async function AuthGate({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>
}) {
  const session = await getSession()
  const { callbackUrl } = await searchParams
  if (session?.user?.id) {
    const dest =
      callbackUrl && callbackUrl.startsWith('/pedir') && !callbackUrl.startsWith('//')
        ? callbackUrl
        : '/pedir/cuenta'
    redirect(dest)
  }
  return <PedirAuthPanel mode="sign-in" />
}

export default function PedirIngresarPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>
}) {
  return (
    <Suspense
      fallback={
        <div className="lp-container py-32 text-center text-sm text-[var(--lp-muted)]">Cargando…</div>
      }
    >
      <AuthGate searchParams={searchParams} />
    </Suspense>
  )
}
