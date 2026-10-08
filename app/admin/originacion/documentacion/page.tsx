import { desc, eq, sql } from 'drizzle-orm'
import { DataGrid } from '@/components/uc/data-grid'
import { NoAccess, PageHead } from '@/components/uc/blocks'
import type { GridRow } from '@/components/uc/grid-types'
import { auditAdminView, loadDesk } from '@/lib/admin-desk/load'
import { db } from '@/lib/db'
import { kycVerification, user } from '@/lib/db/schema'
import { badge } from '@/lib/uc/admin'

export const metadata = { title: 'Documentación' }

const DOCS: Array<{ key: 'dniFrontImageUrl' | 'dniBackImageUrl' | 'selfieImageUrl' | 'videoUrl'; label: string }> = [
  { key: 'dniFrontImageUrl', label: 'DNI frente' },
  { key: 'dniBackImageUrl', label: 'DNI dorso' },
  { key: 'selfieImageUrl', label: 'Selfie con DNI' },
  { key: 'videoUrl', label: 'Video de prueba de vida' },
]

export default async function DocumentacionPage() {
  const { perms, userId } = await loadDesk()
  const head = <PageHead title="Documentación" description="Documentos de identidad que suben los solicitantes durante la validación." />
  if (!perms.has('kyc.review')) return <>{head}<NoAccess what="la documentación de los clientes" /></>
  await auditAdminView(userId, 'documentacion_kyc')

  // Esta pantalla lee solo lo suyo: no depende del resto del backoffice.
  const found = await db
    .select({
      id: kycVerification.id,
      status: kycVerification.status,
      updatedAt: kycVerification.updatedAt,
      reviewedAt: kycVerification.reviewedAt,
      // Solo "tiene / no tiene": las imágenes pueden pesar megas y acá no se muestran.
      dniFrontImageUrl: sql<boolean>`coalesce(length(${kycVerification.dniFrontImageUrl}), 0) > 0`,
      dniBackImageUrl: sql<boolean>`coalesce(length(${kycVerification.dniBackImageUrl}), 0) > 0`,
      selfieImageUrl: sql<boolean>`coalesce(length(${kycVerification.selfieImageUrl}), 0) > 0`,
      videoUrl: sql<boolean>`coalesce(length(${kycVerification.videoUrl}), 0) > 0`,
      name: user.name,
      email: user.email,
    })
    .from(kycVerification)
    .leftJoin(user, eq(user.id, kycVerification.userId))
    .orderBy(desc(kycVerification.updatedAt))
    .limit(300)
    .catch(() => [])

  const rows: GridRow[] = found.flatMap((k) =>
    DOCS.filter((d) => Boolean(k[d.key])).map((d) => {
      const approved = k.status === 'approved' || k.status === 'verified'
      const rejected = k.status === 'rejected'
      return {
        id: `${k.id}-${d.key}`,
        cliente: { a: k.name || k.email || 'Cliente', b: k.email || undefined },
        q: `${k.name ?? ''} ${k.email ?? ''}`,
        tipo: d.label,
        estadoKey: approved ? 'Aprobado' : rejected ? 'Observado' : 'Pendiente',
        estado: approved ? badge('Aprobado', 'success') : rejected ? badge('Rechazado', 'danger') : badge('Pendiente', 'neutral'),
        subido: k.updatedAt ? new Date(k.updatedAt).toISOString() : null,
        reviso: k.reviewedAt ? new Date(k.reviewedAt).toISOString() : null,
      }
    }),
  )

  return (
    <>
      {head}
      <DataGrid
        cfg={{
          id: 'docs',
          rows,
          pageSize: 15,
          sort: { key: 'subido', dir: -1 },
          dateKey: 'subido',
          dateLabel: 'Subido',
          searchKeys: ['q'],
          searchPlaceholder: 'Nombre o email',
          chips: {
            label: 'Estado',
            key: 'estadoKey',
            options: [
              { v: 'all', l: 'Todos' },
              { v: 'Pendiente', l: 'Pendientes' },
              { v: 'Aprobado', l: 'Aprobados' },
              { v: 'Observado', l: 'Rechazados' },
            ],
          },
          selects: [{ key: 'tipo', label: 'Tipo de documento', all: 'Tipo: todos', options: DOCS.map((d) => d.label) }],
          columns: [
            { key: 'cliente', label: 'Cliente', kind: 'stack' },
            { key: 'tipo', label: 'Documento' },
            { key: 'estado', label: 'Estado', kind: 'badge', order: ['Pendiente', 'Aprobado', 'Rechazado'] },
            { key: 'subido', label: 'Subido', kind: 'date' },
            { key: 'reviso', label: 'Revisado', kind: 'date' },
          ],
          summary: { noun: 'documentos' },
        }}
      />
    </>
  )
}
