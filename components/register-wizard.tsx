'use client'

import { getDiditPublicConfig, getMyDiditSession } from '@/app/actions/didit'
import { completeRegistration, lookupRegistrationIdentity } from '@/app/actions/register'
import { DiditVerifyButton } from '@/components/didit-verify-button'
import { GeoArFields, type GeoValue } from '@/components/geo-ar-fields'
import { AuthFloatLayout } from '@/components/auth/auth-float-layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { DirectoIntent } from '@/directo/intent'
import { directoSolicitarHref } from '@/directo/intent'
import { authClient } from '@/lib/auth-client'
import {
  adultBirthDateBounds,
  isPlausibleAdultBirthDate,
  isSocietyLabelForDidit,
  plausiblePersonDni,
} from '@/lib/didit-expected'
import { formatARS } from '@/lib/finance'
import type { AccountKind, IdentityMatch } from '@/lib/identity'
import { FIRST_CREDIT_HARD_CAP } from '@/lib/loan-underwriting'
import {
  MERCHANT_DOC_LABELS,
  requiredMerchantDocuments,
  type RepresentativeRole,
} from '@/lib/merchant-kyb'
import { cn } from '@/lib/utils'
import {
  Building2,
  CheckCircle2,
  FileText,
  Loader2,
  Lock,
  Mail,
  Phone,
  ShieldCheck,
  UserRound,
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'

/** Persona: id → confirm → contacto → clave → Didit → resultado. Comercio suma datos KYB. */
type Step = 'tipo' | 'id' | 'confirm' | 'contacto' | 'datos' | 'clave' | 'docs' | 'resultado'

const PERSONA_STEPS: Step[] = ['tipo', 'id', 'confirm', 'contacto', 'clave', 'docs', 'resultado']
const COMERCIO_STEPS: Step[] = ['tipo', 'id', 'confirm', 'contacto', 'datos', 'clave', 'docs', 'resultado']

const STEP_LABEL: Record<Step, string> = {
  tipo: 'Tipo',
  id: 'Documento',
  confirm: 'Identidad',
  contacto: 'Contacto',
  datos: 'Comercio',
  clave: 'Acceso',
  docs: 'Didit',
  resultado: 'Listo',
}

const CATEGORIAS = ['Almacén / kiosco', 'Indumentaria', 'Servicios', 'Gastronomía', 'Tecnología', 'Otro']

export function RegisterWizard({ intent }: { intent?: DirectoIntent }) {
  const router = useRouter()
  const [step, setStep] = useState<Step>('tipo')
  const [accountType, setAccountType] = useState<AccountKind | null>(null)
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
  const [businessName, setBusinessName] = useState('')
  const [category, setCategory] = useState('')
  const [merchantCuit, setMerchantCuit] = useState('')
  const [representativeRole, setRepresentativeRole] = useState<RepresentativeRole>('titular')
  const [titularCuil, setTitularCuil] = useState('')
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

  const steps = accountType === 'comercio' ? COMERCIO_STEPS : PERSONA_STEPS
  const idx = steps.indexOf(step)
  const progressSteps = steps.filter((s) => s !== 'resultado')
  const lastLookup = useRef('')
  const handleLookupRef = useRef<(raw?: string) => Promise<void>>(async () => {})
  const signInHref = intent?.fromDirecto
    ? `/sign-in?next=${encodeURIComponent(directoSolicitarHref(intent))}`
    : '/sign-in'

  const kybDocs = useMemo(() => {
    if (accountType !== 'comercio' || identity?.personType !== 'JURIDICA') return []
    return requiredMerchantDocuments('JURIDICA', representativeRole)
  }, [accountType, identity?.personType, representativeRole])

  function go(next: Step) {
    setError(null)
    setStep(next)
  }

  async function handleLookup(raw = identifier) {
    if (!accountType) return
    const digits = raw.replace(/\D/g, '')
    const ready = digits.length === 11 || digits.length === 7 || digits.length === 8
    if (!ready) return
    if (lookupLoading && lastLookup.current === digits) return
    lastLookup.current = digits
    setError(null)
    setLookupLoading(true)
    const res = await lookupRegistrationIdentity({ identifier: digits, accountType })
    setLookupLoading(false)
    if (!res.ok) {
      setError(res.error)
      return
    }
    if (res.alreadyRegistered) {
      setAlreadyRegistered(true)
      setError('Ese CUIT/CUIL ya tiene una cuenta UNICRÉDITOS. Ingresá con tu email.')
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
    if (step !== 'id' || !accountType) return
    const digits = identifier.replace(/\D/g, '')
    const ready = digits.length === 11 || digits.length === 7 || digits.length === 8
    if (!ready || lastLookup.current === digits) return
    const wait = digits.length === 7 ? 900 : 450
    const t = setTimeout(() => {
      void handleLookupRef.current(digits)
    }, wait)
    return () => clearTimeout(t)
  }, [identifier, accountType, step])

  function applyMatch(match: IdentityMatch) {
    setIdentity(match)
    setGeo((prev) => ({
      province: match.province || prev.province,
      department: match.department || prev.department,
      city: match.city || prev.city,
      postalCode: match.postalCode || prev.postalCode,
    }))
    setAddress(match.address || address)
    if (accountType === 'comercio') {
      setMerchantCuit(match.cuil)
      if (match.name) setBusinessName(match.name)
      if (match.personType === 'JURIDICA') {
        setName('')
        setCuil(titularCuil)
        setDni('')
        setRepresentativeRole('presidente')
      } else {
        setName(match.name)
        setCuil(match.cuil)
        setDni(match.dni ?? identifier.replace(/\D/g, '').slice(0, 8))
        setRepresentativeRole('titular')
      }
      return
    }
    setName(match.name)
    setCuil(match.cuil)
    setDni(match.dni ?? identifier.replace(/\D/g, '').slice(0, 8))
  }

  async function handleCreate() {
    if (!accountType || !identity) return
    setError(null)
    if (!acceptedTerms) {
      setError('Marcá que entendés que la cuenta no garantiza un crédito.')
      return
    }
    if (!acceptedBcraConsent) {
      setError('Autorizá la consulta a la Central de Deudores del BCRA (CENDEU).')
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
      accountType,
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
      businessName,
      category,
      merchantCuit: accountType === 'comercio' ? merchantCuit || identity.cuil : undefined,
      representativeRole: accountType === 'comercio' ? representativeRole : undefined,
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
      dashboardUrl: intent?.fromDirecto ? directoSolicitarHref(intent) : done.dashboardUrl,
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

  return (
    <AuthFloatLayout
      size="wide"
      className="max-w-xl"
      headline="Abrí tu cuenta"
      lede="Identidad oficial, contacto y verificación biométrica. Sin letra chica: la cuenta no garantiza un crédito."
    >
      <ol className="mb-8 flex gap-1.5" aria-label="Progreso de registro">
        {progressSteps.map((s, i) => (
          <li
            key={s}
            className={cn(
              'h-1.5 flex-1 rounded-full transition-colors',
              i <= Math.max(0, idx) ? 'bg-brand-primary' : 'bg-brand-navy-100',
            )}
            title={STEP_LABEL[s]}
          />
        ))}
      </ol>

      {step === 'tipo' && (
        <section className="space-y-6">
          <Header title="¿Para quién es la cuenta?" text="Persona física o comercio adherido a UNICRÉDITOS." />
          {intent?.fromDirecto ? (
            <p className="rounded-xl border border-brand-navy-200 bg-brand-navy-50 px-4 py-3 text-sm text-brand-navy-700">
              {intent.amount && intent.term
                ? `Simulaste ${formatARS(intent.amount)} en ${intent.term} cuotas. Primero abrís la cuenta; el tope del primer crédito es ${formatARS(FIRST_CREDIT_HARD_CAP)}.`
                : `Venís de la campaña en línea. El tope del primer crédito es ${formatARS(FIRST_CREDIT_HARD_CAP)}.`}
            </p>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <TypeCard
              active={accountType === 'persona'}
              icon={<UserRound className="h-6 w-6" />}
              title="Persona"
              text="DNI o CUIL, verificación biométrica y panel de cliente."
              onClick={() => setAccountType('persona')}
            />
            <TypeCard
              active={accountType === 'comercio'}
              icon={<Building2 className="h-6 w-6" />}
              title="Empresa / comercio"
              text="CUIT, representante legal, Didit y expediente societario si es PJ."
              onClick={() => setAccountType('comercio')}
            />
          </div>
          <NavRow
            backHref="/"
            backLabel="Volver"
            nextLabel="Continuar"
            nextDisabled={!accountType}
            onNext={() => go('id')}
          />
        </section>
      )}

      {step === 'id' && (
        <section className="space-y-6">
          <Header
            title={accountType === 'comercio' ? 'CUIT del comercio' : 'Tu DNI o CUIL'}
            text={
              accountType === 'comercio'
                ? 'Consultamos el padrón ARCA. La constancia no se carga a mano.'
                : 'Con el número devolvemos el nombre oficial del padrón para que lo confirmes.'
            }
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
              placeholder={accountType === 'comercio' ? '30-12345678-9' : '20-12345678-9 o DNI'}
              className="h-12 font-mono text-base"
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
          <NavRow
            onBack={() => go('tipo')}
            nextLabel={lookupLoading ? 'Consultando…' : 'Validar'}
            nextDisabled={lookupLoading || identifier.replace(/\D/g, '').length < 7}
            onNext={() => void handleLookup()}
            nextIcon={lookupLoading ? <Loader2 className="animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
          />
        </section>
      )}

      {step === 'confirm' && identity && (
        <section className="space-y-6">
          <Header
            title="Confirmá la identidad"
            text="Si el nombre no es el tuyo (o del representante), no continúes."
          />
          <div className="space-y-4 rounded-xl border border-brand-navy-200 bg-brand-navy-50 p-5">
            {alternatives.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-brand-navy-600">Otras claves posibles para ese DNI</p>
                <div className="flex flex-wrap gap-2">
                  {[identity, ...alternatives].map((alt) => (
                    <Button
                      key={alt.cuil}
                      type="button"
                      size="sm"
                      variant={alt.cuil === (merchantCuit || cuil) ? 'default' : 'outline'}
                      onClick={() => applyMatch(alt)}
                    >
                      {alt.cuil}
                      {alt.name ? ` · ${alt.name}` : ''}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {accountType === 'comercio' ? (
              <div className="grid gap-1 rounded-lg border border-brand-navy-200 bg-white p-4 text-sm">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-brand-navy-500">
                  Padrón ARCA
                </p>
                <p className="mt-1 text-lg font-semibold text-brand-navy-900">
                  {identity.name || businessName || 'Sin denominación en padrón'}
                </p>
                <p className="font-mono text-sm text-brand-navy-700">{formatCuil(merchantCuit || identity.cuil)}</p>
                <p className="text-xs text-brand-navy-600">
                  {identity.personType === 'JURIDICA'
                    ? 'Persona jurídica · se pedirá estatuto y representación'
                    : identity.personType === 'FISICA'
                      ? 'Persona física · constancia automática + Didit del titular'
                      : 'Tipo no clasificado'}
                  {identity.taxConditionLabel ? ` · ${identity.taxConditionLabel}` : ''}
                </p>
              </div>
            ) : (
              <div className="rounded-lg border border-brand-navy-200 bg-white p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-brand-navy-500">
                  Nombre según padrón
                </p>
                <p className="mt-2 font-display text-2xl font-medium tracking-tight text-brand-navy-900">
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
            )}

            {accountType === 'comercio' && identity.personType === 'JURIDICA' ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <Field
                  label="Nombre y apellido del representante *"
                  value={name}
                  onChange={setName}
                  placeholder="Como figura en el DNI"
                />
                <div className="space-y-1.5">
                  <Label>Rol del firmante *</Label>
                  <Select
                    value={representativeRole}
                    onValueChange={(v) => setRepresentativeRole((v as RepresentativeRole) || 'presidente')}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="presidente">Presidente / representante legal</SelectItem>
                      <SelectItem value="socio_gerente">Socio gerente</SelectItem>
                      <SelectItem value="administrador">Administrador</SelectItem>
                      <SelectItem value="apoderado">Apoderado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>CUIL del representante *</Label>
                  <Input
                    inputMode="numeric"
                    value={cuil}
                    onChange={(e) => {
                      const v = e.target.value.replace(/\D/g, '').slice(0, 11)
                      setCuil(v)
                      setTitularCuil(v)
                    }}
                    placeholder="20-12345678-6"
                    className="font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>DNI del representante *</Label>
                  <Input
                    inputMode="numeric"
                    value={dni}
                    onChange={(e) => setDni(e.target.value.replace(/\D/g, '').slice(0, 8))}
                  />
                </div>
              </div>
            ) : accountType === 'comercio' ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Nombre / denominación" value={name} onChange={setName} />
                <div className="space-y-1.5">
                  <Label>DNI del titular *</Label>
                  <Input
                    inputMode="numeric"
                    value={dni}
                    onChange={(e) => setDni(e.target.value.replace(/\D/g, '').slice(0, 8))}
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label>Nombre (editable solo si el padrón vino incompleto)</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={cn(identity.name ? 'bg-white' : '')}
                />
              </div>
            )}

            {accountType === 'comercio' && identity.personType === 'JURIDICA' && kybDocs.length > 0 ? (
              <div className="rounded-lg border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                <p className="font-semibold">Documentación societaria (después de Didit)</p>
                <ul className="mt-2 list-inside list-disc space-y-1 text-xs leading-relaxed">
                  {kybDocs.map((d) => (
                    <li key={d}>{MERCHANT_DOC_LABELS[d]}</li>
                  ))}
                </ul>
                <p className="mt-2 text-xs">
                  La constancia AFIP no se adjunta: la leemos del padrón. El poder o acta acredita que quien abre la
                  cuenta está autorizado a obligar a la sociedad.
                </p>
              </div>
            ) : null}
          </div>

          <label className="flex items-start gap-3 text-sm text-brand-navy-800">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 rounded border-brand-navy-300"
              checked={confirmedIdentity}
              onChange={(e) => setConfirmedIdentity(e.target.checked)}
            />
            Confirmo que estos datos me corresponden y autorizo a UNICRÉDITOS a usarlos para el alta.
          </label>
          {error && <Alert text={error} />}
          <NavRow
            onBack={() => go('id')}
            nextLabel="Confirmar y continuar"
            nextDisabled={
              !confirmedIdentity ||
              !name.trim() ||
              dni.length < 7 ||
              (identity.personType === 'JURIDICA' && isSocietyLabelForDidit(name, businessName || identity.name)) ||
              (identity.personType === 'JURIDICA' &&
                accountType === 'comercio' &&
                cuil.replace(/\D/g, '').length !== 11)
            }
            onNext={() => go('contacto')}
          />
        </section>
      )}

      {step === 'contacto' && (
        <section className="space-y-6">
          <Header
            title="Email y celular"
            text="Los usamos para avisos de cuota, seguridad y recuperación de acceso."
          />
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-brand-navy-800">
                Email *
              </Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-navy-400" />
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-12 pl-10"
                  placeholder="tu@email.com"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone" className="text-brand-navy-800">
                Celular *
              </Label>
              <div className="relative">
                <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-navy-400" />
                <Input
                  id="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="h-12 pl-10"
                  placeholder="11 1234-5678"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="birthDate" className="text-brand-navy-800">
                Fecha de nacimiento *
              </Label>
              <Input
                id="birthDate"
                type="date"
                value={birthDate}
                min={adultBirthDateBounds().min}
                max={adultBirthDateBounds().max}
                onChange={(e) => setBirthDate(e.target.value)}
                className="h-12"
              />
              {accountType === 'comercio' && identity?.personType === 'JURIDICA' ? (
                <p className="text-xs text-brand-navy-600">Del representante. No uses la fecha de constitución.</p>
              ) : null}
            </div>
            {accountType === 'persona' &&
            !(address.trim() && (geo.province || identity?.province) && (geo.city || identity?.city)) ? (
              <div className="space-y-3 rounded-xl border border-brand-navy-200 bg-brand-navy-50 p-4">
                <p className="text-sm font-medium text-brand-navy-800">
                  El padrón no trajo domicilio completo. Completalo para seguir.
                </p>
                <GeoArFields value={geo} onChange={setGeo} />
                <div className="space-y-2">
                  <Label htmlFor="address-persona">Calle y número *</Label>
                  <Input
                    id="address-persona"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Av. Ejemplo 123"
                  />
                </div>
              </div>
            ) : null}
          </div>
          {error && <Alert text={error} />}
          <NavRow
            onBack={() => go('confirm')}
            nextLabel="Continuar"
            nextDisabled={
              !contactoReady ||
              (accountType === 'persona' &&
                !(
                  (address.trim() || identity?.address) &&
                  (geo.province || identity?.province) &&
                  (geo.city || identity?.city)
                ))
            }
            onNext={() => go(accountType === 'comercio' ? 'datos' : 'clave')}
          />
        </section>
      )}

      {step === 'datos' && accountType === 'comercio' && (
        <section className="space-y-6">
          <Header
            title="Datos del comercio"
            text="Domicilio fiscal desde ARCA cuando está disponible. Completá solo lo que falte."
          />
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label>Razón social</Label>
              <Input
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                readOnly={Boolean(identity?.name)}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Rubro</Label>
              <Select value={category || undefined} onValueChange={(v) => setCategory(v ?? '')}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Seleccioná" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIAS.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <GeoArFields value={geo} onChange={setGeo} />
          <div className="space-y-2">
            <Label htmlFor="address">Calle y número *</Label>
            <Input
              id="address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Av. Ejemplo 123"
            />
          </div>
          {kybDocs.length > 0 ? (
            <div className="rounded-xl border border-brand-navy-200 bg-white p-4 text-sm text-brand-navy-700">
              <p className="flex items-center gap-2 font-semibold text-brand-navy-900">
                <FileText className="h-4 w-4 text-brand-primary" />
                Expediente KYB (persona jurídica)
              </p>
              <p className="mt-2 text-xs leading-relaxed">
                Después de verificar al representante con Didit, en el panel de comercio vas a subir:{' '}
                {kybDocs.map((d) => MERCHANT_DOC_LABELS[d]).join(' y ')}. Sin eso la adhesión queda incompleta.
              </p>
            </div>
          ) : (
            <p className="rounded-xl border border-brand-navy-200 bg-brand-navy-50 px-4 py-3 text-xs text-brand-navy-700">
              Persona física: no pedimos estatutos. Bastan padrón ARCA + Didit del titular.
            </p>
          )}
          {error && <Alert text={error} />}
          <NavRow
            onBack={() => go('contacto')}
            nextLabel="Continuar"
            nextDisabled={!businessName.trim() || !geo.province || !geo.city || !address.trim()}
            onNext={() => go('clave')}
          />
        </section>
      )}

      {step === 'clave' && (
        <section className="space-y-6">
          <Header title="Creá tu clave" text="Mínimo 8 caracteres. Después verificás identidad con Didit." />
          <div className="space-y-2">
            <Label htmlFor="password" className="text-brand-navy-800">
              Contraseña *
            </Label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-navy-400" />
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                placeholder="Mínimo 8 caracteres"
                className="h-12 pl-10"
              />
            </div>
          </div>
          <div className="space-y-3 rounded-xl border border-brand-navy-200 bg-brand-navy-50 p-4 text-sm text-brand-navy-800">
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
              />
              <span>
                Entiendo que la cuenta no garantiza crédito. Acepto los{' '}
                <Link href="/legal/terminos" className="font-medium text-brand-primary underline" target="_blank">
                  términos
                </Link>
                .
              </span>
            </label>
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4"
                checked={acceptedBcraConsent}
                onChange={(e) => setAcceptedBcraConsent(e.target.checked)}
              />
              <span>
                Autorizo la consulta a la Central de Deudores del BCRA (CENDEU) con mi CUIL.
              </span>
            </label>
          </div>
          {error && <Alert text={error} />}
          {alreadyRegistered && (
            <p className="text-sm">
              <Link href={signInHref} className="text-brand-primary underline">
                Ir a ingresar
              </Link>
            </p>
          )}
          <NavRow
            onBack={() => go(accountType === 'comercio' ? 'datos' : 'contacto')}
            nextLabel="Continuar a verificación"
            nextDisabled={password.length < 8 || !acceptedTerms || !acceptedBcraConsent}
            onNext={() => go('docs')}
          />
        </section>
      )}

      {step === 'docs' && (
        <section className="space-y-6">
          <Header
            title="Verificación de identidad"
            text={
              accountType === 'comercio' && identity?.personType === 'JURIDICA'
                ? 'Escaneá el DNI (frente y dorso) y completá la prueba facial del representante.'
                : 'Escaneá el frente y el dorso de tu DNI y completá la identificación facial.'
            }
          />
          {diditConfigured === null ? (
            <p className="text-sm text-brand-navy-600">Comprobando Didit…</p>
          ) : !diditConfigured ? (
            <Alert text="Didit no está disponible en este entorno. Falta configurar DIDIT_API_KEY." />
          ) : (
            <div className="space-y-3 rounded-xl border border-brand-navy-200 bg-white p-5">
              <DiditVerifyButton
                mode="signup"
                fullName={isSocietyLabelForDidit(name, businessName) ? undefined : name}
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
                  Verificación iniciada. Cuando termines el panel de Didit, creá la cuenta.
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
          <Header
            title="Tu cuenta está lista"
            text={
              accountType === 'comercio'
                ? 'Pasá al panel de comercio. Si sos persona jurídica, completá el expediente societario.'
                : 'Entrá a tu área de cliente. La ficha verificada no se puede editar sola: pedí cambios a soporte.'
            }
          />
          {result.score != null ? (
            <div className="rounded-xl border border-brand-navy-200 bg-brand-navy-50 p-6 text-center">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-navy-500">
                Scoring de referencia
              </p>
              <p className="mt-2 font-mono text-5xl font-semibold text-brand-navy-900">{result.score}</p>
              <p className="mt-1 text-sm capitalize text-brand-navy-600">{result.band}</p>
            </div>
          ) : result.warning ? (
            <Alert text={result.warning} />
          ) : null}

          {accountType === 'comercio' && kybDocs.length > 0 ? (
            <div className="rounded-xl border border-amber-300/70 bg-amber-50 p-4 text-sm text-amber-950">
              <p className="font-semibold">Pendiente de adhesión comercial</p>
              <ul className="mt-2 list-inside list-disc text-xs">
                {kybDocs.map((d) => (
                  <li key={d}>{MERCHANT_DOC_LABELS[d]}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <Button
            className="h-12 w-full text-base font-semibold"
            onClick={() => {
              router.push(result.dashboardUrl)
              router.refresh()
            }}
          >
            {accountType === 'comercio' ? 'Ir al panel de comercio' : 'Ir a mi área de cliente'}
          </Button>
        </section>
      )}

      {step !== 'resultado' && (
        <p className="mt-8 text-center text-sm text-brand-navy-600">
          ¿Ya tenés cuenta?{' '}
          <Link href={signInHref} className="font-semibold text-brand-primary underline-offset-4 hover:underline">
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
      <h2 className="font-display text-2xl font-medium tracking-tight text-brand-navy-900">{title}</h2>
      <p className="mt-1.5 text-sm leading-relaxed text-brand-navy-600">{text}</p>
    </div>
  )
}

function Alert({ text }: { text: string }) {
  return (
    <p
      className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
      role="alert"
    >
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
    <div className="grid grid-cols-2 gap-3 pt-1">
      {backHref ? (
        <Button type="button" asChild variant="outline" className="h-12 text-base font-semibold">
          <Link href={backHref}>{backLabel}</Link>
        </Button>
      ) : (
        <Button type="button" variant="outline" className="h-12 text-base font-semibold" onClick={onBack}>
          {backLabel}
        </Button>
      )}
      <Button
        type="button"
        className="h-12 gap-2 bg-gradient-to-r from-brand-primary to-brand-amber text-base font-semibold text-white shadow-md shadow-brand-primary/20 transition hover:brightness-[1.06]"
        disabled={nextDisabled}
        onClick={onNext}
      >
        {nextIcon}
        {nextLabel}
      </Button>
    </div>
  )
}

function TypeCard({
  active,
  icon,
  title,
  text,
  onClick,
}: {
  active: boolean
  icon: React.ReactNode
  title: string
  text: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-2xl border p-5 text-left transition',
        active
          ? 'border-brand-primary bg-brand-primary-50 ring-2 ring-brand-primary/25'
          : 'border-brand-navy-200 bg-white hover:border-brand-navy-300 hover:bg-brand-navy-50/60',
      )}
    >
      <div className="mb-3 text-brand-primary">{icon}</div>
      <p className="font-semibold text-brand-navy-900">{title}</p>
      <p className="mt-1.5 text-sm leading-relaxed text-brand-navy-600">{text}</p>
    </button>
  )
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <div className="space-y-1.5 sm:col-span-2">
      <Label>{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  )
}
