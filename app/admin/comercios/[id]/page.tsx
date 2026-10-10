import { notFound } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { BackLink, Badge, Callout, CardHead, Grid, Kv, NoAccess, PageHead, Pad } from '@/components/uc/blocks'
import { DocReviewButtons, EditForm, FlagToggles, MessageComposer, StateActions } from '@/components/uc/merchant-admin'
import { auditAdminView, loadDesk } from '@/lib/admin-desk/load'
import { getAuditLogForEntity } from '@/lib/audit'
import { db } from '@/lib/db'
import { ensureMerchantAdminSchema } from '@/lib/db/ensure-merchant-admin'
import { merchant, user } from '@/lib/db/schema'
import { MERCHANT_DOC_LABELS, type MerchantDocType } from '@/lib/merchant-kyb'
import { MERCHANT_FLAGS, availableActions, documentChecklist, type MerchantFlag } from '@/lib/merchant-admin-core'
import * as S from '@/lib/merchant-admin-store'
import type { SqlExecutor } from '@/lib/otp-pg-store'
import { fdate, fdatetime } from '@/lib/uc/format'

export const metadata = { title: 'Comercio' }
export const dynamic = 'force-dynamic'

const STATUS = { pending: ['Pendiente', 'info'], active: ['Activo', 'success'], paused: ['Suspendido', 'warning'], rejected: ['Rechazado', 'danger'] } as const
const KYB = { incomplete: ['Incompleto', 'warning'], ready_for_review: ['Listo para revisión', 'info'], approved: ['Aprobado', 'success'], rejected: ['Rechazado', 'danger'] } as const
const DOC = { missing: ['Falta', 'danger'], uploaded: ['Cargado, sin revisar', 'info'], approved: ['Aprobado', 'success'], observed: ['Observado', 'warning'] } as const
const hex = (n: string) => n.slice(0, 12)

export default async function ComercioDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { perms, userId } = await loadDesk()
  if (!perms.has('merchants.read')) return <NoAccess what="los comercios" />
  await ensureMerchantAdminSchema()
  const [m] = await db.select().from(merchant).where(eq(merchant.id, id)).limit(1)
  if (!m) notFound()
  await auditAdminView(userId, 'comercio', id)
  const sx = db as unknown as SqlExecutor
  const [owner] = await db.select({ email: user.email, name: user.name }).from(user).where(eq(user.id, m.userId)).limit(1)
  const [docs, perm, messages, access, audit] = await Promise.all([
    S.listMerchantDocsWith(sx, id), S.getPermissionsWith(sx, id), S.listMessagesWith(sx, id), S.listDocAccessWith(sx, id), getAuditLogForEntity('merchant', id, 30),
  ])
  const versions = await Promise.all(docs.map((d) => S.listDocVersionsWith(sx, id, d.type)))
  const checklist = documentChecklist(m.personType, m.representativeRole, docs)
  const missing = checklist.filter((c) => c.state === 'missing' || c.state === 'observed')
  const canWrite = perms.has('merchants.write')
  const updatedAt = new Date(m.updatedAt).toISOString()
  const st = STATUS[m.status as keyof typeof STATUS] ?? ([m.status, 'neutral'] as const)
  const kyb = KYB[m.kybStatus as keyof typeof KYB] ?? ([m.kybStatus, 'neutral'] as const)
  const unread = messages.filter((x) => x.authorRole === 'merchant' && !x.readAt).length
  if (unread && canWrite) await S.markReadWith(sx, { merchantId: id, readerRole: 'admin', reader: userId }) // el admin ya los vio (la fila muestra "sin leer" esta vez)
  const docOptions = (Object.keys(MERCHANT_DOC_LABELS) as MerchantDocType[]).map((t) => ({ value: t, label: MERCHANT_DOC_LABELS[t] }))
  const blockers = (m.kybBlockers as string[] | null) ?? []

  return (
    <>
      <BackLink href="/admin/comercios">Comercios</BackLink>
      <PageHead
        title={m.businessName}
        description={`CUIT ${m.cuit} · ${owner?.email ?? 'sin usuario'}`}
        actions={<>
          <Badge tone={st[1]}>{st[0]}</Badge>
          <Badge tone={kyb[1]}>KYB {kyb[0].toLowerCase()}</Badge>
          {canWrite ? <StateActions id={id} updatedAt={updatedAt} actions={availableActions(m.status)} /> : null}
        </>}
      />
      {blockers.length > 0 && m.status !== 'active' ? <Callout icon="alert" title="Pendientes de verificación" tone="warning">{blockers[0]}</Callout> : null}

      <Grid cols="2">
        <Pad>
          <CardHead title="Datos del comercio" />
          <Kv rows={[
            ['Titular', owner?.name || '—'], ['Tipo de persona', m.personType || '—'], ['Condición fiscal', m.taxCondition || '—'],
            ['Cruce titular / CUIT', ({ matched: 'Coincide con el CUIT', mismatch: 'No coincide con el CUIT', pending_pj: 'Persona jurídica: se valida con documentación', missing_identity: 'Falta validar la identidad' } as Record<string, string>)[m.titularMatch ?? ''] ?? '—'], ['Comisión vigente', `${Number(m.commissionRate).toFixed(2)} % (no publicada)`], ['Alta', fdate(m.createdAt)],
          ]} />
          <div style={{ marginTop: 14 }}><EditForm id={id} updatedAt={updatedAt} canEdit={canWrite} initial={{ businessName: m.businessName ?? '', legalName: m.legalName ?? '', category: m.category ?? '', phone: m.phone ?? '', province: m.province ?? '', city: m.city ?? '', address: m.address ?? '' }} /></div>
        </Pad>
        <Pad>
          <CardHead title="Permisos operativos" />
          <FlagToggles id={id} canEdit={canWrite} active={m.status === 'active'} flags={(Object.keys(MERCHANT_FLAGS) as MerchantFlag[]).map((k) => ({ key: k, label: MERCHANT_FLAGS[k].label, on: perm[k] }))} />
          {perm.updatedAt ? <p className="uc-muted" style={{ fontSize: 12.5 }}>Último cambio: {fdatetime(perm.updatedAt)}</p> : null}
        </Pad>
      </Grid>

      <Pad style={{ marginTop: 20 }}>
        <CardHead title="Documentación (KYB)" aside={<span className="uc-muted">{missing.length ? `${missing.length} pendiente(s)` : 'Completa'}</span>} />
        {checklist.length === 0 ? <p className="uc-muted">Persona humana: no requiere expediente societario. La constancia sale del padrón ARCA.</p> : (
          <div className="uc-table-scroll"><table className="uc-dt"><thead><tr><th>Documento exigido</th><th>Estado</th><th>Archivo</th><th>Huella (SHA-256)</th><th>Versión</th><th><span className="uc-sr-only">Acciones</span></th></tr></thead><tbody>
            {checklist.map((c) => {
              const i = docs.findIndex((d) => d.id === c.documentId)
              const d = i >= 0 ? docs[i] : null
              const v = i >= 0 ? versions[i] : []
              return (
                <tr key={c.type}>
                  <td>{c.label}</td>
                  <td><Badge tone={DOC[c.state][1]}>{DOC[c.state][0]}</Badge>{c.note ? <span className="uc-muted" style={{ display: 'block', fontSize: 12 }}>{c.note}</span> : null}</td>
                  <td>{d ? <a href={`/api/admin/merchant-documents/${encodeURIComponent(d.id)}`} target="_blank" rel="noopener noreferrer">{d.fileName}</a> : '—'}</td>
                  <td className="uc-num" title={d?.sha256}>{d ? hex(d.sha256) + '…' : '—'}</td>
                  <td className="uc-num">{d ? `v${v.length + 1}` : '—'}{v.length ? <span className="uc-muted" style={{ display: 'block', fontSize: 12 }}>{v.length} anterior(es)</span> : null}</td>
                  <td>{d && canWrite ? <DocReviewButtons merchantId={id} documentId={d.id} /> : null}</td>
                </tr>
              )
            })}
          </tbody></table></div>
        )}
        {access.length > 0 ? <details style={{ marginTop: 12 }}><summary>Accesos a documentos ({access.length})</summary><ul className="uc-feed">{access.map((a, k) => <li key={k}><div className="uc-ft">{a.actor}<small>{fdatetime(a.at)} · {a.outcome === 'served' ? 'visto' : a.outcome === 'hash_mismatch' ? 'bloqueado: la huella no coincide' : a.outcome}</small></div></li>)}</ul></details> : null}
      </Pad>

      <Pad style={{ marginTop: 20 }}>
        <CardHead title="Mensajes con el comercio" aside={unread ? <Badge tone="warning">{unread} sin leer</Badge> : undefined} />
        {missing.length ? <p className="uc-muted">Falta pedir: {missing.map((x) => x.label).join(', ')}.</p> : null}
        {messages.length === 0 ? <p className="uc-muted">Todavía no hay mensajes.</p> : (
          <ul className="uc-feed" aria-label="Historial de mensajes">
            {messages.map((x) => (
              <li key={x.id}><div className="uc-ft">
                <b>{x.authorRole === 'admin' ? x.authorName : `${x.authorName} (comercio)`}</b>{' '}
                <Badge tone={x.kind === 'note' ? 'neutral' : x.kind === 'request' ? 'info' : 'success'}>{x.kind === 'note' ? 'Nota interna' : x.kind === 'request' ? 'Pedido' : 'Respuesta'}</Badge>
                {x.requestedDocType ? <> <Badge tone="neutral">{MERCHANT_DOC_LABELS[x.requestedDocType as MerchantDocType] ?? x.requestedDocType}</Badge></> : null}
                <p style={{ margin: '4px 0', whiteSpace: 'pre-wrap' }}>{x.body}</p>
                <small>{fdatetime(x.createdAt)} · {x.kind === 'note' ? 'solo interno' : x.readAt ? `leído ${fdatetime(x.readAt)}` : 'sin leer'}{x.documentId ? ' · con documento adjunto' : ''}</small>
              </div></li>
            ))}
          </ul>
        )}
        {canWrite ? <div style={{ marginTop: 14 }}><MessageComposer merchantId={id} docOptions={docOptions} /></div> : null}
      </Pad>

      <Pad style={{ marginTop: 20 }}>
        <CardHead title="Historial de cambios" />
        {audit.length === 0 ? <p className="uc-muted">Sin cambios registrados.</p> : <ul className="uc-feed">{audit.map((a) => <li key={a.id}><div className="uc-ft">{a.summary}<small>{a.actorEmail ?? '—'} · {fdatetime(a.createdAt)}</small></div></li>)}</ul>}
      </Pad>
    </>
  )
}
