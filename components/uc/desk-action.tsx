'use client'

import { useId, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { runDeskAction } from '@/app/admin/actions'
import { Icon } from '@/components/uc/icons'
import type { DeskRowAction } from '@/components/uc/grid-types'

/**
 * Botón de fila + diálogo de confirmación. Toda acción que cambia un crédito, un pago
 * o una identidad pasa por acá: resumen de lo que se va a hacer, nota (a veces
 * obligatoria) y confirmación explícita. El permiso lo vuelve a validar el servidor.
 */
export function DeskActionButton({ spec }: { spec: DeskRowAction }) {
  const router = useRouter()
  const dlg = useRef<HTMLDialogElement>(null)
  const [text, setText] = useState('')
  const [picked, setPicked] = useState(spec.choice?.options[0]?.value ?? '')
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const uid = useId()

  const minLength = spec.field?.minLength ?? (spec.field?.required ? 3 : 0)
  const missing = Boolean(spec.field?.required) && text.trim().length < minLength

  function open() {
    setError(null)
    setText('')
    dlg.current?.showModal()
  }
  const close = () => dlg.current?.close()

  function confirm() {
    if (missing) return
    setError(null)
    start(async () => {
      const payload = {
        ...spec.payload,
        ...(spec.field ? { [spec.field.name]: text.trim() } : {}),
        ...(spec.choice ? { [spec.choice.name]: picked } : {}),
      }
      const res = await runDeskAction(spec.action, payload)
      if (res.ok) {
        toast.success(spec.success)
        close()
        router.refresh()
      } else {
        setError(res.error)
      }
    })
  }

  return (
    <>
      <button type="button" className="uc-row-action" onClick={open}>
        {spec.icon ? <Icon name={spec.icon} size="xs" /> : null}
        {spec.label}
      </button>
      <dialog
        ref={dlg}
        className="uc-dlg"
        aria-labelledby={`${uid}-t`}
        onClick={(e) => {
          if (e.target === dlg.current && !pending) close()
        }}
      >
        <header>
          <h2 id={`${uid}-t`}>{spec.title}</h2>
          {spec.sub ? <p>{spec.sub}</p> : null}
        </header>
        <div className="uc-body">
          {spec.warning ? (
            <div className="uc-req">
              <Icon name="alert" size="sm" />
              <span>{spec.warning}</span>
            </div>
          ) : null}
          {spec.summary?.length ? (
            <dl className="uc-kv-row">
              {spec.summary.map(([k, v]) => (
                <div key={k} style={{ display: 'contents' }}>
                  <dt style={{ color: 'var(--uc-text-muted)' }}>{k}</dt>
                  <dd style={{ margin: 0, fontWeight: 600 }}>{v}</dd>
                </div>
              ))}
            </dl>
          ) : null}
          {spec.choice ? (
            <label className="uc-fl" htmlFor={`${uid}-c`}>
              {spec.choice.label}
              <select id={`${uid}-c`} className="uc-field" value={picked} onChange={(e) => setPicked(e.target.value)}>
                {spec.choice.options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {spec.field ? (
            <label className="uc-fl" htmlFor={`${uid}-f`}>
              {spec.field.label}
              {spec.field.required ? ' (obligatorio)' : ''}
              <textarea
                id={`${uid}-f`}
                className="uc-field"
                value={text}
                maxLength={300}
                placeholder={spec.field.placeholder}
                onChange={(e) => setText(e.target.value)}
              />
              {minLength > 3 ? <span className="uc-note">Mínimo {minLength} caracteres.</span> : null}
            </label>
          ) : null}
          {error ? (
            <p className="uc-error" role="alert">
              {error}
            </p>
          ) : null}
        </div>
        <footer>
          <button type="button" className="uc-btn" onClick={close} disabled={pending}>
            Cancelar
          </button>
          <button type="button" className="uc-btn uc-primary" onClick={confirm} disabled={pending || missing}>
            {pending ? 'Procesando…' : spec.confirmLabel}
          </button>
        </footer>
      </dialog>
    </>
  )
}
