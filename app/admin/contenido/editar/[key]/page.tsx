import { notFound } from 'next/navigation'
import { ContentEditor } from '@/components/admin/content-editor'
import { RestoreVersionButton } from '@/components/admin/content-version-actions'
import { DiffTable, SensitivityBadge, StatusBadge } from '@/components/admin/content-parts'
import { BackLink, Badge } from '@/components/uc/blocks'
import { getContentAccess } from '@/lib/site-config/access'
import { valueHash } from '@/lib/site-config/core'
import { getDefinition, TAB_LABEL } from '@/lib/site-config/registry'
import { getItemDetail } from '@/lib/site-config/store'

export const metadata = { title: 'Editar configuración' }

const fmt = (d: Date | string | null | undefined) =>
  d ? new Date(d).toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', dateStyle: 'short', timeStyle: 'short' }) : '—'

export default async function EditarPage({ params, searchParams }: { params: Promise<{ key: string }>; searchParams: Promise<{ compare?: string }> }) {
  const { key: rawKey } = await params
  const { compare } = await searchParams
  const key = decodeURIComponent(rawKey)
  const def = getDefinition(key)
  const access = await getContentAccess()
  if (!def || !access.any) notFound()

  const detail = await getItemDetail(key)
  const { published, open, versions } = detail
  const sensitive = def.sensitivity !== 'normal'
  const baseline = published ? published.value : def.defaults
  const baselineLabel = published ? `Publicada v${published.version}` : 'Valor del código'
  const initialValue = open?.value ?? baseline
  const compareVersion = compare ? versions.find((v) => v.version === Number(compare)) : null

  return (
    <>
      <div style={{ marginBottom: 16 }}>
        <BackLink href={`/admin/contenido/${def.tab}`}>{TAB_LABEL[def.tab]}</BackLink>
        <h2 style={{ margin: '8px 0 4px', fontSize: 20 }}>{def.label}</h2>
        <p className="uc-muted" style={{ margin: 0 }}>{def.description}</p>
        <div className="uc-cfg-badges">
          <SensitivityBadge sensitivity={def.sensitivity} />
          {sensitive ? <Badge tone="warning">Pendiente de aprobación</Badge> : null}
          <Badge tone={def.wired ? 'info' : 'neutral'}>{def.wired ? 'Conectado a la web' : 'Solo guardado'}</Badge>
        </div>
        <p className="uc-muted" style={{ margin: '8px 0 0', fontSize: 12.5 }}>
          {sensitive ? 'No se muestra en la web pública salvo que exista una versión publicada con la marca “visible en la web pública”. ' : ''}
          {def.wiredNote}
        </p>
      </div>

      {compareVersion ? (
        <section className="uc-card uc-pad" style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 15, margin: '0 0 10px' }}>
            Cambios de la versión {compareVersion.version} respecto de {baselineLabel.toLowerCase()}
          </h2>
          <DiffTable before={baseline} after={compareVersion.value} fields={def.fields} beforeLabel={baselineLabel} afterLabel={`v${compareVersion.version}`} />
        </section>
      ) : null}

      <ContentEditor
        key={`${open?.version ?? 'none'}:${open?.status ?? ''}:${open ? valueHash(open.value).slice(0, 8) : ''}:${published?.version ?? ''}`}
        def={{ key: def.key, label: def.label, sensitivity: def.sensitivity, fields: def.fields, preview: def.preview }}
        initialValue={initialValue}
        baseline={baseline}
        baselineLabel={baselineLabel}
        published={published ? { version: published.version, publicVisible: published.publicVisible } : null}
        open={
          open
            ? {
                version: open.version,
                status: open.status,
                reason: open.reason,
                publicVisible: open.publicVisible,
                reviewNote: open.reviewNote,
                authorEmail: open.authorEmail,
                authorId: open.authorId,
                lastEditorId: open.lastEditorId,
                approvedByEmail: open.approvedByEmail,
              }
            : null
        }
        me={{ userId: access.userId, canEdit: access.canEdit, canApprove: access.canApprove(def.sensitivity) }}
      />

      <section className="uc-card" style={{ marginTop: 20 }}>
        <div className="uc-card-h">
          <h2>Historial de versiones</h2>
        </div>
        {versions.length === 0 ? (
          <p className="uc-muted" style={{ padding: 20, margin: 0 }}>Todavía no hay versiones guardadas: la web usa el valor del código.</p>
        ) : (
          <div className="uc-table-scroll" style={{ maxHeight: 'none' }}>
            <table className="uc-dt">
              <thead>
                <tr>
                  <th>Versión</th>
                  <th>Estado</th>
                  <th>Autor</th>
                  <th>Aprobó</th>
                  <th>Publicada</th>
                  <th>Motivo</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {versions.map((v) => (
                  <tr key={v.id}>
                    <td>v{v.version}</td>
                    <td><StatusBadge status={v.status} /></td>
                    <td>{v.authorEmail ?? '—'}</td>
                    <td>{v.approvedByEmail ?? '—'}</td>
                    <td>{v.publishedAt ? fmt(v.publishedAt) : '—'}</td>
                    <td style={{ whiteSpace: 'normal', minWidth: 180 }}>{v.reason}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <a className="uc-row-action" href={`?compare=${v.version}`}>Ver cambios</a>{' '}
                      {access.canEdit && v.status !== 'draft' ? <RestoreVersionButton itemKey={key} version={v.version} disabled={Boolean(open)} /> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  )
}
