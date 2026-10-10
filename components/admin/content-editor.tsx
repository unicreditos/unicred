'use client'

import { useEffect, useId, useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  approveAction,
  discardDraftAction,
  publishAction,
  returnToDraftAction,
  saveDraftAction,
  submitReviewAction,
  unpublishAction,
  type ConfigActionResult,
} from '@/app/admin/contenido/actions'
import { Callout } from '@/components/uc/blocks'
import { ConfigPreview } from '@/components/admin/content-preview'
import { DiffTable, StatusBadge } from '@/components/admin/content-parts'
import { stableStringify } from '@/lib/site-config/diff'
import type { VersionStatus } from '@/lib/site-config/core'
import type { FieldSpec, PreviewKind, Sensitivity } from '@/lib/site-config/registry'

export type EditorDef = {
  key: string
  label: string
  sensitivity: Sensitivity
  fields: FieldSpec[]
  preview: PreviewKind
}
export type EditorOpen = {
  version: number
  status: VersionStatus
  reason: string
  publicVisible: boolean
  reviewNote: string | null
  authorEmail: string | null
  authorId: string
  lastEditorId: string | null
  approvedByEmail: string | null
}
export type EditorPublished = { version: number; publicVisible: boolean }
export type EditorProps = {
  def: EditorDef
  initialValue: unknown
  baseline: unknown
  baselineLabel: string
  published: EditorPublished | null
  open: EditorOpen | null
  me: { userId: string; canEdit: boolean; canApprove: boolean }
}

type Path = Array<string | number>
const pathKey = (base: string, p: Path) => p.reduce<string>((acc, s) => (typeof s === 'number' ? `${acc}[${s + 1}]` : acc ? `${acc}.${s}` : String(s)), base)

function blankRow(fields: FieldSpec[]): Record<string, unknown> {
  const o: Record<string, unknown> = {}
  for (const f of fields) o[f.name] = f.type === 'number' ? '' : f.type === 'boolean' ? false : f.type === 'select' ? (f.options?.[0]?.value ?? '') : ''
  return o
}

/* ------------------------------ Campos ------------------------------ */

function Field({
  spec,
  value,
  onChange,
  disabled,
  errors,
  path,
}: {
  spec: FieldSpec
  value: unknown
  onChange: (v: unknown) => void
  disabled: boolean
  errors: Record<string, string>
  path: string
}) {
  const id = useId()
  const err = errors[path]
  const errNode = err ? (
    <span className="uc-cfg-err" role="alert">
      {err}
    </span>
  ) : null
  const help = spec.help ? <span className="uc-cfg-help">{spec.help}</span> : null

  if (spec.type === 'boolean') {
    return (
      <label className="uc-cfg-check" htmlFor={id}>
        <input id={id} type="checkbox" checked={value === true} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
        <span>
          {spec.label}
          {help}
        </span>
      </label>
    )
  }
  if (spec.type === 'rows') {
    const rows = Array.isArray(value) ? (value as Array<Record<string, unknown>>) : []
    const max = spec.maxRows ?? 20
    return (
      <div className="uc-cfg-lbl">
        <span>{spec.label}</span>
        {rows.length === 0 ? <span className="uc-muted" style={{ fontWeight: 400 }}>Todavía no hay filas.</span> : null}
        {rows.map((row, i) => (
          <div key={i} className="uc-cfg-row">
            <div className="uc-cfg-row-grid">
              {spec.rows!.map((sub) => (
                <Field
                  key={sub.name}
                  spec={sub}
                  value={row[sub.name]}
                  disabled={disabled}
                  errors={errors}
                  path={`${path}[${i + 1}].${sub.name}`}
                  onChange={(v) => onChange(rows.map((r, j) => (j === i ? { ...r, [sub.name]: v } : r)))}
                />
              ))}
            </div>
            {!disabled ? (
              <div>
                <button type="button" className="uc-btn" onClick={() => onChange(rows.filter((_, j) => j !== i))}>
                  Quitar fila {i + 1}
                </button>
              </div>
            ) : null}
          </div>
        ))}
        {!disabled && rows.length < max ? (
          <div>
            <button type="button" className="uc-btn" onClick={() => onChange([...rows, blankRow(spec.rows!)])}>
              + {spec.addLabel ?? 'Agregar fila'}
            </button>
          </div>
        ) : null}
        {errNode}
      </div>
    )
  }
  return (
    <label className="uc-cfg-lbl" htmlFor={id}>
      <span>{spec.label}</span>
      {spec.type === 'textarea' ? (
        <textarea id={id} className="uc-field" value={String(value ?? '')} maxLength={spec.maxLength} disabled={disabled} aria-invalid={Boolean(err)} onChange={(e) => onChange(e.target.value)} />
      ) : spec.type === 'select' ? (
        <select id={id} className="uc-field" value={String(value ?? '')} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
          {spec.options?.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ) : spec.type === 'number' ? (
        <span className="uc-cfg-inline">
          <input
            id={id}
            className="uc-field"
            type="number"
            inputMode="decimal"
            step={spec.step ?? 'any'}
            value={value === '' || value == null ? '' : String(value)}
            disabled={disabled}
            aria-invalid={Boolean(err)}
            onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
          />
          {spec.suffix ? <span className="uc-cfg-suffix">{spec.suffix}</span> : null}
        </span>
      ) : (
        <input
          id={id}
          className="uc-field"
          type={spec.type === 'date' ? 'date' : 'text'}
          value={String(value ?? '')}
          maxLength={spec.maxLength}
          disabled={disabled}
          aria-invalid={Boolean(err)}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      {help}
      {errNode}
    </label>
  )
}

/* ------------------------------ Diálogo de confirmación ------------------------------ */

type DialogSpec = {
  title: string
  sub?: string
  warning?: string
  confirmLabel: string
  note?: { label: string; required: boolean }
  approvalRef?: { label: string }
  password?: boolean
  run: (v: { note: string; ref: string; password: string }) => Promise<ConfigActionResult>
}

function ActionDialog({ spec, onClose, onDone }: { spec: DialogSpec | null; onClose: () => void; onDone: (r: Extract<ConfigActionResult, { ok: true }>) => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  const uid = useId()
  const [note, setNote] = useState('')
  const [apr, setApr] = useState('')
  const [pwd, setPwd] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (spec && !d.open) {
      setNote('')
      setApr('')
      setPwd('')
      setError(null)
      d.showModal()
    }
    if (!spec && d.open) d.close()
  }, [spec])

  const missing =
    (spec?.note?.required && note.trim().length < 5) || (spec?.approvalRef && apr.trim().length < 10) || (spec?.password && pwd.length < 1)

  return (
    <dialog ref={ref} className="uc-dlg" aria-labelledby={`${uid}-t`} onClose={onClose} onClick={(e) => e.target === ref.current && !pending && onClose()}>
      {spec ? (
        <>
          <header>
            <h2 id={`${uid}-t`}>{spec.title}</h2>
            {spec.sub ? <p>{spec.sub}</p> : null}
          </header>
          <div className="uc-body">
            {spec.warning ? <div className="uc-req"><span>{spec.warning}</span></div> : null}
            {spec.note ? (
              <label className="uc-cfg-lbl">
                <span>
                  {spec.note.label}
                  {spec.note.required ? ' (obligatorio)' : ''}
                </span>
                <textarea className="uc-field" value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} />
              </label>
            ) : null}
            {spec.approvalRef ? (
              <label className="uc-cfg-lbl">
                <span>{spec.approvalRef.label} (obligatorio)</span>
                <input className="uc-field" value={apr} maxLength={300} onChange={(e) => setApr(e.target.value)} />
              </label>
            ) : null}
            {spec.password ? (
              <label className="uc-cfg-lbl">
                <span>Tu clave actual (re-autenticación)</span>
                <input className="uc-field" type="password" autoComplete="current-password" value={pwd} onChange={(e) => setPwd(e.target.value)} />
              </label>
            ) : null}
            {error ? (
              <p className="uc-cfg-err" role="alert" style={{ margin: 0 }}>
                {error}
              </p>
            ) : null}
          </div>
          <footer>
            <button type="button" className="uc-btn" onClick={onClose} disabled={pending}>
              Cancelar
            </button>
            <button
              type="button"
              className="uc-btn uc-primary"
              disabled={pending || Boolean(missing)}
              onClick={() =>
                start(async () => {
                  setError(null)
                  const r = await spec.run({ note: note.trim(), ref: apr.trim(), password: pwd })
                  if (r.ok) onDone(r)
                  else setError(r.error)
                })
              }
            >
              {pending ? 'Procesando…' : spec.confirmLabel}
            </button>
          </footer>
        </>
      ) : null}
    </dialog>
  )
}

/* ------------------------------ Editor ------------------------------ */

export function ContentEditor({ def, initialValue, baseline, baselineLabel, published, open, me }: EditorProps) {
  const router = useRouter()
  const [value, setValue] = useState<unknown>(initialValue)
  const [reason, setReason] = useState(open?.reason ?? '')
  const [publicVisible, setPublicVisible] = useState(open?.publicVisible ?? false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [dialog, setDialog] = useState<DialogSpec | null>(null)
  const [pending, start] = useTransition()

  const sensitive = def.sensitivity !== 'normal'
  const status = open?.status ?? null
  const editable = me.canEdit && (!open || status === 'draft')
  const baseValue = open ? (open.status === 'draft' ? initialValue : initialValue) : initialValue
  const dirty = useMemo(
    () => stableStringify(value) !== stableStringify(baseValue) || reason.trim() !== (open?.reason ?? '') || (sensitive && publicVisible !== (open?.publicVisible ?? false)),
    [value, baseValue, reason, open, publicVisible, sensitive],
  )
  const authorLike = Boolean(open && (open.authorId === me.userId || open.lastEditorId === me.userId))
  const fieldsRoot = def.fields

  function done(r: Extract<ConfigActionResult, { ok: true }>) {
    setDialog(null)
    toast.success(r.message)
    router.refresh()
  }

  function save() {
    setFormError(null)
    setErrors({})
    start(async () => {
      const r = await saveDraftAction({ key: def.key, value, reason, publicVisible })
      if (r.ok) done(r)
      else {
        setErrors(r.fieldErrors ?? {})
        setFormError(r.error)
      }
    })
  }

  const dlgSubmit: DialogSpec = {
    title: 'Enviar a revisión',
    sub: `"${def.label}" quedará bloqueado para edición hasta que alguien lo apruebe o lo devuelva.`,
    confirmLabel: 'Enviar a revisión',
    run: () => submitReviewAction(def.key),
  }
  const dlgDiscard: DialogSpec = {
    title: 'Descartar borrador',
    sub: 'Se elimina este borrador. Las versiones publicadas no se tocan.',
    confirmLabel: 'Descartar',
    run: () => discardDraftAction(def.key),
  }
  const dlgReturn: DialogSpec = {
    title: 'Devolver a borrador',
    sub: 'El autor podrá corregirlo y volver a enviarlo.',
    confirmLabel: 'Devolver',
    note: { label: 'Motivo de la devolución', required: true },
    run: (v) => returnToDraftAction(def.key, v.note),
  }
  const dlgApprove: DialogSpec = {
    title: 'Aprobar (segundo control)',
    sub: `Vas a aprobar la versión ${open?.version} de "${def.label}". Es la segunda firma: después ya se puede publicar.`,
    warning: sensitive ? 'Revisá el detalle de cambios y la vista previa. Quien escribió el cambio no puede aprobarlo.' : undefined,
    confirmLabel: 'Aprobar',
    note: { label: 'Nota de la revisión', required: true },
    approvalRef: open?.publicVisible && sensitive ? { label: 'Quién aprobó mostrarlo en la web (dirección y asesoría legal) y cuándo' } : undefined,
    run: (v) => approveAction(def.key, v.note, v.ref),
  }
  const dlgPublish: DialogSpec = {
    title: 'Publicar',
    sub: `Se publica la versión ${open?.version} de "${def.label}".`,
    warning: sensitive
      ? open?.publicVisible
        ? 'Esta versión se mostrará en la web pública. Verificá que dirección y asesoría legal la aprobaron.'
        : 'Se publica oculta: no se mostrará en la web pública (no tiene la marca "visible en la web pública").'
      : 'El cambio aparece en la web en segundos.',
    confirmLabel: 'Publicar',
    password: true,
    run: (v) => publishAction(def.key, v.password),
  }
  const dlgUnpublish: DialogSpec = {
    title: 'Dejar de publicar',
    sub: 'La web vuelve al valor original del código. Las versiones quedan en el historial.',
    confirmLabel: 'Retirar',
    note: { label: 'Motivo', required: true },
    password: true,
    run: (v) => unpublishAction(def.key, v.note, v.password),
  }

  const isPublishStep = status === 'approved' || (!sensitive && status === 'in_review')

  return (
    <>
      <div className="uc-cfg-layout">
        <div className="uc-cfg-stack">
          <section className="uc-card uc-pad">
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
              {open ? <StatusBadge status={open.status} /> : <span className="uc-badge uc-neutral">Sin borrador</span>}
              {open ? <span className="uc-muted">v{open.version} · {open.authorEmail ?? 'autor desconocido'}</span> : null}
            </div>
            {open?.reviewNote && status === 'draft' ? (
              <Callout icon="alert" title="Devuelto con comentarios">
                {open.reviewNote}
              </Callout>
            ) : null}
            {!me.canEdit ? <p className="uc-muted">Tu rol puede ver este contenido pero no editarlo.</p> : null}
            <form
              className="uc-cfg-form"
              onSubmit={(e) => {
                e.preventDefault()
                if (editable) save()
              }}
            >
              {fieldsRoot.map((f) => (
                <Field
                  key={f.name}
                  spec={f}
                  value={(value as Record<string, unknown>)?.[f.name]}
                  disabled={!editable || pending}
                  errors={errors}
                  path={pathKey(f.name, [])}
                  onChange={(v) => setValue((cur: unknown) => ({ ...(cur as Record<string, unknown>), [f.name]: v }))}
                />
              ))}
              {sensitive ? (
                <label className="uc-cfg-check">
                  <input type="checkbox" checked={publicVisible} disabled={!editable || pending} onChange={(e) => setPublicVisible(e.target.checked)} />
                  <span>
                    Visible en la web pública
                    <span className="uc-cfg-help" style={{ display: 'block' }}>
                      Por defecto desmarcado: aunque se publique, el valor queda oculto hasta que dirección y asesoría legal lo aprueben.
                    </span>
                  </span>
                </label>
              ) : null}
              <label className="uc-cfg-lbl">
                <span>Motivo del cambio (obligatorio)</span>
                <input className="uc-field" value={reason} maxLength={500} disabled={!editable || pending} onChange={(e) => setReason(e.target.value)} placeholder="Ej.: ajuste aprobado en la reunión del 10/10" />
              </label>
              {formError ? (
                <p className="uc-cfg-err" role="alert" style={{ margin: 0 }}>
                  {formError}
                </p>
              ) : null}
              <div className="uc-cfg-actions">
                {editable ? (
                  <button type="submit" className="uc-btn uc-primary" disabled={pending || (!dirty && Boolean(open)) || reason.trim().length < 5}>
                    {pending ? 'Guardando…' : open ? 'Guardar borrador' : 'Crear borrador'}
                  </button>
                ) : null}
                {status === 'draft' && me.canEdit ? (
                  <>
                    <button type="button" className="uc-btn" disabled={dirty || pending} title={dirty ? 'Guardá los cambios primero' : undefined} onClick={() => setDialog(dlgSubmit)}>
                      Enviar a revisión
                    </button>
                    <button type="button" className="uc-btn" disabled={pending} onClick={() => setDialog(dlgDiscard)}>
                      Descartar borrador
                    </button>
                  </>
                ) : null}
              </div>
            </form>
          </section>

          {open && (status === 'in_review' || status === 'approved') ? (
            <section className="uc-card uc-pad">
              <h2 style={{ fontSize: 15, margin: '0 0 8px' }}>Revisión</h2>
              {status === 'approved' ? (
                <p className="uc-muted" style={{ marginTop: 0 }}>
                  Aprobado por {open.approvedByEmail ?? 'otro administrador'}. Falta publicar.
                </p>
              ) : sensitive && authorLike ? (
                <Callout icon="lock" title="Necesita a otro administrador">
                  Este contenido es sensible: lo tiene que aprobar un administrador distinto de quien lo escribió, con el permiso {def.sensitivity === 'pricing' ? 'pricing.publish' : 'content.publish'}.
                </Callout>
              ) : null}
              <div className="uc-cfg-actions">
                {me.canApprove && status === 'in_review' && sensitive && !authorLike ? (
                  <button type="button" className="uc-btn uc-primary" onClick={() => setDialog(dlgApprove)}>
                    Aprobar
                  </button>
                ) : null}
                {me.canApprove && isPublishStep ? (
                  <button type="button" className="uc-btn uc-primary" onClick={() => setDialog(dlgPublish)}>
                    Publicar
                  </button>
                ) : null}
                {(me.canApprove || me.canEdit) && !pending ? (
                  <button type="button" className="uc-btn" onClick={() => setDialog(dlgReturn)}>
                    Devolver a borrador
                  </button>
                ) : null}
              </div>
              {!me.canApprove ? <p className="uc-muted" style={{ marginBottom: 0 }}>Tu rol no puede aprobar ni publicar este contenido.</p> : null}
            </section>
          ) : null}

          {published && me.canApprove ? (
            <section className="uc-card uc-pad">
              <h2 style={{ fontSize: 15, margin: '0 0 8px' }}>Versión publicada: v{published.version}</h2>
              <p className="uc-muted" style={{ marginTop: 0 }}>
                {sensitive ? (published.publicVisible ? 'Se muestra en la web pública.' : 'Publicada pero oculta en la web pública.') : 'Se muestra en la web.'}
              </p>
              <button type="button" className="uc-btn" onClick={() => setDialog(dlgUnpublish)}>
                Dejar de publicar
              </button>
            </section>
          ) : null}
        </div>

        <div className="uc-cfg-stack">
          <section className="uc-card uc-pad">
            <h2 style={{ fontSize: 15, margin: '0 0 10px' }}>Vista previa del borrador</h2>
            <ConfigPreview kind={def.preview} value={value} fields={def.fields} />
          </section>
          <section className="uc-card uc-pad">
            <h2 style={{ fontSize: 15, margin: '0 0 10px' }}>Cambios respecto de: {baselineLabel}</h2>
            <DiffTable before={baseline} after={value} fields={def.fields} beforeLabel={baselineLabel} afterLabel="Borrador" />
          </section>
        </div>
      </div>
      <ActionDialog spec={dialog} onClose={() => setDialog(null)} onDone={done} />
    </>
  )
}
