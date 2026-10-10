'use client'

import { useId, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  changeOperatorEmailAction,
  changeOperatorPasswordAction,
  deleteOperatorAction,
  resendOperatorVerificationAction,
  type OperatorActionResult,
} from '@/app/actions/operators'
import type { OperatorRow } from '@/lib/operators/service'

type Mode = 'password' | 'email' | 'resend' | 'delete'

const TITLE: Record<Mode, string> = {
  password: 'Cambiar clave',
  email: 'Cambiar email',
  resend: 'Reenviar verificación',
  delete: 'Eliminar operador',
}

/**
 * Gestión de operadores: clave, email, reenvío de verificación y baja. Cada acción pide la
 * clave de quien la hace; el servidor vuelve a validar permiso, reglas y límites.
 */
export function OperatorManager({ rows, selfId }: { rows: OperatorRow[]; selfId: string }) {
  const router = useRouter()
  const dlg = useRef<HTMLDialogElement>(null)
  const uid = useId()
  const [target, setTarget] = useState<OperatorRow | null>(null)
  const [mode, setMode] = useState<Mode>('password')
  const [actorPassword, setActorPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newPassword2, setNewPassword2] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [confirmEmail, setConfirmEmail] = useState('')
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  function open(row: OperatorRow, m: Mode) {
    setTarget(row)
    setMode(m)
    setActorPassword('')
    setNewPassword('')
    setNewPassword2('')
    setNewEmail('')
    setConfirmEmail('')
    setReason('')
    setError(null)
    dlg.current?.showModal()
  }
  const close = () => dlg.current?.close()

  const invalid =
    !target ||
    actorPassword.length === 0 ||
    (mode === 'password' && (newPassword.length < 12 || newPassword !== newPassword2)) ||
    (mode === 'email' && !/^\S+@\S+\.\S+$/.test(newEmail.trim())) ||
    (mode === 'delete' && (confirmEmail.trim().toLowerCase() !== target.email.toLowerCase() || reason.trim().length < 10))

  function submit() {
    if (!target || invalid) return
    setError(null)
    start(async () => {
      let res: OperatorActionResult
      if (mode === 'password') res = await changeOperatorPasswordAction({ targetId: target.id, newPassword, actorPassword })
      else if (mode === 'email') res = await changeOperatorEmailAction({ targetId: target.id, newEmail, actorPassword })
      else if (mode === 'resend') res = await resendOperatorVerificationAction({ targetId: target.id, actorPassword })
      else res = await deleteOperatorAction({ targetId: target.id, confirmEmail, reason, actorPassword })
      setActorPassword('')
      setNewPassword('')
      setNewPassword2('')
      if (res.ok) {
        toast.success(res.message)
        close()
        router.refresh()
      } else {
        setError(res.message)
      }
    })
  }

  return (
    <section aria-label="Gestionar operadores" style={{ marginBottom: 24 }}>
      <h2 style={{ fontSize: 16, margin: '0 0 4px' }}>Gestionar operadores</h2>
      <p style={{ margin: '0 0 12px', color: 'var(--uc-text-muted)', fontSize: 13 }}>
        Cambiá clave o email, reenviá la verificación o dá de baja operadores. Cada acción pide tu clave y queda en auditoría.
      </p>
      <div style={{ display: 'grid', gap: 8 }}>
        {rows.map((r) => {
          const self = r.id === selfId
          return (
            <div
              key={r.id}
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 8,
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 12px',
                border: '1px solid var(--uc-border, #e5e7eb)',
                borderRadius: 10,
              }}
            >
              <div style={{ minWidth: 0, flex: '1 1 240px' }}>
                <div style={{ fontWeight: 600, overflowWrap: 'anywhere' }}>
                  {r.name} {self ? <span style={{ fontWeight: 400, color: 'var(--uc-text-muted)' }}>(vos)</span> : null}
                </div>
                <div style={{ fontSize: 13, color: 'var(--uc-text-muted)', overflowWrap: 'anywhere' }}>{r.email}</div>
                <div style={{ fontSize: 12, marginTop: 2 }}>
                  {r.roleLabel} · {r.banned ? 'Bloqueado' : 'Activo'} ·{' '}
                  {r.verified ? 'Email verificado' : 'Email sin verificar'}
                  {r.placeholder ? ' · Email de prueba (no recibe correo)' : ''}
                </div>
              </div>
              <div className="uc-row-actions" style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {!self ? (
                  <>
                    <button type="button" className="uc-row-action" onClick={() => open(r, 'password')}>
                      Cambiar clave
                    </button>
                    <button type="button" className="uc-row-action" onClick={() => open(r, 'email')}>
                      Editar email
                    </button>
                  </>
                ) : null}
                {!r.verified ? (
                  <button type="button" className="uc-row-action" onClick={() => open(r, 'resend')}>
                    Reenviar verificación
                  </button>
                ) : null}
                {!self ? (
                  <button type="button" className="uc-row-action" onClick={() => open(r, 'delete')}>
                    Eliminar
                  </button>
                ) : null}
              </div>
            </div>
          )
        })}
        {rows.length === 0 ? <p>No hay operadores.</p> : null}
      </div>

      <dialog
        ref={dlg}
        className="uc-dlg"
        aria-labelledby={`${uid}-t`}
        onClick={(e) => {
          if (e.target === dlg.current && !pending) close()
        }}
      >
        <header>
          <h2 id={`${uid}-t`}>{TITLE[mode]}</h2>
          {target ? <p style={{ overflowWrap: 'anywhere' }}>{target.name} · {target.email}</p> : null}
        </header>
        <div className="uc-body">
          {mode === 'password' ? (
            <>
              <label className="uc-fl" htmlFor={`${uid}-np`}>
                Nueva clave (mínimo 12 caracteres)
                <input id={`${uid}-np`} type="password" className="uc-field" autoComplete="new-password" value={newPassword} maxLength={128} onChange={(e) => setNewPassword(e.target.value)} />
              </label>
              <label className="uc-fl" htmlFor={`${uid}-np2`}>
                Repetí la nueva clave
                <input id={`${uid}-np2`} type="password" className="uc-field" autoComplete="new-password" value={newPassword2} maxLength={128} onChange={(e) => setNewPassword2(e.target.value)} />
              </label>
              {newPassword2 && newPassword !== newPassword2 ? <p className="uc-error">Las claves no coinciden.</p> : null}
              <p style={{ fontSize: 12, color: 'var(--uc-text-muted)' }}>Se cierran todas las sesiones del operador. La clave no se envía por correo: pasásela por un canal seguro.</p>
            </>
          ) : null}
          {mode === 'email' ? (
            <>
              <label className="uc-fl" htmlFor={`${uid}-ne`}>
                Nuevo email
                <input id={`${uid}-ne`} type="email" className="uc-field" autoComplete="off" value={newEmail} maxLength={254} onChange={(e) => setNewEmail(e.target.value)} />
              </label>
              <p style={{ fontSize: 12, color: 'var(--uc-text-muted)' }}>Queda sin verificar, se cierran sus sesiones y se envía la verificación al nuevo email si el correo está configurado.</p>
            </>
          ) : null}
          {mode === 'resend' ? (
            <p style={{ fontSize: 13 }}>Se reenvía el correo de verificación a {target?.email}. Máximo 3 por hora por operador.</p>
          ) : null}
          {mode === 'delete' ? (
            <>
              <div className="uc-req"><span>Si tiene historial no se borra: se desactiva y se anonimiza su email. Los clientes no se eliminan desde acá.</span></div>
              <label className="uc-fl" htmlFor={`${uid}-ce`}>
                Para confirmar, escribí el email del operador
                <input id={`${uid}-ce`} type="text" className="uc-field" autoComplete="off" value={confirmEmail} onChange={(e) => setConfirmEmail(e.target.value)} />
              </label>
              <label className="uc-fl" htmlFor={`${uid}-rs`}>
                Motivo (obligatorio, mínimo 10 caracteres)
                <textarea id={`${uid}-rs`} className="uc-field" value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} />
              </label>
            </>
          ) : null}
          <label className="uc-fl" htmlFor={`${uid}-ap`}>
            Tu clave actual (para confirmar que sos vos)
            <input id={`${uid}-ap`} type="password" className="uc-field" autoComplete="current-password" value={actorPassword} onChange={(e) => setActorPassword(e.target.value)} />
          </label>
          {error ? <p className="uc-error" role="alert">{error}</p> : null}
        </div>
        <footer>
          <button type="button" className="uc-btn" onClick={close} disabled={pending}>Cancelar</button>
          <button type="button" className="uc-btn uc-primary" onClick={submit} disabled={pending || invalid}>
            {pending ? 'Procesando…' : mode === 'delete' ? 'Eliminar' : mode === 'resend' ? 'Reenviar' : 'Guardar'}
          </button>
        </footer>
      </dialog>
    </section>
  )
}
