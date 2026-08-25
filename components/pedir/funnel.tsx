'use client'

import { createBankAccount, getMyBankAccounts } from '@/app/actions/banking'
import { getMyDiditSession } from '@/app/actions/didit'
import { evaluateLoanOffer, requestLoan, updateProfile } from '@/app/actions/loans'
import { DiditVerifyButton } from '@/components/didit-verify-button'
import { GeoArFields, type GeoValue } from '@/components/geo-ar-fields'
import { PedirAppShell } from '@/components/pedir/app-shell'
import { authClient, useSession } from '@/lib/auth-client'
import { computeFrenchAmortization, formatARS } from '@/lib/finance'
import { PERSONAL_QUOTE } from '@/lib/loan-catalog'
import { FIRST_CREDIT_HARD_CAP } from '@/lib/loan-underwriting'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useState, useTransition } from 'react'

const STEPS = ['Cuenta', 'Datos', 'Identidad', 'Cobro', 'Evaluación', 'Oferta'] as const

type OfferState = {
  maxAmount: number
  maxInstallment: number
  reason: string
  score: number
  band: string
  bindingLimit: string
}

type Props = {
  initialProfile: {
    cuil: string | null
    dni: string | null
    phone: string | null
    birthDate: string | null
    province: string | null
    department: string | null
    city: string | null
    postalCode: string | null
    address: string | null
    monthlyIncome: string | number | null
    employmentStatus: string | null
    kycStatus: string | null
  } | null
  kycApproved: boolean
  hasBank: boolean
  loggedIn: boolean
}

export function PedirFunnel({ initialProfile, kycApproved, hasBank, loggedIn }: Props) {
  const router = useRouter()
  const search = useSearchParams()
  const { data: session } = useSession()
  const isAuthed = Boolean(session?.user) || loggedIn

  const initialAmount = Number(search.get('monto')) || PERSONAL_QUOTE.referenceAmount
  const initialTerm = Number(search.get('plazo')) || PERSONAL_QUOTE.referenceTerm

  const startStep = !isAuthed ? 0 : !initialProfile?.cuil ? 1 : !kycApproved ? 2 : !hasBank ? 3 : 4
  const [step, setStep] = useState(startStep)
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [okMsg, setOkMsg] = useState<string | null>(null)
  const [diditOk, setDiditOk] = useState(kycApproved)
  const [bankOk, setBankOk] = useState(hasBank)

  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signup')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const [cuil, setCuil] = useState(initialProfile?.cuil ?? '')
  const [dni, setDni] = useState(initialProfile?.dni ?? '')
  const [phone, setPhone] = useState(initialProfile?.phone ?? '')
  const [birthDate, setBirthDate] = useState(initialProfile?.birthDate ?? '')
  const [address, setAddress] = useState(initialProfile?.address ?? '')
  const [income, setIncome] = useState(String(initialProfile?.monthlyIncome ?? ''))
  const [employment, setEmployment] = useState(initialProfile?.employmentStatus ?? 'Relación de dependencia')
  const [geo, setGeo] = useState<GeoValue>({
    province: initialProfile?.province ?? '',
    department: initialProfile?.department ?? '',
    city: initialProfile?.city ?? '',
    postalCode: initialProfile?.postalCode ?? '',
  })

  const [bankName, setBankName] = useState('')
  const [cbu, setCbu] = useState('')
  const [holderName, setHolderName] = useState(session?.user?.name ?? name)
  const [holderCuil, setHolderCuil] = useState(initialProfile?.cuil ?? '')

  const [amount, setAmount] = useState(
    Math.min(Math.max(initialAmount, PERSONAL_QUOTE.minAmount), FIRST_CREDIT_HARD_CAP),
  )
  const [term, setTerm] = useState(
    Math.min(Math.max(initialTerm, PERSONAL_QUOTE.minTerm), PERSONAL_QUOTE.maxTerm),
  )
  const [purpose, setPurpose] = useState('Uso personal / gastos del hogar')
  const [offer, setOffer] = useState<OfferState | null>(null)

  useEffect(() => {
    if (session?.user?.name) setHolderName((v) => v || session.user.name || '')
  }, [session?.user?.name])

  useEffect(() => {
    if (!isAuthed) return
    void getMyDiditSession().then((s) => {
      if (s?.status === 'approved' || s?.status === 'Approved') setDiditOk(true)
    }).catch(() => {})
    void getMyBankAccounts().then((rows) => {
      if (rows.length) setBankOk(true)
    }).catch(() => {})
  }, [isAuthed])

  const terms = useMemo(
    () => [3, 6, 9, 12, 18, 24, 36, 48].filter((t) => t >= PERSONAL_QUOTE.minTerm && t <= PERSONAL_QUOTE.maxTerm),
    [],
  )

  function goNext() {
    setError(null)
    setOkMsg(null)
    setStep((s) => Math.min(s + 1, STEPS.length - 1))
  }

  function submitAuth(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    start(async () => {
      const res =
        authMode === 'signup'
          ? await authClient.signUp.email({ email, password, name })
          : await authClient.signIn.email({ email, password, rememberMe: true })
      if (res.error) {
        setError(authMode === 'signup' ? 'No pudimos crear la cuenta. Probá con otro email.' : 'Email o contraseña incorrectos.')
        return
      }
      router.refresh()
      setStep(1)
    })
  }

  function submitProfile(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    start(async () => {
      try {
        await updateProfile({
          cuil,
          dni,
          phone,
          birthDate,
          province: geo.province,
          department: geo.department,
          city: geo.city,
          postalCode: geo.postalCode,
          address,
          monthlyIncome: Number(income),
          employmentStatus: employment,
        })
        setHolderCuil(cuil.replace(/\D/g, ''))
        setOkMsg('Datos guardados.')
        goNext()
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'No se pudieron guardar los datos.')
      }
    })
  }

  function submitBank(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    start(async () => {
      try {
        const digits = cbu.replace(/\D/g, '')
        const isCvu = digits.startsWith('000')
        await createBankAccount({
          accountType: isCvu ? 'cvu' : 'cbu',
          bankName: bankName || 'Cuenta de desembolso',
          ...(isCvu ? { cvu: digits } : { cbu: digits }),
          holderName: holderName.trim(),
          holderCuil: holderCuil.replace(/\D/g, ''),
          holderDocumentType: 'DNI',
          holderDocumentNumber: dni.replace(/\D/g, ''),
          setAsPrimary: true,
        })
        setBankOk(true)
        setOkMsg('Cuenta de desembolso guardada.')
        goNext()
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'No se pudo guardar la cuenta.')
      }
    })
  }

  function runEvaluation(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setOkMsg(null)
    start(async () => {
      const res = await evaluateLoanOffer({ productId: 'prod_personal', term })
      if (!res.ok) {
        setError(res.error)
        return
      }
      if (!res.offer.eligible) {
        setOffer(null)
        setError(
          `${res.offer.reason}${res.score != null ? ` Score: ${res.score}.` : ''}`,
        )
        return
      }
      const nextAmount = Math.min(
        Math.max(PERSONAL_QUOTE.minAmount, amount),
        res.offer.maxAmount,
      )
      setAmount(nextAmount)
      setOffer({
        maxAmount: res.offer.maxAmount,
        maxInstallment: res.offer.maxInstallment,
        reason: res.offer.reason,
        score: res.score,
        band: res.band,
        bindingLimit: res.offer.bindingLimit,
      })
      setOkMsg(`Evaluación lista · score ${res.score} (${res.band}).`)
      setStep(5)
    })
  }

  function submitLoan(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!offer) {
      setError('Primero corré la evaluación crediticia.')
      setStep(4)
      return
    }
    start(async () => {
      const res = await requestLoan({
        productId: 'prod_personal',
        amount,
        term,
        purpose,
      })
      if (!res.ok) {
        setError(res.error)
        if ('offerMaxAmount' in res && typeof res.offerMaxAmount === 'number' && res.offerMaxAmount > 0) {
          setOffer((prev) =>
            prev
              ? { ...prev, maxAmount: res.offerMaxAmount as number }
              : prev,
          )
          setAmount((a) => Math.min(a, res.offerMaxAmount as number))
        }
        return
      }
      if (res.status === 'rejected') {
        setOkMsg(null)
        setError(
          `${res.rejectionReason || 'Rechazado por la evaluación automática.'}${
            res.score != null ? ` Score: ${res.score}.` : ''
          }`,
        )
        return
      }
      if (res.status === 'pending') {
        setOkMsg(
          `Solicitud en evaluación manual${res.score != null ? ` (score ${res.score})` : ''}. Te avisamos cuando haya resolución.`,
        )
        router.push(`/pedir/cuenta?ok=1&loan=${res.loanId}`)
        router.refresh()
        return
      }
      setOkMsg(
        `Calificado${res.score != null ? ` · score ${res.score}` : ''}. Firmá el contrato en tu cuenta para habilitar el desembolso.`,
      )
      router.push(`/pedir/cuenta?ok=1&loan=${res.loanId}`)
      router.refresh()
    })
  }

  return (
    <PedirAppShell title="Solicitud" subtitle="Primero scoring y capacidad · después tu oferta">
      <div className="lp-app-panel">
        <div className="lp-progress">
          {STEPS.map((label, i) => (
            <div key={label} className="lp-progress-dot" data-on={i <= step} title={label} />
          ))}
        </div>
        <p className="mt-2 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--lp-muted)]">
          Paso {step + 1} · {STEPS[step]}
        </p>

        {error ? <div className="lp-alert lp-alert-err mt-5">{error}</div> : null}
        {okMsg ? <div className="lp-alert lp-alert-ok mt-5">{okMsg}</div> : null}

        <div className="mt-6">
            {step === 0 && (
              <form onSubmit={submitAuth} className="space-y-4">
                <div className="flex gap-2">
                  <button
                    type="button"
                    className={`lp-btn flex-1 py-2 text-sm ${authMode === 'signup' ? 'lp-btn-ink' : 'lp-btn-ghost'}`}
                    onClick={() => setAuthMode('signup')}
                  >
                    Crear cuenta
                  </button>
                  <button
                    type="button"
                    className={`lp-btn flex-1 py-2 text-sm ${authMode === 'signin' ? 'lp-btn-ink' : 'lp-btn-ghost'}`}
                    onClick={() => setAuthMode('signin')}
                  >
                    Ingresar
                  </button>
                </div>
                {authMode === 'signup' ? (
                  <div className="lp-field">
                    <label className="lp-label" htmlFor="lp-name">
                      Nombre completo
                    </label>
                    <input id="lp-name" className="lp-input" required value={name} onChange={(e) => setName(e.target.value)} />
                  </div>
                ) : null}
                <div className="lp-field">
                  <label className="lp-label" htmlFor="lp-email">
                    Email
                  </label>
                  <input
                    id="lp-email"
                    type="email"
                    className="lp-input"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className="lp-field">
                  <label className="lp-label" htmlFor="lp-pass">
                    Contraseña
                  </label>
                  <input
                    id="lp-pass"
                    type="password"
                    minLength={8}
                    className="lp-input"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <button type="submit" className="lp-btn lp-btn-primary w-full" disabled={pending}>
                  {pending ? 'Procesando…' : authMode === 'signup' ? 'Crear y continuar' : 'Ingresar y continuar'}
                </button>
                <p className="text-center text-xs text-[var(--lp-muted)]">
                  ¿Ya tenés cuenta?{' '}
                  <Link href="/pedir/ingresar?callbackUrl=/pedir/solicitud" className="font-semibold underline">
                    Ingresá acá
                  </Link>
                  .
                </p>
              </form>
            )}

            {step === 1 && (
              <form onSubmit={submitProfile} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="lp-field">
                    <label className="lp-label" htmlFor="lp-cuil">
                      CUIL
                    </label>
                    <input id="lp-cuil" className="lp-input" required value={cuil} onChange={(e) => setCuil(e.target.value)} placeholder="20XXXXXXXXX" />
                  </div>
                  <div className="lp-field">
                    <label className="lp-label" htmlFor="lp-dni">
                      DNI
                    </label>
                    <input id="lp-dni" className="lp-input" required value={dni} onChange={(e) => setDni(e.target.value)} />
                  </div>
                  <div className="lp-field">
                    <label className="lp-label" htmlFor="lp-phone">
                      Teléfono
                    </label>
                    <input id="lp-phone" className="lp-input" required value={phone} onChange={(e) => setPhone(e.target.value)} />
                  </div>
                  <div className="lp-field">
                    <label className="lp-label" htmlFor="lp-birth">
                      Fecha de nacimiento
                    </label>
                    <input id="lp-birth" type="date" className="lp-input" required value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
                  </div>
                </div>
                <GeoArFields value={geo} onChange={setGeo} />
                <div className="lp-field">
                  <label className="lp-label" htmlFor="lp-address">
                    Domicilio
                  </label>
                  <input id="lp-address" className="lp-input" required value={address} onChange={(e) => setAddress(e.target.value)} />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="lp-field">
                    <label className="lp-label" htmlFor="lp-income">
                      Ingresos mensuales (ARS)
                    </label>
                    <input id="lp-income" type="number" min={1} className="lp-input" required value={income} onChange={(e) => setIncome(e.target.value)} />
                  </div>
                  <div className="lp-field">
                    <label className="lp-label" htmlFor="lp-emp">
                      Situación laboral
                    </label>
                    <select id="lp-emp" className="lp-select" value={employment} onChange={(e) => setEmployment(e.target.value)}>
                      <option value="Relación de dependencia">Relación de dependencia</option>
                      <option value="Monotributista">Monotributista</option>
                      <option value="Autónomo">Autónomo</option>
                      <option value="Profesional independiente">Profesional independiente</option>
                      <option value="Jubilado / Pensionado">Jubilado / Pensionado</option>
                      <option value="Desempleado">Desempleado</option>
                      <option value="Otro">Otro</option>
                    </select>
                  </div>
                </div>
                <button type="submit" className="lp-btn lp-btn-primary w-full" disabled={pending}>
                  {pending ? 'Guardando…' : 'Guardar y continuar'}
                </button>
              </form>
            )}

            {step === 2 && (
              <div className="space-y-5">
                <p className="text-sm leading-relaxed text-[var(--lp-muted)]">
                  La verificación la hace Didit dentro de UNICRÉDITOS. Sin aprobación no se puede enviar el pedido.
                </p>
                {diditOk ? (
                  <div className="lp-alert lp-alert-ok">Identidad verificada. Podés seguir.</div>
                ) : (
                  <DiditVerifyButton
                    mode="session"
                    dni={dni}
                    birthDate={birthDate}
                    phone={phone}
                    email={session?.user?.email}
                    fullName={session?.user?.name ?? name}
                    label="Verificar con Didit"
                    className="lp-btn lp-btn-primary w-full"
                    onCompleted={(status) => {
                      if (status === 'Approved' || status === 'approved') {
                        setDiditOk(true)
                        setOkMsg('Identidad verificada.')
                      }
                    }}
                    onError={(message) => setError(message)}
                  />
                )}
                <button
                  type="button"
                  className="lp-btn lp-btn-ink w-full"
                  disabled={!diditOk}
                  onClick={() => {
                    setError(null)
                    goNext()
                  }}
                >
                  Continuar
                </button>
              </div>
            )}

            {step === 3 && (
              <form onSubmit={submitBank} className="space-y-4">
                {bankOk ? (
                  <div className="lp-alert lp-alert-ok">Ya tenés una cuenta de desembolso cargada.</div>
                ) : null}
                <div className="lp-field">
                  <label className="lp-label" htmlFor="lp-bank">
                    Banco / billetera
                  </label>
                  <input id="lp-bank" className="lp-input" required value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="Brubank, Mercado Pago, Galicia…" />
                </div>
                <div className="lp-field">
                  <label className="lp-label" htmlFor="lp-cbu">
                    CBU o CVU (22 dígitos)
                  </label>
                  <input id="lp-cbu" className="lp-input font-mono" required value={cbu} onChange={(e) => setCbu(e.target.value)} inputMode="numeric" />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="lp-field">
                    <label className="lp-label" htmlFor="lp-holder">
                      Titular
                    </label>
                    <input id="lp-holder" className="lp-input" required value={holderName} onChange={(e) => setHolderName(e.target.value)} />
                  </div>
                  <div className="lp-field">
                    <label className="lp-label" htmlFor="lp-holder-cuil">
                      CUIL del titular
                    </label>
                    <input id="lp-holder-cuil" className="lp-input" required value={holderCuil} onChange={(e) => setHolderCuil(e.target.value)} />
                  </div>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  {bankOk ? (
                    <button type="button" className="lp-btn lp-btn-ink flex-1" onClick={goNext}>
                      Usar cuenta existente
                    </button>
                  ) : null}
                  <button type="submit" className="lp-btn lp-btn-primary flex-1" disabled={pending}>
                    {pending ? 'Guardando…' : 'Guardar cuenta'}
                  </button>
                </div>
              </form>
            )}

            {step === 4 && (
              <form onSubmit={runEvaluation} className="space-y-5">
                <p className="text-sm leading-relaxed text-[var(--lp-muted)]">
                  Consultamos BCRA, score e historial de pagos en la app. El monto se ofrece después: no podés pedir el
                  tope de línea sin calificar.
                </p>
                <div>
                  <p className="lp-label">Plazo orientativo</p>
                  <div className="flex flex-wrap gap-2">
                    {terms.map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => {
                          setTerm(t)
                          setOffer(null)
                        }}
                        className={`h-10 min-w-14 rounded-full border px-3 text-sm font-semibold ${
                          term === t ? 'border-[var(--lp-ink)] bg-[var(--lp-ink)] text-white' : 'border-[var(--lp-line)] bg-white'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-[var(--lp-muted)]">
                    La cuota máxima usa el 35% de tus ingresos. Un plazo más largo puede mejorar la oferta.
                  </p>
                </div>
                <p className="text-xs leading-relaxed text-[var(--lp-muted)]">
                  Al evaluar aceptás los{' '}
                  <Link href="/pedir/legal/terminos" className="underline">
                    Términos
                  </Link>{' '}
                  y la consulta a la Central de Deudores del BCRA.
                </p>
                <button type="submit" className="lp-btn lp-btn-primary w-full" disabled={pending || !diditOk || !bankOk}>
                  {pending ? 'Evaluando score…' : 'Evaluar y ver oferta'}
                </button>
              </form>
            )}

            {step === 5 && offer && (
              <form onSubmit={submitLoan} className="space-y-5">
                <div className="rounded-2xl border border-[var(--lp-line)] bg-[var(--lp-fog)] px-4 py-3 text-sm">
                  <p className="font-semibold text-[var(--lp-ink)]">
                    Oferta hasta {formatARS(offer.maxAmount)}
                  </p>
                  <p className="mt-1 text-[var(--lp-muted)]">
                    Score {offer.score} ({offer.band}) · cuota tope {formatARS(offer.maxInstallment)}
                  </p>
                  <p className="mt-1 text-xs text-[var(--lp-muted)]">{offer.reason}</p>
                </div>
                <div>
                  <div className="mb-2 flex justify-between">
                    <label className="lp-label mb-0" htmlFor="lp-loan-amount">
                      Monto a solicitar
                    </label>
                    <span className="font-mono font-semibold">{formatARS(amount)}</span>
                  </div>
                  <input
                    id="lp-loan-amount"
                    type="range"
                    min={PERSONAL_QUOTE.minAmount}
                    max={offer.maxAmount}
                    step={10000}
                    value={Math.min(amount, offer.maxAmount)}
                    onChange={(e) => setAmount(Number(e.target.value))}
                    className="w-full accent-[var(--lp-mint-deep)]"
                  />
                  <div className="mt-1 flex justify-between font-mono text-[11px] text-[var(--lp-muted)]">
                    <span>{formatARS(PERSONAL_QUOTE.minAmount)}</span>
                    <span>{formatARS(offer.maxAmount)}</span>
                  </div>
                </div>
                <p className="text-sm text-[var(--lp-muted)]">
                  Plazo {term} cuotas · cuota estimada{' '}
                  <span className="font-mono font-semibold text-[var(--lp-ink)]">
                    {formatARS(computeFrenchAmortization(amount, term, PERSONAL_QUOTE.monthlyRate).installmentAmount)}
                  </span>
                </p>
                <div className="lp-field">
                  <label className="lp-label" htmlFor="lp-purpose">
                    Destino del préstamo
                  </label>
                  <input id="lp-purpose" className="lp-input" required minLength={5} value={purpose} onChange={(e) => setPurpose(e.target.value)} />
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <button
                    type="button"
                    className="lp-btn lp-btn-ghost flex-1"
                    onClick={() => {
                      setOffer(null)
                      setStep(4)
                    }}
                  >
                    Reevaluar
                  </button>
                  <button type="submit" className="lp-btn lp-btn-primary flex-1" disabled={pending}>
                    {pending ? 'Enviando…' : 'Confirmar solicitud'}
                  </button>
                </div>
              </form>
            )}

            {step === 5 && !offer ? (
              <div className="space-y-4">
                <p className="text-sm text-[var(--lp-muted)]">Todavía no hay oferta. Corré la evaluación primero.</p>
                <button type="button" className="lp-btn lp-btn-primary w-full" onClick={() => setStep(4)}>
                  Ir a evaluación
                </button>
              </div>
            ) : null}
        </div>
      </div>
    </PedirAppShell>
  )
}
