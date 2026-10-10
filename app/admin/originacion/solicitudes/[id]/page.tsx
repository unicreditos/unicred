import { notFound } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { KycEvidenceViewer } from '@/components/admin/kyc-evidence-viewer'
import { LoanAdminActions } from '@/components/uc/loan-admin-actions'
import { getAuditLogForEntity } from '@/lib/audit'
import { db } from '@/lib/db'
import { loan as loanTable, loanProduct } from '@/lib/db/schema'
import { loadKycFacts, loadReopenFacts } from '@/lib/loan-admin-facts'
import { originacionKycBlockers } from '@/lib/loan-admin-rules'
import Link from 'next/link'
import { DeskActionButton } from '@/components/uc/desk-action'
import { BackLink, Badge, ButtonLink, Callout, Grid, Kv, NoAccess, PageHead, Pad, CardHead } from '@/components/uc/blocks'
import { auditAdminView, loadDesk } from '@/lib/admin-desk/load'
import { bcraByClient, fmtDni, fullName, KYC_LABEL, KYC_TONE } from '@/lib/uc/admin'
import { cuotaFrancesa, fdate, fmtPct, money } from '@/lib/uc/format'

export const metadata = { title: 'Solicitud' }

const FLAGS: Record<string, string> = {
  kyc_incomplete: 'La identidad del cliente no está verificada',
  low_score: 'Score interno bajo (menor a 500)',
  score_reject_zone: 'Score en zona de rechazo (menor a 400)',
  high_ticket: 'Monto alto: más de $ 500.000',
}
const STATUS = {
  pending: ['En revisión', 'warning'],
  approved: ['Aprobada', 'success'],
  rejected: ['Rechazada', 'danger'],
  cancelled: ['Anulada', 'neutral'],
} as const

export default async function SolicitudDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { state, perms, userId } = await loadDesk()
  if (!perms.has('credits.read')) return <NoAccess what="las solicitudes de crédito" />
  await auditAdminView(userId, 'solicitud', id)

  const app = state.applications.find((a) => a.id === id)
  if (!app) notFound()

  const client = state.clients.find((c) => c.id === app.clientId)
  // Lecturas de solo lectura para la gestión: versión del crédito, límites, identidad, historial.
  const [loanRow] = await db.select({ updatedAt: loanTable.updatedAt, status: loanTable.status, productId: loanTable.productId }).from(loanTable).where(eq(loanTable.id, app.id)).limit(1).catch(() => [])
  const [prodRow] = loanRow?.productId ? await db.select().from(loanProduct).where(eq(loanProduct.id, loanRow.productId)).limit(1).catch(() => []) : []
  const kycFacts = await loadKycFacts(app.clientId).catch(() => null)
  const kycBlockers = kycFacts ? originacionKycBlockers(kycFacts) : ['No se pudo leer el estado de identidad.']
  const reopenFacts = loanRow ? await loadReopenFacts(app.id, loanRow.status).catch(() => null) : null
  const timeline = perms.has('credits.read') ? await getAuditLogForEntity('loan', app.id, 50).catch(() => []) : []
  const executed = !!reopenFacts && (reopenFacts.disbursementsCredited > 0 || reopenFacts.paidInstallments > 0)
  const DOC_LABEL = { dni_front: 'DNI frente', dni_back: 'DNI dorso', selfie: 'Selfie', video: 'Video de prueba de vida' } as const
  const product = state.products.find((p) => p.id === app.productId)
  const approval = state.approvals.find((a) => a.applicationId === app.id)
  const bcra = bcraByClient(state).get(app.clientId)
  const name = fullName(client)
  const pending = app.status === 'pending'
  const kycOk = client?.kycStatus === 'verified'
  const [stLabel, stTone] = STATUS[app.status]
  const income = client?.declaredIncome ?? 0
  const rci = income > 0 && product ? (cuotaFrancesa(app.amount, app.installments, product.tna) / income) * 100 : null
  const summary: Array<[string, string]> = [
    ['Cliente', name],
    ['Importe', `${money(app.amount)} en ${app.installments} cuotas`],
  ]

  return (
    <>
      <BackLink href="/admin/originacion/solicitudes">Solicitudes</BackLink>
      <PageHead
        title={`Solicitud de ${name}`}
        description={`${money(app.amount)} en ${app.installments} cuotas · recibida el ${fdate(app.createdAt)}`}
        actions={<Badge tone={stTone}>{stLabel}</Badge>}
      />

      <Grid cols="21">
        <div style={{ display: 'grid', gap: 20 }}>
          <Pad>
            <CardHead title="Condiciones pedidas" />
            <Kv
              rows={[
                ['Importe', <span key="a" className="uc-num">{money(app.amount)}</span>],
                ['Cuotas', <span key="c" className="uc-num">{app.installments}</span>],
                ['Producto', product?.name ?? '—'],
                ['TNA', product ? <span key="t" className="uc-num">{fmtPct(product.tna)}</span> : '—'],
                ['CFT', product ? <span key="f" className="uc-num">{fmtPct(product.cft)}</span> : '—'],
                ['Destino', app.purpose || '—'],
                ['Canal', app.merchantId ? 'Comercio' : 'Directo'],
              ]}
            />
          </Pad>

          <Pad>
            <CardHead
              title="Cliente"
              aside={client ? <Link href={`/admin/clientes/${encodeURIComponent(client.id)}`}>Ver ficha</Link> : null}
            />
            {client ? (
              <Kv
                rows={[
                  ['DNI', <span key="d" className="uc-num">{fmtDni(client.dni) || '—'}</span>],
                  ['CUIL', <span key="c" className="uc-num">{client.cuit || '—'}</span>],
                  ['Ingresos declarados', income ? <span key="i" className="uc-num">{money(income)}</span> : '—'],
                  ['Identidad', <Badge key="k" tone={KYC_TONE[client.kycStatus] ?? 'neutral'}>{KYC_LABEL[client.kycStatus] ?? client.kycStatus}</Badge>],
                  ['Score interno', client.score ? <span key="s" className="uc-num">{client.score}</span> : '—'],
                  ['Ocupación', client.occupation || '—'],
                  ['Localidad', [client.address.city, client.address.province].filter(Boolean).join(', ') || '—'],
                  ['Email', client.email || '—'],
                  ['Teléfono', client.phone || '—'],
                ]}
              />
            ) : (
              <p className="uc-note">No se encontró la ficha del cliente.</p>
            )}
          </Pad>

          <Pad>
            <CardHead title="Central de Deudores (BCRA)" aside={bcra ? <span>Consulta del {fdate(bcra.at)}</span> : undefined} />
            {bcra ? (
              <Kv
                rows={[
                  ['Situación', bcra.sit ? <Badge key="b" tone={bcra.sit === 1 ? 'success' : bcra.sit === 2 ? 'warning' : 'danger'}>Situación {bcra.sit}</Badge> : 'Sin deudas informadas'],
                  ['Entidades', <span key="e" className="uc-num">{bcra.entities}</span>],
                  ['Score', <span key="s" className="uc-num">{bcra.score}</span>],
                  ['Cuota / ingreso', rci != null ? <span key="r" className="uc-num" style={{ color: rci > 30 ? 'var(--uc-danger)' : undefined }}>{fmtPct(rci)}</span> : '—'],
                ]}
              />
            ) : (
              <p className="uc-note">Todavía no se consultó la situación del cliente en el BCRA.</p>
            )}
          </Pad>

          <Pad>
            <CardHead title="Identidad y verificaciones" aside={client ? <Link href={`/admin/originacion/documentacion/${encodeURIComponent(client.id)}`}>Documentación</Link> : undefined} />
            {kycFacts ? (
              <Kv
                rows={[
                  ['Didit', <Badge key="d" tone={kycFacts.diditApproved ? 'success' : 'danger'}>{kycFacts.diditApproved ? 'Aprobado y vigente' : kycFacts.kycRecordStatus ? `No vigente (${kycFacts.kycRecordStatus})` : 'Sin verificar'}</Badge>],
                  ['Revisado', kycFacts.reviewedAt ? fdate(kycFacts.reviewedAt.toISOString()) : '—'],
                  ['Vence', kycFacts.expiresAt ? fdate(kycFacts.expiresAt.toISOString()) : '12 meses desde la revisión'],
                  ['Consentimiento BCRA', <Badge key="b" tone={kycFacts.bcraConsent ? 'success' : 'danger'}>{kycFacts.bcraConsent ? 'Otorgado' : 'Falta'}</Badge>],
                  ['Padrón ARCA', <Badge key="a" tone={kycFacts.arcaManualReview ? 'warning' : kycFacts.arcaChecked ? 'success' : 'neutral'}>{kycFacts.arcaManualReview ? 'Revisión manual' : kycFacts.arcaChecked ? 'Consultado' : 'Sin consultar'}</Badge>],
                  ...(Object.keys(DOC_LABEL) as Array<keyof typeof DOC_LABEL>).map((k): [string, React.ReactNode] => [DOC_LABEL[k], <Badge key={k} tone={kycFacts.docs[k] ? 'success' : 'warning'}>{kycFacts.docs[k] ? 'Cargado' : 'Falta'}</Badge>]),
                ]}
              />
            ) : (
              <p className="uc-note">No se pudo leer el estado de identidad. Reintentá en unos segundos.</p>
            )}
            {kycBlockers.length ? (
              <div className="uc-req" style={{ marginTop: 12 }}>
                {kycBlockers.join(' ')}
              </div>
            ) : null}
          </Pad>

          <Pad>
            <CardHead title="Documentación completa" />
            {perms.has('kyc.review') && client ? (
              <KycEvidenceViewer userId={client.id} />
            ) : (
              <p className="uc-note">Tu rol no puede ver la documentación de identidad.</p>
            )}
          </Pad>

          <Pad>
            <CardHead title="Historial de la solicitud" />
            {timeline.length ? (
              <ol className="uc-check" style={{ display: 'grid', gap: 10, listStyle: 'none', padding: 0 }}>
                {timeline.map((t) => (
                  <li key={t.id}>
                    <b>{fdate(new Date(t.createdAt).toISOString())}</b> · {t.actorEmail ?? 'Sistema'}
                    <div className="uc-note">{t.action.replace(/_/g, ' ').toLowerCase()}{t.summary ? ` — ${t.summary}` : ''}</div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="uc-note">Todavía no hay movimientos registrados para esta solicitud.</p>
            )}
          </Pad>
        </div>

        <div style={{ display: 'grid', gap: 20, alignContent: 'start' }}>
          <Callout icon="lock" title="Decisión manual" tone="warning">
            Esta solicitud quedó en revisión manual: la consulta BCRA y el score son insumos y la decisión la registra una persona, con su nombre en Auditoría.
          </Callout>
          <Pad>
            <CardHead title="Decisión" />
            {approval?.policyFlags?.length ? (
              <ul className="uc-check" style={{ marginBottom: 14 }}>
                {approval.policyFlags.map((f) => (
                  <li key={f}>
                    <span className="uc-tx" style={{ color: 'var(--uc-warning)' }}>
                      {FLAGS[f] ?? f}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
            {pending ? (
              <>
                {!kycOk ? (
                  <div className="uc-req" style={{ marginBottom: 14 }}>
                    La identidad no está verificada: no se puede aprobar hasta completar el KYC.
                  </div>
                ) : null}
                <div className="uc-cta-row">
                  {perms.has('credits.approve') ? (
                    <DeskActionButton
                      spec={{
                        kind: 'desk',
                        label: 'Aprobar crédito',
                        action: 'approveApplication',
                        payload: { applicationId: app.id },
                        title: 'Aprobar crédito',
                        sub: name,
                        summary,
                        warning: 'Se genera el desembolso pendiente. Queda registrado en Auditoría.',
                        confirmLabel: 'Aprobar',
                        success: 'Crédito aprobado.',
                        field: { name: 'comment', label: 'Comentario del analista', placeholder: 'Motivo de la decisión' },
                      }}
                    />
                  ) : null}
                  {perms.has('credits.reject') ? (
                    <DeskActionButton
                      spec={{
                        kind: 'desk',
                        label: 'Rechazar',
                        action: 'rejectApplication',
                        payload: { applicationId: app.id },
                        title: 'Rechazar solicitud',
                        sub: name,
                        summary,
                        confirmLabel: 'Rechazar solicitud',
                        success: 'Solicitud rechazada.',
                        field: { name: 'comment', label: 'Motivo del rechazo', required: true, placeholder: 'Ej.: ingresos insuficientes para la cuota' },
                        danger: true,
                      }}
                    />
                  ) : null}
                </div>
                {!perms.has('credits.approve') && !perms.has('credits.reject') ? (
                  <p className="uc-note">Tu rol puede ver la solicitud pero no decidir.</p>
                ) : null}
              </>
            ) : (
              <div style={{ display: 'grid', gap: 10 }}>
                <p className="uc-note">
                  Decidida el <b>{fdate(app.decidedAt)}</b>.
                </p>
                {app.notes ? <p className="uc-note">Motivo: {app.notes}</p> : null}
                {app.status === 'approved' ? (
                  <ButtonLink href={`/admin/creditos/otorgados/${encodeURIComponent(app.id)}`}>Ver crédito</ButtonLink>
                ) : null}
              </div>
            )}
          </Pad>
          {loanRow && reopenFacts && perms.has('credits.edit') ? (
            <Pad>
              <CardHead title="Gestión" />
              <LoanAdminActions
                applicationId={app.id}
                expectedUpdatedAt={new Date(loanRow.updatedAt).toISOString()}
                status={loanRow.status}
                canEdit={Boolean(prodRow)}
                amount={app.amount}
                installments={app.installments}
                minAmount={Number(prodRow?.minAmount ?? 0)}
                maxAmount={Number(prodRow?.maxAmount ?? 0)}
                minTerm={prodRow?.minTerm ?? 1}
                maxTerm={prodRow?.maxTerm ?? 1}
                contractAccepted={reopenFacts.contractAccepted}
                locked={executed || loanRow.status === 'active' || loanRow.status === 'paid'}
                lockedReason="Hay un desembolso, pagos o el crédito está vigente: no se puede reabrir ni editar. Las operaciones ejecutadas no se alteran."
              />
            </Pad>
          ) : null}
        </div>
      </Grid>
    </>
  )
}
