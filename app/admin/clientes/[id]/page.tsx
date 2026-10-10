import { notFound } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { DataGrid } from '@/components/uc/data-grid'
import { BackLink, Badge, ButtonLink, Grid, Kv, NoAccess, PageHead, Pad, CardHead, SectionTitle } from '@/components/uc/blocks'
import { ClientDocumentViewer } from '@/components/admin/client-document-viewer'
import type { GridRow } from '@/components/uc/grid-types'
import { auditAdminView, loadDesk } from '@/lib/admin-desk/load'
import { badge, bcraByClient, fmtDni, fullName, KYC_LABEL, KYC_TONE } from '@/lib/uc/admin'
import { fdate, money } from '@/lib/uc/format'
import { db } from '@/lib/db'
import { kycVerification } from '@/lib/db/schema'

export const metadata = { title: 'Cliente' }

const APP = { pending: ['En revisión', 'warning'], approved: ['Aprobada', 'success'], rejected: ['Rechazada', 'danger'], cancelled: ['Anulada', 'neutral'] } as const
const PAY = { pending: ['Pendiente', 'info'], matched: ['Acreditado', 'success'], reconciled: ['Acreditado', 'success'], rejected: ['Rechazado', 'danger'], refunded: ['Reintegrado', 'neutral'] } as const

export default async function ClienteDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { state, perms, userId } = await loadDesk()
  if (!perms.has('clients.read')) return <NoAccess what="los clientes" />
  await auditAdminView(userId, 'cliente', id)

  const client = state.clients.find((c) => c.id === id)
  if (!client) notFound()

  const [media] = await db
    .select({
      dniFrontImageUrl: kycVerification.dniFrontImageUrl,
      dniBackImageUrl: kycVerification.dniBackImageUrl,
      selfieImageUrl: kycVerification.selfieImageUrl,
      videoUrl: kycVerification.videoUrl,
      faceMatchScore: kycVerification.faceMatchScore,
    })
    .from(kycVerification)
    .where(eq(kycVerification.userId, id))
    .limit(1)
  const mediaHref = (kind: 'front' | 'back' | 'selfie' | 'video', stored: string | null | undefined) =>
    stored ? `/api/admin/kyc-media/${encodeURIComponent(id)}/${kind}` : null
  const documents = {
    ...client.documents,
    dniFrontUrl: mediaHref('front', media?.dniFrontImageUrl),
    dniBackUrl: mediaHref('back', media?.dniBackImageUrl),
    selfieUrl: mediaHref('selfie', media?.selfieImageUrl),
    videoUrl: mediaHref('video', media?.videoUrl),
  }
  const faceMatch = media?.faceMatchScore == null ? client.faceMatchScore : Number(media.faceMatchScore)

  const name = fullName(client)
  const bcra = bcraByClient(state).get(id)
  const apps: GridRow[] = state.applications
    .filter((a) => a.clientId === id)
    .map((a) => ({
      id: a.id,
      fecha: a.createdAt,
      importe: a.amount,
      cuotas: a.installments,
      estado: badge(APP[a.status][0], APP[a.status][1]),
      ver: [{ kind: 'link', label: 'Abrir', href: `/admin/originacion/solicitudes/${encodeURIComponent(a.id)}` }],
    }))
  const credits: GridRow[] = state.credits
    .filter((c) => c.clientId === id)
    .map((c) => ({
      id: c.id,
      nro: `…${c.id.slice(-8)}`,
      importe: c.amount,
      saldo: c.principalOutstanding,
      estado: c.status === 'active' ? (c.bucket === 'al_dia' ? badge('Vigente', 'success') : badge(`Demorado · ${c.daysPastDue} d`, 'warning')) : badge(c.status === 'paid' ? 'Cancelado' : 'Aprobado', 'neutral'),
      ver: [{ kind: 'link', label: 'Abrir', href: `/admin/creditos/otorgados/${encodeURIComponent(c.id)}` }],
    }))
  const payments: GridRow[] = state.payments
    .filter((p) => p.clientId === id)
    .slice(0, 15)
    .map((p) => ({
      id: p.id,
      fecha: p.paidAt,
      importe: p.amount,
      medio: p.channel === 'mercadopago' ? 'Mercado Pago' : 'Transferencia',
      estado: badge(PAY[p.status][0], PAY[p.status][1]),
    }))

  return (
    <>
      <BackLink href="/admin/clientes/planilla">Clientes</BackLink>
      <PageHead
        title={name}
        description={client.email}
        actions={<Badge tone={KYC_TONE[client.kycStatus] ?? 'neutral'}>Identidad {(KYC_LABEL[client.kycStatus] ?? client.kycStatus).toLowerCase()}</Badge>}
      />
      <Grid cols="2">
        <Pad>
          <CardHead title="Datos personales" />
          <Kv
            rows={[
              ['DNI', <span key="d" className="uc-num">{fmtDni(client.dni) || '—'}</span>],
              ['CUIL', <span key="c" className="uc-num">{client.cuit || '—'}</span>],
              ['Teléfono', <span key="t" className="uc-num">{client.phone || '—'}</span>],
              ['Domicilio', [client.address.street, client.address.city, client.address.province].filter(Boolean).join(', ') || '—'],
              ['Ocupación', client.occupation || '—'],
              ['Ingresos declarados', client.declaredIncome ? <span key="i" className="uc-num">{money(client.declaredIncome)}</span> : '—'],
              ['Alta', <span key="a" className="uc-num">{fdate(client.createdAt)}</span>],
            ]}
          />
        </Pad>
        <Pad>
          <CardHead title="Riesgo y cuenta" />
          <Kv
            rows={[
              ['Score interno', client.score ? <span key="s" className="uc-num">{client.score}</span> : '—'],
              ['BCRA', bcra ? <Badge key="b" tone={bcra.sit <= 1 ? 'success' : bcra.sit === 2 ? 'warning' : 'danger'}>{bcra.sit ? `Situación ${bcra.sit}` : 'Sin deudas'}</Badge> : 'Sin consultar'],
              ['Última consulta BCRA', bcra ? <span key="u" className="uc-num">{fdate(bcra.at)}</span> : '—'],
              ...(perms.has('risk.read')
                ? [['Informes BCRA', <a key="ib" href={`/admin/originacion/bcra-historial/${encodeURIComponent(id)}`}>Ver e imprimir cada consulta</a>] as [string, React.ReactNode]]
                : []),
              ['Banco', client.bank || '—'],
              ['CBU/CVU', client.cbu ? <span key="n" className="uc-num">···· {client.cbu.slice(-4)}</span> : '—'],
            ]}
          />
        </Pad>
      </Grid>

      <div className="my-6">
        <ClientDocumentViewer
          clientName={name}
          dni={client.dni}
          cuit={client.cuit}
          kycStatus={client.kycStatus}
          faceMatchScore={Number.isFinite(faceMatch) ? faceMatch : null}
          documents={documents}
        />
      </div>

      <SectionTitle title="Solicitudes" />
      <DataGrid
        cfg={{
          id: 'cli-sol',
          rows: apps,
          toolbar: false,
          sort: { key: 'fecha', dir: -1 },
          empty: 'Sin solicitudes.',
          columns: [
            { key: 'fecha', label: 'Fecha', kind: 'date' },
            { key: 'importe', label: 'Importe', kind: 'money', align: 'r', amount: true },
            { key: 'cuotas', label: 'Cuotas', kind: 'num', align: 'c' },
            { key: 'estado', label: 'Estado', kind: 'badge' },
            { key: 'ver', label: 'Acción', kind: 'actions', align: 'r' },
          ],
        }}
      />
      <SectionTitle title="Créditos" />
      <DataGrid
        cfg={{
          id: 'cli-cred',
          rows: credits,
          toolbar: false,
          empty: 'Sin créditos.',
          columns: [
            { key: 'nro', label: 'Crédito', kind: 'num' },
            { key: 'importe', label: 'Importe', kind: 'money', align: 'r', amount: true },
            { key: 'saldo', label: 'Saldo a cobrar', kind: 'money', align: 'r' },
            { key: 'estado', label: 'Estado', kind: 'badge' },
            { key: 'ver', label: 'Acción', kind: 'actions', align: 'r' },
          ],
        }}
      />
      <SectionTitle title="Últimos pagos" />
      <DataGrid
        cfg={{
          id: 'cli-pagos',
          rows: payments,
          toolbar: false,
          empty: 'Sin pagos.',
          columns: [
            { key: 'fecha', label: 'Fecha', kind: 'date' },
            { key: 'importe', label: 'Importe', kind: 'money', align: 'r', amount: true },
            { key: 'medio', label: 'Medio' },
            { key: 'estado', label: 'Estado', kind: 'badge' },
          ],
        }}
      />
      <div className="uc-section-gap" />
      <ButtonLink href="/admin/clientes/planilla">Volver a la planilla</ButtonLink>
    </>
  )
}
