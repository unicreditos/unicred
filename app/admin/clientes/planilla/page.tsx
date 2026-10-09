import { DataGrid } from '@/components/uc/data-grid'
import { NoAccess, PageHead } from '@/components/uc/blocks'
import type { GridRow } from '@/components/uc/grid-types'
import { auditAdminView, loadDesk } from '@/lib/admin-desk/load'
import { badge, fmtDni, fullName, KYC_LABEL, kycBadge } from '@/lib/uc/admin'
import { ExportClientsButton } from '@/components/admin/clients/export-clients-button'
import { PrintButton } from '@/components/uc/print-button'

export const metadata = { title: 'Clientes · Planilla y Exportación Excel' }

export default async function ClientesPage() {
  const { state, perms, userId } = await loadDesk()
  if (!perms.has('clients.read')) return <><PageHead title="Clientes" description="Planilla de clientes." /><NoAccess what="los clientes" /></>
  await auditAdminView(userId, 'listado_clientes')

  const active = new Map<string, number>()
  const late = new Set<string>()
  for (const c of state.credits) {
    if (c.status !== 'active') continue
    active.set(c.clientId, (active.get(c.clientId) ?? 0) + 1)
    if (c.bucket !== 'al_dia') late.add(c.clientId)
  }

  const rows: GridRow[] = state.clients.map((c) => {
    const n = active.get(c.id) ?? 0
    const situ = n === 0 ? 'Sin créditos' : late.has(c.id) ? 'Con mora' : 'Al día'
    return {
      id: c.id,
      dni: { text: fmtDni(c.dni) || '—', href: `/admin/clientes/${encodeURIComponent(c.id)}` },
      dniRaw: c.dni,
      nombre: fullName(c),
      email: c.email,
      tel: c.phone,
      provincia: c.address.province || '—',
      activos: n,
      situKey: situ,
      situ: situ === 'Con mora' ? badge('Con mora', 'warning') : situ === 'Al día' ? badge('Al día', 'success') : badge('Sin créditos', 'neutral'),
      kyc: kycBadge(c.kycStatus),
      kycTxt: KYC_LABEL[c.kycStatus] ?? c.kycStatus,
      alta: c.createdAt,
      ver: [{ kind: 'link', label: 'Ver legajo', href: `/admin/clientes/${encodeURIComponent(c.id)}` }],
    }
  })

  const head = (
    <PageHead
      title="Clientes"
      description="Planilla de clientes. Filtrá por situación, identidad o provincia; se ven 15 por página."
      actions={
        <div className="flex items-center gap-2">
          <PrintButton label="Print" title="Imprimir reporte de clientes" variant="secondary" />
          <ExportClientsButton rows={rows} />
        </div>
      }
    />
  )

  return (
    <>
      {head}
      <DataGrid
        cfg={{
          id: 'clientes',
          rows,
          sheet: true,
          exportExcel: {
            filename: 'Planilla_Clientes_Unicred.xlsx',
            label: 'Export to Excel',
            sheetName: 'Clientes',
          },
          printable: {
            label: 'Print',
            title: 'Imprimir listado filtrado de clientes',
          },
          pageSize: 15,
          sort: { key: 'nombre', dir: 1 },
          dateKey: 'alta',
          dateLabel: 'Alta',
          searchKeys: ['nombre', 'dniRaw', 'email', 'tel'],
          searchPlaceholder: 'Nombre, DNI, email o teléfono',
          chips: {
            label: 'Situación de pago',
            key: 'situKey',
            options: [
              { v: 'all', l: 'Todos' },
              { v: 'Al día', l: 'Al día' },
              { v: 'Con mora', l: 'Con mora' },
            ],
          },
          selects: [
            { key: 'provincia', label: 'Provincia', all: 'Provincia: todas' },
            { key: 'kycTxt', label: 'Estado de identidad', all: 'Identidad: todas', options: ['Verificado', 'Pendiente', 'En revisión', 'Rechazado'] },
          ],
          columns: [
            { key: 'dni', label: 'DNI', kind: 'link' },
            { key: 'nombre', label: 'Nombre' },
            { key: 'email', label: 'Email', muted: true },
            { key: 'tel', label: 'Teléfono', kind: 'num' },
            { key: 'provincia', label: 'Provincia' },
            { key: 'activos', label: 'Créd. activos', kind: 'num', align: 'r' },
            { key: 'situ', label: 'Situación', kind: 'badge', order: ['Sin créditos', 'Al día', 'Con mora'] },
            { key: 'kyc', label: 'Identidad', kind: 'badge', order: ['Verificado', 'Pendiente', 'En revisión', 'Rechazado'] },
            { key: 'alta', label: 'Alta', kind: 'date' },
            { key: 'ver', label: 'Acción', kind: 'actions', align: 'r' },
          ],
          summary: { noun: 'clientes' },
        }}
      />
    </>
  )
}
