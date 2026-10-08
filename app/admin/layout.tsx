import type { Metadata } from 'next'
import '../uc.css'
import { Callout } from '@/components/uc/blocks'
import { UcShell } from '@/components/uc/shell'
import { loadDesk } from '@/lib/admin-desk/load'
import { adminMenu } from '@/lib/uc/admin'
import { longDate } from '@/lib/uc/format'

export const metadata: Metadata = {
  title: { default: 'Backoffice', template: '%s · Backoffice Unicréditos' },
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

const ROLE: Record<string, string> = {
  director: 'Director',
  originacion: 'Originación',
  tesoreria: 'Tesorería',
  riesgo: 'Riesgo',
  soporte: 'Soporte',
  auditor: 'Auditoría',
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { state, perms, operator, userId, degraded, buildError } = await loadDesk()
  const me = state.operators.find((o) => o.id === userId)

  return (
    <>
      <UcShell
        menu={adminMenu(perms)}
        area="Backoffice"
        today={longDate()}
        user={{ name: operator.name, detail: me ? (ROLE[me.role] ?? 'Operador') : 'Operador', email: operator.email }}
        homeHref="/admin"
      >
        {degraded ? (
          <div style={{ marginBottom: 20 }}>
            <Callout icon="alert" title="Datos incompletos" tone="warning">
              No se pudo armar el estado completo del backoffice
              {buildError ? ` (${buildError.slice(0, 140)})` : ''}. Lo que ves puede estar vacío o desactualizado.
            </Callout>
          </div>
        ) : null}
        {children}
      </UcShell>
    </>
  )
}
