'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { acceptLoanContract, generateBCRAReport, generateLoanContract } from '@/app/actions/documents'

function useRun() {
  const router = useRouter()
  const [pending, start] = useTransition()
  const run = (task: () => Promise<string>, fallback: string) =>
    start(async () => {
      try {
        toast.success(await task())
        router.refresh()
      } catch (e) {
        toast.error(e instanceof Error ? e.message : fallback)
      }
    })
  return { pending, run }
}

export function GenerateContractButton({ loanId }: { loanId: string }) {
  const { pending, run } = useRun()
  return (
    <button
      type="button"
      disabled={pending}
      className="uc-btn uc-primary"
      onClick={() =>
        run(async () => {
          await generateLoanContract(loanId)
          return 'Contrato generado. Revisalo y firmalo.'
        }, 'No se pudo generar el contrato.')
      }
    >
      {pending ? 'Generando…' : 'Generar contrato'}
    </button>
  )
}

export function GenerateBcraButton() {
  const { pending, run } = useRun()
  return (
    <button
      type="button"
      disabled={pending}
      className="uc-btn"
      onClick={() =>
        run(async () => {
          const r = await generateBCRAReport()
          return `Informe ${r.reportNumber} generado.`
        }, 'No se pudo generar el informe.')
      }
    >
      {pending ? 'Generando…' : 'Generar informe BCRA'}
    </button>
  )
}

/** Firma por aceptación expresa: el contrato y el pagaré se aceptan juntos. */
export function AcceptContractBar({ contractId, merchantSale = false }: { contractId: string; merchantSale?: boolean }) {
  const { pending, run } = useRun()
  const [agree, setAgree] = useState(false)
  return (
    <div className="uc-card uc-pad no-print" style={{ borderLeft: '4px solid var(--uc-accent)' }}>
      <div className="uc-card-h">
        <h2>Firmar contrato y pagaré</h2>
      </div>
      <p className="uc-muted" style={{ margin: '0 0 14px' }}>
        Leé el documento completo. Al aceptar, queda firmado el expediente
        {merchantSale
          ? ' de tu compra en cuotas: con el anticipo acreditado retirás el producto en el comercio y ahí empieza el crédito.'
          : ' y el crédito pasa a acreditarse en tu cuenta.'}{' '}
        Tenés derecho a arrepentirte
        según la normativa vigente: si lo necesitás, presentalo desde Ayuda → Reclamos y consultas.
      </p>
      <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer' }}>
        <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} style={{ marginTop: 3, accentColor: 'var(--uc-accent)' }} />
        <span>Leí el contrato y el pagaré, entiendo el costo financiero total y los acepto.</span>
      </label>
      <button
        type="button"
        disabled={!agree || pending}
        className="uc-btn uc-primary uc-lg"
        style={{ marginTop: 16 }}
        onClick={() =>
          run(async () => {
            await acceptLoanContract(contractId, { ua: window.navigator.userAgent })
            return 'Contrato y pagaré aceptados. El expediente quedó firmado.'
          }, 'No se pudo firmar el contrato.')
        }
      >
        {pending ? 'Firmando…' : 'Aceptar y firmar'}
      </button>
    </div>
  )
}
