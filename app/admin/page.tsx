import { requireAdmin } from '@/lib/session'

/**
 * El panel de administración (rutas + componentes en app/admin/** y
 * components/admin/**) se reemplazó por unicreditos-admin, una app Next.js
 * aparte conectada a GET/POST /api/admin/desk. Esta página solo redirige a
 * los operadores que todavía llegan acá (links viejos, favoritos, el inbox
 * interno que arma /admin?tab=... en lib/notifications.ts).
 */
export default async function AdminMovedPage() {
  await requireAdmin()
  const adminAppUrl = process.env.NEXT_PUBLIC_ADMIN_APP_URL || ''

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-lg font-semibold text-slate-900">El backoffice se mudó</h1>
        <p className="mt-2 text-sm text-slate-600">
          Este panel ya no vive acá. Ahora es una app aparte (
          <code className="rounded bg-slate-100 px-1 py-0.5 text-[13px]">unicreditos-admin</code>
          ), conectada a los mismos datos.
        </p>
        {adminAppUrl ? (
          <a
            href={adminAppUrl}
            className="mt-6 inline-flex w-full items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            Ir al backoffice
          </a>
        ) : (
          <div className="mt-6 rounded-lg bg-slate-50 p-4 text-left text-[13px] text-slate-600">
            <p className="font-medium text-slate-800">No hay URL configurada todavía.</p>
            <p className="mt-1">
              En desarrollo, corré <code className="rounded bg-slate-100 px-1">unicreditos-admin</code> aparte:
            </p>
            <pre className="mt-2 overflow-x-auto rounded bg-slate-900 px-3 py-2 text-[12px] text-slate-100">
              cd unicreditos-admin{'\n'}npm run dev
            </pre>
            <p className="mt-2">
              Y abrí <code className="rounded bg-slate-100 px-1">http://localhost:43123</code>. En producción, definí{' '}
              <code className="rounded bg-slate-100 px-1">NEXT_PUBLIC_ADMIN_APP_URL</code> con la URL donde quede
              desplegado.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
