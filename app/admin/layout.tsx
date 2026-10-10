import type { Metadata } from 'next'
import { Suspense } from 'react'
import '../uc.css'
import { UcShell } from '@/components/uc/shell'
import { loadDeskChrome } from '@/lib/admin-desk/load'
import { adminMenu } from '@/lib/uc/admin'
import { longDate } from '@/lib/uc/format'

export const metadata: Metadata = {
  title: { default: 'Backoffice', template: '%s · Backoffice Unicréditos' },
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { perms, operator, roleLabel } = await loadDeskChrome()

  return (
    <UcShell
      menu={adminMenu(perms)}
      area="Backoffice"
      today={longDate()}
      user={{ name: operator.name, detail: roleLabel, email: operator.email }}
      homeHref="/admin"
    >
      <Suspense fallback={<p className="uc-muted">Cargando…</p>}>{children}</Suspense>
    </UcShell>
  )
}
