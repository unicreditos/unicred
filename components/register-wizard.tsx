'use client'

import { getDiditPublicConfig, getMyDiditSession } from '@/app/actions/didit'
import { completeRegistration, lookupRegistrationIdentity } from '@/app/actions/register'
import { DiditVerifyButton } from '@/components/didit-verify-button'
import { GeoArFields, type GeoValue } from '@/components/geo-ar-fields'
import { AuthFloatLayout } from '@/components/auth/auth-float-layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { authClient } from '@/lib/auth-client'
import {
  adultBirthDateBounds,
  isPlausibleAdultBirthDate,
  isSocietyLabelForDidit,
  plausiblePersonDni,
} from '@/lib/didit-expected'
import { formatARS } from '@/lib/finance'
import type { IdentityMatch } from '@/lib/identity'
import { type LoanIntent, hasLoanIntent, solicitarHref } from '@/lib/loan-intent'
import { FIRST_CREDIT_HARD_CAP } from '@/lib/loan-underwriting'
import { cn } from '@/lib/utils'
import { CheckCircle2, Loader2, Lock, Mail, Phone, ShieldCheck } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

/** Alta de persona: documento → identidad → contacto → clave → Didit → resultado. */
type Step = 'id' | 'confirm' | 'contacto' | 'clave' | 'docs' | 'resultado'

const STEPS: Step[] = ['id', 'confirm', 'contacto', 'clave', 'docs', 'resultado']

const STEP_LABEL: Record<Step, string> = {
  id: 'Documento',
  confirm: 'Identidad',
  contacto: 'Contacto',
  clave: 'Acceso',
  docs: 'Verificación',
  resultado: 'Listo',
}

const fieldClass = 'h-12 rounded-xl border-brand-navy-200 bg-white text-base'

export function RegisterWizard({ intent }: { intent?: LoanIntent }) {
  const router = useRouter()
  const [step, setStep] = useState<Step>('id')
  const [identifier, setIdentifier] = useState('')
  const [lookupLoading, setLookupLoading] = useState(false)
  const [identity, setIdentity] = useState<IdentityMatch | null>(null)
  const [alternatives, setAlternatives] = useState<IdentityMatch[]>([])
  const [alreadyRegistered, setAlreadyRegistered] = useState(false)
  const [confirmedIdentity, setConfirmedIdentity] = useState(false)
  const [name, setName] = useState('')
  const [cuil, setCuil] = useState('')
  const [dni, setDni] = useState('')
  const [phone, setPhone] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [geo, setGeo] = useState<GeoValue>({ province: '', department: '', city: '', postalCode: '' })
  const [address, setAddress] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [acceptedBcraConsent, setAcceptedBcraConsent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [diditConfigured, setDiditConfigured] = useState<boolean | null>(null)
  const [diditStarted, setDiditStarted] = useState(false)
  const [result, setResult] = useState<{
    score: number | null
    band?: string
    reasons?: string[]
    reportId: string | null
    dashboardUrl: string
    warning: string | null
    diditConfigured?: boolean
  } | null>(null)

  const idx = STEPS.indexOf(step)
  const progressSteps = STEPS.filter((s) => s !== 'resultado')
  const lastLookup = useRef('')
  const handleLookupRef = useRef<(raw?: string) => Promise<void>>(async () => {})
  const signInHref = '/sign-in'
  const withIntent = intent ? hasLoanIntent(intent) : false

  function go(next: Step) {
    setError(null)
    setStep(next)
  }

  async function handleLookup(raw = identifier) {
    const digits = raw.replace(/\D/g, '')
    const ready = digits.length === 11 || digits.length === 7 || digits.length === 8
    if (!ready) return
    if (lookupLoading && lastLookup.current === digits) return
    lastLookup.current = digits
    setError(null)
    setLookupLoading(true)
    const res = await lookupRegistrationIdentity({ identifier: digits, accountType: 'persona' })
    setLookupLoading(false)
    if (!res.ok) {
      setError(res.error)
      return
    }
    if (res.alreadyRegistered) {
      setAlreadyRegistered(true)
      setError('Ese CUIL ya tiene una cuenta. Ingresá con tu email.')
      return
    }
    if (res.match.personType === 'JURIDICA') {
      setError(
        'Ese número corresponde a una empresa. UNICRÉDITOS otorga préstamos solo a personas humanas: ingresá tu DNI o CUIL.',
      )
      return
    }
    setAlreadyRegistered(false)
    setIdentity(res.match)
    setAlternatives(res.alternatives)
    applyMatch(res.match)
    go('confirm')
  }

  useEffect(() => {
    handleLookupRef.current = handleLookup
  })

  useEffect(() => {
    void getDiditPublicConfig().then((cfg) => setDiditConfigured(cfg.configured))
    void getMyDiditSession().then((s) => {
      if (s.sessionId) setDiditStarted(true)
    })
  }, [])

  useEffect(() => {
    if (step !== 'id') return
    const digits = identifier.replace(/\D/g, '')
    const ready = digits.length === 11 || digits.length === 7 || digits.length === 8
    if (!ready || lastLookup.current === digits) return
    const wait = digits.length === 7 ? 900 : 450
    const t = setTimeout(() => {
      void handleLookupRef.current(digits)
    }, wait)
    return () => clearTimeout(t)
  }, [identifier, step])

  function applyMatch(match: IdentityMatch) {
    setIdentity(match)
    setGeo((prev) => ({
      province: match.province || prev.province,
      department: match.department || prev.department,
      city: match.city || prev.city,
      postalCode: match.postalCode || prev.postalCode,
    }))
    setAddress(match.address || address)
    setName(match.name)
    setCuil(match.cuil)
    setDni(match.dni ?? identifier.replace(/\D/g, '').slice(0, 8))
  }

  async function handleCreate() {
    if (!identity) return
    setError(null)
    if (!acceptedTerms) {
      setError('Marcá que entendés que la cuenta no garantiza un crédito.')
      return
    }
    if (!acceptedBcraConsent) {
      setError('Autorizá la consulta a la Central de Deudores del BCRA para continuar.')
      return
    }
    setSaving(true)
    const created = await authClient.signUp.email({ email, password, name: name || email })
    if (created.error) {
      setSaving(false)
      setError('No pudimos crear la cuenta. El email puede estar en uso.')
      return
    }
    const signed = await authClient.signIn.email({ email, password })
    if (signed.error) {
      setSaving(false)
      setError('La cuenta se creó pero no pudimos ingresar. Probá en Ingresar.')
      return
    }

    const done = await completeRegistration({
      accountType: 'persona',
      name,
      cuil,
      dni,
      phone,
      birthDate,
      province: geo.province || identity.province || '',
      department: geo.department || identity.department || '',
      city: geo.city || identity.city || '',
      postalCode: geo.postalCode || identity.postalCode || '',
      address: address || identity.address || '',
      monthlyIncome: 0,
      employmentStatus: '',
      businessName: '',
      category: '',
      confirmedIdentity,
      acceptedTerms,
      acceptedBcraConsent,
      identity,
    })
    setSaving(false)
    if (!done.ok) {
      setError(done.error)
      return
    }
    setResult({
      score: done.score?.score ?? null,
      band: done.score?.band,
      reasons: done.score?.reasons,
      reportId: done.reportId,
      dashboardUrl: intent && hasLoanIntent(intent) ? solicitarHref(intent) : done.dashboardUrl,
      warning: done.warning,
      diditConfigured: done.diditConfigured,
    })
    go('resultado')
  }

  const contactoReady =
    Boolean(email.trim()) &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) &&
    phone.replace(/\D/g, '').length >= 8 &&
    isPlausibleAdultBirthDate(birthDate)

  const domicilioIncompleto = !(address.trim() && (geo.province || identity?.province) && (geo.city || identity?.city))

  return (
    <AuthFloatLayout
      size="wide"
      headline={step === 'resultado' ? 'Tu cuenta está lista' : 'Abrí tu cuenta'}
      lede={
        step === 'resultado'
          ? undefined
          : 'Identidad oficial, contacto y verificación biométrica. Abrir la cuenta no garantiza un crédito.'
      }
    >
      {step !== 'resultado' ? (
        <div className="mb-8">
          <ol className="flex gap-1.5" aria-label="Progreso de registro">
            {progressSteps.map((s, i) => (
              <li
                key={s}
                className={cn(
                  'h-1.5 flex-1 rounded-full transition-colors',
                  i <= Math.max(0, idx) ? 'bg-brand-primary' : 'bg-brand-navy-200',
                )}
              />
            ))}
          </ol>
          <p className="mt-2.5 font-mono text-[11px] uppercase tracking-[0.16em] text-brand-navy-500">
            Paso {Math.min(idx + 1, progressSteps.length)} de {progressSteps.length} · {STEP_LABEL[step]}
          </p>
        </div>
      ) : null}

      {step === 'id' && (
        <section className="space-y-6">
          {withIntent && intent ? (
            <p className="rounded-2xl border border-brand-primary/25 bg-brand-primary-50 px-4 py-3 text-sm leading-relaxed text-brand-navy-800">
              {intent.amount && intent.term
                ? `Simulaste ${formatARS(intent.amount)} en ${intent.term} cuotas. Primero abrís la cuenta y te evaluamos; tu primer crédito puede otorgarse hasta ${formatARS(FIRST_CREDIT_HARD_CAP)}.`
                : `Tu primer crédito puede otorgarse hasta ${formatARS(FIRST_CREDIT_HARD_CAP)}.`}
            </p>
          ) : null}
          <Header
            title="Tu DNI o CUIL"
            text="Con el número traemos tu nombre oficial del padrón de ARCA para que lo confirmes."
          />
          <div className="space-y-2">
            <Label htmlFor="identifier" className="text-brand-navy-800">
              Número
            </Label>
            <Input
              id="identifier"
              inputMode="numeric"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="20-12345678-9 o DNI"
              className={cn(fieldClass, 'font-mono')}
              autoFocus
            />
            {lookupLoading && (
              <p className="flex items-center gap-2 text-xs text-brand-navy-600">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Consultando padrón ARCA…
              </p>
            )}
          </div>
          {error && <Alert text={error} />}
          {alreadyRegistered && (
            <p className="text-sm">
              <Link href={signInHref} className="font-semibold text-brand-primary-700 hover:underline">
                Ir a ingresar
              </Link>
            </p>
          )}
          <NavRow
            backHref="/"
            nextLabel={lookupLoading ? 'Consultando…' : 'Validar'}
            nextDisabled={lookupLoading || identifier.replace(/\D/g, '').length < 7}
            onNext={() => void handleLookup()}
            nextIcon={lookupLoading ? <Loader2 className="animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
          />
        </section>
      )}

      {step === 'confirm' && identity && (
        <section className="space-y-6">
          <Header title="Confirmá tu identidad" text="Si el nombre no es el tuyo, no continúes." />
          <div className="space-y-4 rounded-2xl border border-brand-navy-200 bg-white p-5">
            {alternatives.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-brand-navy-600">Otras claves posibles para ese DNI</p>
                <div className="flex flex-wrap gap-2">
                  {[identity, ...alternatives].map((alt) => (
                    <Button
                      key={alt.cuil}
                      type="button"
                      size="sm"
                      variant={alt.cuil === cuil ? 'default' : 'outline'}
                      onClick={() => applyMatch(alt)}
                    >
                      {alt.cuil}
                      {alt.name ? ` · ${alt.name}` : ''}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-brand-navy-500">Nombre según padrón</p>
              <p className="mt-2 font-display text-3xl font-bold tracking-tight text-brand-navy-900">
                {name || identity.name || '—'}
              </p>
              <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                <p>
                  <span className="text-brand-navy-500">CUIL </span>
                  <span className="font-mono font-semibold text-brand-navy-900">{formatCuil(cuil)}</span>
                </p>
                <p>
                  <span className="text-brand-navy-500">DNI </span>
                  <span className="font-mono font-semibold text-brand-navy-900">{dni || '—'}</span>
                </p>
              </div>
            </div>

            {!identity.name ? (
              <div className="space-y-1.5">
                <Label>El padrón vino incompleto: escribí tu nombre como figura en el DNI</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} className={fieldClass} />
              </div>
            ) : null}
          </div>

          <label className="flex items-start gap-3 text-sm text-brand-navy-800">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 accent-brand-primary"
              checked={confirmedIdentity}
              onChange={(e) => setConfirmedIdentity(e.target.checked)}
            />
            Confirmo que estos datos me corresponden y autorizo a UNICRÉDITOS a usarlos para el alta.
          </label>
          {error && <Alert text={error} />}
          <NavRow
            onBack={() => go('id')}
            nextLabel="Confirmar y seguir"
            nextDisabled={
              !confirmedIdentity || !name.trim() || dni.length < 7 || isSocietyLabelForDidit(name, identity.name)
            }
            onNext={() => go('contacto')}
          />
        </section>
      )}

      {step === 'contacto' && (
        <section className="space-y-6">
          <Header title="Email y celular" text="Los usamos para avisos de cuota, seguridad y recuperación de acceso." />
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-brand-navy-800">
                Email
              </Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-navy-400" />
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={cn(fieldClass, 'pl-10')}
                  placeholder="tu@email.com"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone" className="text-brand-navy-800">
                Celular
              </Label>
              <div className="relative">
                <Phone className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-navy-400" />
                <Input
                  id="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className={cn(fieldClass, 'pl-10')}
                  placeholder="11 1234-5678"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="birthDate" className="text-brand-navy-800">
                Fecha de nacimiento
              </Label>
              <Input
                id="birthDate"
                type="date"
                value={birthDate}
                min={adultBirthDateBounds().min}
                max={adultBirthDateBounds().max}
                onChange={(e) => setBirthDate(e.target.value)}
                className={fieldClass}
              />
            </div>
            {domicilioIncompleto ? (
              <div className="space-y-3 rounded-2xl border border-brand-navy-200 bg-white p-4">
                <p className="text-sm font-medium text-brand-navy-800">
                  El padrón no trajo tu domicilio completo. Completalo para seguir.
                </p>
                <GeoArFields value={geo} onChange={setGeo} />
                <div className="space-y-2">
                  <Label htmlFor="address-persona">Calle y número</Label>
                  <Input
                    id="address-persona"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Av. Ejemplo 123"
                    className={fieldClass}
                  />
                </div>
              </div>
            ) : null}
          </div>
          {error && <Alert text={error} />}
          <NavRow
            onBack={() => go('confirm')}
            nextLabel="Continuar"
            nextDisabled={!contactoReady || domicilioIncompleto}
            onNext={() => go('clave')}
          />
        </section>
      )}

      {step === 'clave' && (
        <section className="space-y-6">
          <Header title="Creá tu contraseña" text="Mínimo 8 caracteres. Después verificás tu identidad con Didit." />
          <div className="space-y-2">
            <Label htmlFor="password" className="text-brand-navy-800">
              Contraseña
            </Label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-navy-400" />
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                placeholder="Mínimo 8 caracteres"
                className={cn(fieldClass, 'pl-10')}
              />
            </div>
          </div>
          <div className="space-y-3 rounded-2xl border border-brand-navy-200 bg-white p-4 text-sm text-brand-navy-800">
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 accent-brand-primary"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
              />
              <span>
                Entiendo que la cuenta no garantiza un crédito. Acepto los{' '}
                <Link href="/legal/terminos" className="font-medium text-brand-primary-700 underline" target="_blank">
                  términos y condiciones
                </Link>
                .
              </span>
            </label>
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 accent-brand-primary"
                checked={acceptedBcraConsent}
                onChange={(e) => setAcceptedBcraConsent(e.target.checked)}
              />
              <span>Autorizo la consulta a la Central de Deudores del BCRA con mi CUIL.</span>
            </label>
          </div>
          {error && <Alert text={error} />}
          <NavRow
            onBack={() => go('contacto')}
            nextLabel="Ir a la verificación"
            nextDisabled={password.length < 8 || !acceptedTerms || !acceptedBcraConsent}
            onNext={() => go('docs')}
          />
        </section>
      )}

      {step === 'docs' && (
        <section className="space-y-6">
          <Header
            title="Verificá tu identidad"
            text="Escaneá el frente y el dorso de tu DNI y completá la prueba facial. Dura un par de minutos."
          />
          {diditConfigured === null ? (
            <p className="text-sm text-brand-navy-600">Comprobando disponibilidad de Didit…</p>
          ) : !diditConfigured ? (
            <Alert text="La verificación con Didit no está disponible en este entorno. Falta configurar DIDIT_API_KEY." />
          ) : (
            <div className="space-y-3 rounded-2xl border border-brand-navy-200 bg-white p-5">
              <DiditVerifyButton
                mode="signup"
                fullName={isSocietyLabelForDidit(name, '') ? undefined : name}
                dni={plausiblePersonDni(dni)}
                birthDate={isPlausibleAdultBirthDate(birthDate) ? birthDate : undefined}
                phone={phone}
                email={email}
                className="w-full"
                onStarted={() => setDiditStarted(true)}
                onCompleted={() => setDiditStarted(true)}
                onError={setError}
              />
              {diditStarted && (
                <p className="text-sm font-medium text-brand-primary-700">
                  Verificación iniciada. Cuando termines en Didit, creá tu cuenta.
                </p>
              )}
            </div>
          )}
          {error && <Alert text={error} />}
          <NavRow
            onBack={() => go('clave')}
            nextLabel={saving ? 'Creando cuenta…' : 'Crear cuenta e ingresar'}
            nextDisabled={!diditConfigured || !diditStarted || saving}
            onNext={() => void handleCreate()}
            nextIcon={saving ? <Loader2 className="animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          />
        </section>
      )}

      {step === 'resultado' && result && (
        <section className="space-y-6">
          <p className="text-base leading-relaxed text-brand-navy-600">
            Entrá a tu panel para pedir tu crédito. Tus datos verificados no se editan solos: para cambiarlos, escribí a
            soporte.
          </p>
          {result.score != null ? (
            <div className="rounded-3xl bg-ink p-6 text-white">
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-white/50">Score de referencia</p>
              <p className="mt-2 font-display text-6xl font-extrabold tabular-nums text-signal-amber">{result.score}</p>
              <p className="mt-1 text-sm capitalize text-white/70">{result.band}</p>
            </div>
          ) : result.warning ? (
            <Alert text={result.warning} />
          ) : null}

          <Button
            size="lg"
            className="h-12 w-full rounded-full text-base font-semibold"
            onClick={() => {
              router.push(result.dashboardUrl)
              router.refresh()
            }}
          >
            Ir a mi panel
          </Button>
        </section>
      )}

      {step !== 'resultado' && (
        <p className="mt-8 text-center text-sm text-brand-navy-600">
          ¿Ya tenés cuenta?{' '}
          <Link href={signInHref} className="font-semibold text-brand-primary-700 hover:underline">
            Ingresá
          </Link>
        </p>
      )}
    </AuthFloatLayout>
  )
}

function formatCuil(value: string) {
  const n = String(value ?? '').replace(/\D/g, '')
  if (n.length !== 11) return value
  return `${n.slice(0, 2)}-${n.slice(2, 10)}-${n.slice(10)}`
}

function Header({ title, text }: { title: string; text: string }) {
  return (
    <div>
      <h2 className="font-display text-2xl font-bold tracking-tight text-brand-navy-900">{title}</h2>
      <p className="mt-1.5 text-sm leading-relaxed text-brand-navy-600">{text}</p>
    </div>
  )
}

function Alert({ text }: { text: string }) {
  return (
    <p className="rounded-xl border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-destructive" role="alert">
      {text}
    </p>
  )
}

function NavRow({
  onBack,
  backHref,
  backLabel = 'Volver',
  nextLabel,
  nextDisabled,
  onNext,
  nextIcon,
}: {
  onBack?: () => void
  backHref?: string
  backLabel?: string
  nextLabel: string
  nextDisabled?: boolean
  onNext: () => void
  nextIcon?: React.ReactNode
}) {
  return (
    <div className="grid grid-cols-[1fr_1.6fr] gap-3 pt-1">
      {backHref ? (
        <Button
          type="button"
          asChild
          variant="outline"
          size="lg"
          className="h-12 rounded-full bg-white text-base font-semibold"
        >
          <Link href={backHref}>{backLabel}</Link>
        </Button>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="h-12 rounded-full bg-white text-base font-semibold"
          onClick={onBack}
        >
          {backLabel}
        </Button>
      )}
      <Button
        type="button"
        size="lg"
        className="h-12 gap-2 rounded-full text-base font-semibold"
        disabled={nextDisabled}
        onClick={onNext}
      >
        {nextIcon}
        {nextLabel}
      </Button>
    </div>
  )
}
