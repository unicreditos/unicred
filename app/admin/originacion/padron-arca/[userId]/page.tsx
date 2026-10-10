import { ActionButton } from '@/components/admin/action-button'
import { BackLink, Card, CardHead, Callout, Kv, NoAccess, PageHead } from '@/components/uc/blocks'
import { auditAdminView, loadDeskChrome } from '@/lib/admin-desk/load'
import { arcaForUser } from '@/lib/admin-external'

export const metadata = { title: 'Constancia ARCA del cliente' }
export const dynamic = 'force-dynamic'

export default async function ArcaClientePage({ params }: { params: Promise<{ userId: string }> }) {
  const { perms, userId: actor } = await loadDeskChrome()
  const { userId } = await params
  const head = <PageHead title="Constancia ARCA del cliente" description="Datos del padrón ARCA guardados al momento del alta o de la última actualización." />
  if (!perms.has('kyc.review')) return <>{head}<NoAccess what="el padrón ARCA" /></>
  await auditAdminView(actor, 'padron_arca_cliente', userId)
  const { snapshot: s, manualReview } = await arcaForUser(userId).catch(() => ({ snapshot: null, manualReview: null, kycId: null, kycStatus: null }))
  return (
    <>
      <BackLink href="/admin/originacion/padron-arca">Volver al padrón</BackLink>
      {head}
      {manualReview ? (
        <Callout icon="shield" tone="warning" title="Revisión manual: el nombre no coincide">
          ARCA: {manualReview.arcaName} · Declarado: {manualReview.declaredName}. Un analista debe confirmar la identidad antes de aprobar.
        </Callout>
      ) : null}
      <Card>
        <CardHead title="Constancia" aside={<ActionButton url={`/api/admin/arca/${userId}`} label="Actualizar desde ARCA" confirm="Se consulta el padrón ARCA con el CUIL del cliente. ¿Continuar?" />} />
        {s ? (
          <Kv
            rows={[
              ['CUIL', s.cuil],
              ['Nombre / razón social', s.name],
              ['Tipo de persona', s.personType],
              ['Condición frente al IVA', s.taxConditionLabel],
              ['Categoría monotributo', s.monotributoCategory || '—'],
              ['Clave fiscal', s.taxStatus],
              ['Domicilio fiscal', [s.address, s.city, s.province, s.postalCode].filter(Boolean).join(', ') || '—'],
              ['Actividades', s.activities.map((a) => a.description).join(' · ') || '—'],
              ['Impuestos', s.taxes.map((t) => t.description).join(' · ') || '—'],
              ['Observaciones ARCA', s.constanciaErrors.join(' · ') || 'Sin observaciones'],
              ['Consultado', new Date(s.consultedAt).toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })],
            ]}
          />
        ) : (
          <p className="uc-muted" style={{ padding: 16 }}>Todavía no hay constancia ARCA guardada para este cliente.</p>
        )}
      </Card>
    </>
  )
}