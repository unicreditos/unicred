'use client'

import { useId, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { runDeskAction } from '@/app/admin/actions'

type Props = {
  applicationId: string
  expectedUpdatedAt: string
  status: string
  canEdit: boolean
  amount: number
  installments: number
  minAmount: number
  maxAmount: number
  minTerm: number
  maxTerm: number
  /** El contrato ya fue firmado: reabrir pide una confirmación adicional. */
  contractAccepted: boolean
  /** Operación ejecutada (desembolso/pagos/vigente): no se puede reabrir ni editar. */
  locked: boolean
  lockedReason?: string
}

/** Reabrir a pendiente y editar condiciones. Motivo obligatorio; el servidor vuelve a validar permiso, reglas y versión (409). */
export function LoanAdminActions(p: Props) {
  const router = useRouter()
  const uid = useId()
  const reopenDlg = useRef<HTMLDialogElement>(null)
  const editDlg = useRef<HTMLDialogElement>(null)
  const [reason, setReason] = useState('')
  const [amount, setAmount] = useState(String(p.amount))
  const [installments, setInstallments] = useState(String(p.installments))
  const [confirmSigned, setConfirmSigned] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [conflict, setConflict] = useState(false)
  const [pending, start] = useTransition()
  const tooShort = reason.trim().length < 10

  function run(action: 'reopenApplication' | 'editApplication', dlg: React.RefObject<HTMLDialogElement | null>, ok: string) {
    setError(null)
    setConflict(false)
    start(async () => {
      const res = await runDeskAction(action, {
        applicationId: p.applicationId,
        expectedUpdatedAt: p.expectedUpdatedAt,
        reason: reason.trim(),
        ...(action === 'editApplication' ? { amount: Number(amount), installments: Number(installments) } : { confirmSigned }),
      })
      if (res.ok) {
        toast.success(ok)
        dlg.current?.close()
        setReason('')
        router.refresh()
      } else {
        setConflict(res.code === 'conflict')
        setError(res.error)
      }
    })
  }

  const canReopen = p.status !== 'pending' && !p.locked
  if (!canReopen && !(p.canEdit && p.status === 'pending')) {
    return p.locked && p.lockedReason ? <p className="uc-note">{p.lockedReason}</p> : null
  }

  const reasonField = (
    <label className="uc-fl" htmlFor={`${uid}-r`}>
      Motivo (obligatorio, queda en Auditoría)
      <textarea id={`${uid}-r`} className="uc-field" value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} placeholder="Ej.: el cliente corrigió su ingreso declarado" />
    </label>
  )
  const err = error ? (
    <p className="uc-error" role="alert">
      {error}{' '}
      {conflict ? (
        <button type="button" className="uc-btn" onClick={() => router.refresh()}>
          Recargar
        </button>
      ) : null}
    </p>
  ) : null

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <div className="uc-cta-row">
        {canReopen ? (
          <button type="button" className="uc-row-action" onClick={() => { setError(null); reopenDlg.current?.showModal() }}>
            Volver a pendiente
          </button>
        ) : null}
        {p.canEdit && p.status === 'pending' ? (
          <button type="button" className="uc-row-action" onClick={() => { setError(null); editDlg.current?.showModal() }}>
            Editar condiciones
          </button>
        ) : null}
      </div>
      {p.locked && p.lockedReason ? <p className="uc-note">{p.lockedReason}</p> : null}

      <dialog ref={reopenDlg} className="uc-dlg" aria-labelledby={`${uid}-t1`}>
        <header>
          <h2 id={`${uid}-t1`}>Volver la solicitud a pendiente</h2>
          <p>La decisión anterior queda en el historial. Después la decide una persona.</p>
        </header>
        <div className="uc-body">
          {p.contractAccepted ? (
            <div className="uc-req">
              <span>El cliente ya firmó el contrato. Reabrir exige una confirmación adicional.</span>
              <label style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <input type="checkbox" checked={confirmSigned} onChange={(e) => setConfirmSigned(e.target.checked)} />
                Entiendo que el contrato firmado queda sujeto a revisión
              </label>
            </div>
          ) : null}
          {reasonField}
          {err}
        </div>
        <footer>
          <button type="button" className="uc-btn" onClick={() => reopenDlg.current?.close()} disabled={pending}>Cancelar</button>
          <button type="button" className="uc-btn uc-primary" disabled={pending || tooShort || (p.contractAccepted && !confirmSigned)} onClick={() => run('reopenApplication', reopenDlg, 'Solicitud vuelta a pendiente.')}>
            {pending ? 'Procesando…' : 'Volver a pendiente'}
          </button>
        </footer>
      </dialog>

      <dialog ref={editDlg} className="uc-dlg" aria-labelledby={`${uid}-t2`}>
        <header>
          <h2 id={`${uid}-t2`}>Editar condiciones</h2>
          <p>Las cuotas y el costo se recalculan con la tasa del crédito. Rango: {p.minAmount.toLocaleString('es-AR')} a {p.maxAmount.toLocaleString('es-AR')} · {p.minTerm} a {p.maxTerm} cuotas.</p>
        </header>
        <div className="uc-body">
          <label className="uc-fl" htmlFor={`${uid}-a`}>
            Importe
            <input id={`${uid}-a`} className="uc-field" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </label>
          <label className="uc-fl" htmlFor={`${uid}-n`}>
            Cuotas
            <input id={`${uid}-n`} className="uc-field" inputMode="numeric" value={installments} onChange={(e) => setInstallments(e.target.value)} />
          </label>
          {reasonField}
          {err}
        </div>
        <footer>
          <button type="button" className="uc-btn" onClick={() => editDlg.current?.close()} disabled={pending}>Cancelar</button>
          <button type="button" className="uc-btn uc-primary" disabled={pending || tooShort} onClick={() => run('editApplication', editDlg, 'Condiciones actualizadas.')}>
            {pending ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </footer>
      </dialog>
    </div>
  )
}
