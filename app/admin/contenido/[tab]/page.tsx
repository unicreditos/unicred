import Link from 'next/link'
import { notFound } from 'next/navigation'
import { desc, eq } from 'drizzle-orm'
import { RestoreVersionButton } from '@/components/admin/content-version-actions'
import { SensitivityBadge, StatusBadge } from '@/components/admin/content-parts'
import { Badge, Callout } from '@/components/uc/blocks'
import { db } from '@/lib/db'
import { adminAuditLog } from '@/lib/db/schema'
import { getContentAccess } from '@/lib/site-config/access'
import { STATUS_LABEL } from '@/lib/site-config/core'
import { definitionsForTab, getDefinition, TAB_LABEL, type ConfigTab } from '@/lib/site-config/registry'
import { listHistory, listItemStates } from '@/lib/site-config/store'

const TABS = ['comisiones', 'textos', 'legal', 'parametros'] as const

export async function generateMetadata({ params }: { params: Promise<{ tab: string }> }) {
  const { tab } = await params
  return { title: (TAB_LABEL as Record<string, string>)[tab] ?? 'Historial' }
}

const fmt = (d: Date | string | null | undefined) =>
  d ? new Date(d).toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', dateStyle: 'short', timeStyle: 'short' }) : '—'

export default async function ContenidoTab({ params }: { params: Promise<{ tab: string }> }) {
  const { tab } = await params
  const access = await getContentAccess()
  if (!access.any) notFound()
  if (tab === 'historial') return <Historial />
  if (!(TABS as readonly string[]).includes(tab)) notFound()
  const states = await listItemStates()
  const defs = definitionsForTab(tab as ConfigTab)

  return (
    <>
      {tab === 'comisiones' ? (
        <Callout icon="lock" title="Pendiente de aprobación">
          Las comisiones, tasas y el método de CFT se pueden editar y guardar acá, pero <b style={{ display: 'inline' }}>no se muestran en la web pública</b> mientras no exista una versión
          publicada con la marca “visible en la web pública”, aprobada por un segundo administrador. Hoy no hay ninguna aprobada por la dirección ni por la asesoría legal. Además, este prototipo
          todavía no alimenta el simulador ni los créditos: cambiar un valor no modifica ningún crédito existente.
        </Callout>
      ) : null}
      {tab === 'legal' ? (
        <Callout icon="file" title="Documentación de la web">
          Cada documento tiene versión y fecha de vigencia. La lista pública está en <code>/legal/documentos</code> del sitio. Los cambios exigen
          doble control: lo aprueba otro administrador y recién después se publica.
        </Callout>
      ) : null}
      <section className="uc-card">
        {defs.map((d) => {
          const st = states.get(d.key)
          const published = st?.publishedVersion != null
          const sensitive = d.sensitivity !== 'normal'
          return (
            <div key={d.key} className="uc-cfg-item">
              <div style={{ minWidth: 0 }}>
                <h3>{d.label}</h3>
                <p>{d.description}</p>
                <div className="uc-cfg-badges">
                  <SensitivityBadge sensitivity={d.sensitivity} />
                  {st?.openStatus ? <StatusBadge status={st.openStatus} /> : null}
                  {published ? (
                    sensitive && !st!.publicVisible ? (
                      <Badge tone="warning">Publicado v{st!.publishedVersion} · oculto en la web</Badge>
                    ) : (
                      <Badge tone="success">Publicado v{st!.publishedVersion}</Badge>
                    )
                  ) : (
                    <Badge tone="neutral">Usa el valor del código</Badge>
                  )}
                  {sensitive && !published ? <Badge tone="warning">Pendiente de aprobación</Badge> : null}
                  <Badge tone={d.wired ? 'info' : 'neutral'}>{d.wired ? 'Conectado a la web' : 'Solo guardado'}</Badge>
                </div>
              </div>
              <Link className="uc-btn" href={`/admin/contenido/editar/${encodeURIComponent(d.key)}`}>
                {access.canEdit ? 'Editar' : 'Ver'}
              </Link>
            </div>
          )
        })}
        {defs.length === 0 ? <p className="uc-muted" style={{ padding: 20 }}>No hay elementos en esta sección.</p> : null}
      </section>
    </>
  )
}

async function Historial() {
  const [versions, audit, states] = await Promise.all([
    listHistory(80),
    db.select().from(adminAuditLog).where(eq(adminAuditLog.entityType, 'site_config')).orderBy(desc(adminAuditLog.createdAt)).limit(60),
    listItemStates(),
  ])
  const hasOpen = new Set([...states.values()].filter((s) => s.openStatus).map((s) => s.key))
  const canEdit = (await getContentAccess()).canEdit
  return (
    <div className="uc-cfg-stack">
      <section className="uc-card">
        <div className="uc-card-h">
          <h2>Versiones</h2>
        </div>
        {versions.length === 0 ? (
          <p className="uc-muted" style={{ padding: 20, margin: 0 }}>Todavía no se creó ninguna versión. La web usa los valores del código.</p>
        ) : (
          <div className="uc-table-scroll" style={{ maxHeight: 'none' }}>
            <table className="uc-dt">
              <thead>
                <tr>
                  <th>Elemento</th>
                  <th>Versión</th>
                  <th>Estado</th>
                  <th>Autor</th>
                  <th>Aprobó</th>
                  <th>Publicó</th>
                  <th>Motivo</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {versions.map((v) => (
                  <tr key={v.id}>
                    <td>{getDefinition(v.itemKey)?.label ?? v.itemKey}</td>
                    <td>v{v.version}{v.rollbackOfVersion ? ` (restaura v${v.rollbackOfVersion})` : ''}</td>
                    <td>
                      <StatusBadge status={v.status} />
                    </td>
                    <td>{v.authorEmail ?? '—'}</td>
                    <td>{v.approvedByEmail ?? '—'}</td>
                    <td>{v.publishedByEmail ? `${v.publishedByEmail} · ${fmt(v.publishedAt)}` : '—'}</td>
                    <td style={{ whiteSpace: 'normal', minWidth: 200 }}>{v.reason}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <Link className="uc-row-action" href={`/admin/contenido/editar/${encodeURIComponent(v.itemKey)}?compare=${v.version}`}>
                        Ver cambios
                      </Link>{' '}
                      {canEdit && v.status !== 'draft' ? <RestoreVersionButton itemKey={v.itemKey} version={v.version} disabled={hasOpen.has(v.itemKey)} /> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <section className="uc-card">
        <div className="uc-card-h">
          <h2>Registro de auditoría</h2>
        </div>
        {audit.length === 0 ? (
          <p className="uc-muted" style={{ padding: 20, margin: 0 }}>Sin movimientos todavía.</p>
        ) : (
          <div className="uc-table-scroll" style={{ maxHeight: 'none' }}>
            <table className="uc-dt">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Quién</th>
                  <th>Acción</th>
                  <th>Detalle</th>
                </tr>
              </thead>
              <tbody>
                {audit.map((a) => (
                  <tr key={a.id}>
                    <td>{fmt(a.createdAt)}</td>
                    <td>{a.actorEmail ?? '—'}</td>
                    <td>{a.action.replace('SITE_CONFIG_', '').toLowerCase()}</td>
                    <td style={{ whiteSpace: 'normal', minWidth: 240 }}>{a.summary}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <p className="uc-muted" style={{ margin: 0 }}>
        Estados posibles: {Object.values(STATUS_LABEL).join(' · ')}.
      </p>
    </div>
  )
}
