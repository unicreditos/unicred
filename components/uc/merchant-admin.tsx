'use client'

import { useEffect, useId, useRef, useState, useTransition, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  createMerchantAdmin, decideMerchantAction, editMerchantFields, reviewMerchantDocument, sendMerchantMessage, setMerchantFlag,
  type MerchantActionResult,
} from '@/app/admin/comercios/actions'
import { actionLabel, type MerchantAction } from '@/lib/merchant-admin-core'

/** Diálogo con campo de texto, resultado en toast, 409 explícito y recarga de la ficha. */
function useRun() {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  function run(fn: () => Promise<MerchantActionResult>, ok: string, done?: () => void) {
    setError(null)
    start(async () => {
      const r = await fn()
      if (r.ok) { toast.success(ok); done?.(); router.refresh() } else {
        setError(r.error)
        if (r.conflict) router.refresh()
      }
    })
  }
  return { pending, error, setError, run }
}

function Dialog({ title, sub, open, onClose, children }: { title: string; sub?: string; open: boolean; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null)
  const uid = useId()
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])
  return (
    <dialog ref={ref} className="uc-dlg" aria-labelledby={`${uid}-t`} onClose={onClose} onClick={(e) => { if (e.target === ref.current) onClose() }}>
      <header><h2 id={`${uid}-t`}>{title}</h2>{sub ? <p>{sub}</p> : null}</header>
      {children}
    </dialog>
  )
}

export function StateActions({ id, updatedAt, actions }: { id: string; updatedAt: string; actions: MerchantAction[] }) {
  const [act, setAct] = useState<MerchantAction | null>(null)
  const [reason, setReason] = useState('')
  const { pending, error, setError, run } = useRun()
  const needs = act === 'reject' || act === 'suspend'
  return (
    <>
      {actions.map((a) => (
        <button key={a} type="button" className={`uc-btn${a === 'approve' || a === 'reactivate' ? ' uc-primary' : ''}`} onClick={() => { setAct(a); setReason(''); setError(null) }}>{actionLabel(a)}</button>
      ))}
      <Dialog open={act !== null} onClose={() => setAct(null)} title={act ? `${actionLabel(act)} comercio` : ''} sub="Decisión humana: queda registrada con tu usuario, la fecha y el motivo.">
        <label className="uc-fl" style={{ display: 'grid', gap: 6, margin: '12px 0' }}>
          <span>Motivo{needs ? ' (obligatorio)' : ' (opcional)'}</span>
          <textarea className="uc-field" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />
        </label>
        {error ? <p role="alert" style={{ color: 'var(--uc-danger)' }}>{error}</p> : null}
        <footer style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" className="uc-btn" onClick={() => setAct(null)} disabled={pending}>Cancelar</button>
          <button type="button" className="uc-btn uc-primary" disabled={pending || (needs && reason.trim().length < 5)} onClick={() => run(() => decideMerchantAction(id, act!, updatedAt, reason), 'Listo', () => setAct(null))}>
            {pending ? 'Guardando…' : 'Confirmar'}
          </button>
        </footer>
      </Dialog>
    </>
  )
}

export function EditForm({ id, updatedAt, initial, canEdit }: { id: string; updatedAt: string; initial: Record<string, string>; canEdit: boolean }) {
  const [v, setV] = useState(initial)
  const { pending, error, run } = useRun()
  const labels: Array<[string, string]> = [['businessName', 'Nombre comercial'], ['legalName', 'Razón social'], ['category', 'Rubro'], ['phone', 'Teléfono'], ['province', 'Provincia'], ['city', 'Ciudad'], ['address', 'Domicilio']]
  return (
    <form onSubmit={(e) => { e.preventDefault(); run(() => editMerchantFields(id, updatedAt, v), 'Datos guardados') }}>
      <div className="uc-form-grid">
        {labels.map(([k, l]) => (
          <label key={k} className="uc-fl" style={{ display: 'grid', gap: 6 }}>
            <span>{l}</span>
            <input className="uc-field" value={v[k] ?? ''} disabled={!canEdit} onChange={(e) => setV({ ...v, [k]: e.target.value })} maxLength={200} />
          </label>
        ))}
      </div>
      <p className="uc-muted" style={{ fontSize: 12.5 }}>El CUIT y la comisión no se editan desde acá.</p>
      {error ? <p role="alert" style={{ color: 'var(--uc-danger)' }}>{error}</p> : null}
      {canEdit ? <button type="submit" className="uc-btn uc-primary" disabled={pending}>{pending ? 'Guardando…' : 'Guardar cambios'}</button> : null}
    </form>
  )
}

export function FlagToggles({ id, flags, canEdit, active }: { id: string; flags: Array<{ key: string; label: string; on: boolean }>; canEdit: boolean; active: boolean }) {
  const { pending, error, run } = useRun()
  return (
    <div>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 10 }}>
        {flags.map((f) => (
          <li key={f.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <span>{f.label}</span>
            <button type="button" role="switch" aria-checked={f.on} aria-label={`${f.label}: ${f.on ? 'habilitado' : 'deshabilitado'}`} className={`uc-btn${f.on ? ' uc-primary' : ''}`} disabled={!canEdit || pending || (!f.on && !active)} onClick={() => run(() => setMerchantFlag(id, f.key, !f.on), `${f.label} ${f.on ? 'deshabilitado' : 'habilitado'}`)}>
              {f.on ? 'Habilitado' : 'Deshabilitado'}
            </button>
          </li>
        ))}
      </ul>
      <p className="uc-muted" style={{ fontSize: 12.5, marginTop: 10 }}>Pendiente de integración: hoy son banderas internas. No se crea sucursal, caja ni QR en Mercado Pago.</p>
      {!active ? <p className="uc-muted" style={{ fontSize: 12.5 }}>Se habilitan solo cuando el comercio está activo.</p> : null}
      {error ? <p role="alert" style={{ color: 'var(--uc-danger)' }}>{error}</p> : null}
    </div>
  )
}

export function DocReviewButtons({ merchantId, documentId }: { merchantId: string; documentId: string }) {
  const [open, setOpen] = useState(false)
  const [note, setNote] = useState('')
  const { pending, error, setError, run } = useRun()
  return (
    <>
      <button type="button" className="uc-row-action" disabled={pending} onClick={() => run(() => reviewMerchantDocument(merchantId, documentId, 'approved', ''), 'Documento aprobado')}>Aprobar</button>
      <button type="button" className="uc-row-action" onClick={() => { setOpen(true); setError(null); setNote('') }}>Observar</button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Observar documento" sub="Se le avisa al comercio qué corregir y puede volver a subirlo.">
        <label className="uc-fl" style={{ display: 'grid', gap: 6, margin: '12px 0' }}>
          <span>Qué hay que corregir</span>
          <textarea className="uc-field" rows={3} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
        </label>
        {error ? <p role="alert" style={{ color: 'var(--uc-danger)' }}>{error}</p> : null}
        <footer style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" className="uc-btn" onClick={() => setOpen(false)}>Cancelar</button>
          <button type="button" className="uc-btn uc-primary" disabled={pending || note.trim().length < 5} onClick={() => run(() => reviewMerchantDocument(merchantId, documentId, 'observed', note), 'Documento observado', () => setOpen(false))}>Enviar observación</button>
        </footer>
      </Dialog>
    </>
  )
}

export function MessageComposer({ merchantId, docOptions }: { merchantId: string; docOptions: Array<{ value: string; label: string }> }) {
  const [body, setBody] = useState('')
  const [doc, setDoc] = useState('')
  const { pending, error, run } = useRun()
  return (
    <form onSubmit={(e) => { e.preventDefault(); run(() => sendMerchantMessage(merchantId, body, doc || null), 'Mensaje enviado', () => { setBody(''); setDoc('') }) }} style={{ display: 'grid', gap: 10 }}>
      <label className="uc-fl" style={{ display: 'grid', gap: 6 }}>
        <span>Pedir un documento (opcional)</span>
        <select className="uc-field" value={doc} onChange={(e) => setDoc(e.target.value)}>
          <option value="">Mensaje sin documento</option>
          {docOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </label>
      <label className="uc-fl" style={{ display: 'grid', gap: 6 }}>
        <span>Mensaje al comercio</span>
        <textarea className="uc-field" rows={3} value={body} onChange={(e) => setBody(e.target.value)} maxLength={2000} placeholder="Ej.: Necesitamos el estatuto vigente para completar la verificación." />
      </label>
      {error ? <p role="alert" style={{ color: 'var(--uc-danger)' }}>{error}</p> : null}
      <div><button type="submit" className="uc-btn uc-primary" disabled={pending || body.trim().length < 3}>{pending ? 'Enviando…' : 'Enviar mensaje'}</button></div>
    </form>
  )
}

export function CreateMerchantForm() {
  const router = useRouter()
  const [v, setV] = useState({ ownerEmail: '', businessName: '', cuit: '', category: '', province: '', city: '', address: '', phone: '' })
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const fields: Array<[keyof typeof v, string, string?]> = [['ownerEmail', 'Mail del usuario titular (ya registrado)', 'email'], ['businessName', 'Nombre comercial'], ['cuit', 'CUIT'], ['category', 'Rubro'], ['province', 'Provincia'], ['city', 'Ciudad'], ['address', 'Domicilio'], ['phone', 'Teléfono']]
  return (
    <form onSubmit={(e) => { e.preventDefault(); setError(null); start(async () => { const r = await createMerchantAdmin(v); if (r.ok) { toast.success('Comercio creado: queda pendiente de documentación'); router.push(`/admin/comercios/${r.id}`) } else setError(r.error) }) }}>
      <div className="uc-form-grid">
        {fields.map(([k, l, t]) => (
          <label key={k} className="uc-fl" style={{ display: 'grid', gap: 6 }}>
            <span>{l}</span>
            <input className="uc-field" type={t ?? 'text'} value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })} required={k === 'ownerEmail' || k === 'businessName' || k === 'cuit'} maxLength={200} />
          </label>
        ))}
      </div>
      {error ? <p role="alert" style={{ color: 'var(--uc-danger)' }}>{error}</p> : null}
      <p className="uc-muted" style={{ fontSize: 12.5 }}>El comercio nace pendiente. Se habilita solo después de la verificación ARCA, Didit y la documentación.</p>
      <button type="submit" className="uc-btn uc-primary" disabled={pending}>{pending ? 'Creando…' : 'Crear comercio'}</button>
    </form>
  )
}
