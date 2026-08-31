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
import type { RepresentativeRole } from '@/lib/merchant-kyb'
import {
  Building2,
  CheckCircle2,
  CreditCard,
  FileText,
  Loader2,
  Printer,
  ShieldCheck,
  UserRound,
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

type Step = 'tipo' | 'id' | 'confirm' | 'datos' | 'docs' | 'cuenta' | 'resultado'

const STEPS: Step[] = ['tipo', 'id', 'confirm', 'datos', 'docs', 'cuenta', 'resultado']

const STEP_LABEL: Record<Step, string> = {
  tipo: 'Tipo',
  id: 'Identificación',
  confirm: 'Confirmación',
  datos: 'Datos',
  docs: 'Didit',
  cuenta: 'Cuenta',
  resultado: 'Scoring',
}

const SITUACIONES = [
  'Relación de dependencia',
  'Monotributista',
  'Autónomo',
  'Profesional independiente',
  'Jubilado / Pensionado',
  'Comercio',
  'Otro',
]

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
  const [employmentStatus, setEmploymentStatus] = useState('')
  const [monthlyIncome, setMonthlyIncome] = useState('')
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

  const idx = STEPS.indexOf(step)
  const lastLookup = useRef('')
  const handleLookupRef = useRef<(raw?: string) => Promise<void>>(async () => {})
  const signInHref = intent?.fromDirecto
    ? `/sign-in?next=${encodeURIComponent(directoSolicitarHref(intent))}`
    : '/sign-in'

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
      province: geo.province,
      department: geo.department,
      city: geo.city,
      postalCode: geo.postalCode,
      address,
      monthlyIncome: Number(monthlyIncome) || 0,
      employmentStatus,
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

  return (
    <AuthFloatLayout
      size="wide"
      className="max-w-2xl"
      headline="Comenzá con UNICRÉDITOS"
      lede="Abrí tu cuenta como persona o comercio. Validamos identidad, consultamos el BCRA y te mostramos TNA y CFT antes de firmar. Tener cuenta no garantiza un préstamo."
    >
      <ol className="mb-6 grid grid-cols-6 gap-1">
            {STEPS.filter((s) => s !== 'resultado').map((s, i) => (
              <li
                key={s}
                className={`h-1.5 rounded-full ${i <= idx ? 'bg-primary' : 'bg-muted'}`}
                title={STEP_LABEL[s]}
              />
            ))}
          </ol>

          {step === 'tipo' && (
            <section className="space-y-5">
              <Header title="¿Cómo querés registrarte?" text="Elegí si la cuenta es para vos o para tu comercio." />
              {intent?.fromDirecto ? (
                <p className="rounded-lg border bg-muted/20 p-3 text-sm">
                  {intent.amount && intent.term
                    ? `Simulaste ${formatARS(intent.amount)} en ${intent.term} cuotas. Primero abrís la cuenta; el tope del primer crédito es ${formatARS(FIRST_CREDIT_HARD_CAP)}.`
                    : `Venís de la campaña en línea. El tope del primer crédito es ${formatARS(FIRST_CREDIT_HARD_CAP)}; el catálogo más alto se habilita con historial.`}
                </p>
              ) : null}
              <div className="grid gap-3 sm:grid-cols-2">
                <TypeCard
                  active={accountType === 'persona'}
                  icon={<UserRound className="h-6 w-6" />}
                  title="Persona"
                  text="Billetera personal, scoring y eventual solicitud de crédito."
                  onClick={() => setAccountType('persona')}
                />
                <TypeCard
                  active={accountType === 'comercio'}
                  icon={<Building2 className="h-6 w-6" />}
                  title="Comercio"
                  text="Cuenta para tu negocio. La adhesión comercial la habilita UNICRÉDITOS."
                  onClick={() => setAccountType('comercio')}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Button
                  type="button"
                  asChild
                  className="h-12 bg-[#F5A623] text-base font-semibold text-white hover:bg-[#e39614]"
                >
                  <Link href="/">Volver</Link>
                </Button>
                <Button className="h-12 text-base font-semibold" disabled={!accountType} onClick={() => go('id')}>
                  Continuar
                </Button>
              </div>
            </section>
          )}

          {step === 'id' && (
            <section className="space-y-5">
              <Header
                title="CUIT, CUIL o DNI"
                text="Al completar el número consultamos ARCA y el BCRA solos. Después confirmás los datos."
              />
              <div className="space-y-2">
                <Label htmlFor="identifier">Número</Label>
                <Input
                  id="identifier"
                  inputMode="numeric"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder={accountType === 'comercio' ? '30-12345678-9' : '20-12345678-9 o DNI'}
                  autoFocus
                />
                {lookupLoading && (
                  <p className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Consultando padrón ARCA y BCRA…
                  </p>
                )}
              </div>
              {error && <Alert text={error} />}
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => go('tipo')}>
                  Volver
                </Button>
                <Button className="flex-1" disabled={lookupLoading || identifier.replace(/\D/g, '').length < 7} onClick={() => void handleLookup()}>
                  {lookupLoading ? <Loader2 className="animate-spin" /> : <ShieldCheck />}
                  Validar automáticamente
                </Button>
              </div>
            </section>
          )}

          {step === 'confirm' && identity && (
            <section className="space-y-5">
              <Header
                title="Confirmá tus datos"
                text="El formulario se completa con lo consultado. Si algo no es tuyo, no sigas."
              />
              <div className="space-y-2 rounded-lg border bg-muted/30 p-4 text-sm">
                {alternatives.length > 0 && (
                  <div className="mb-3 space-y-2">
                    <p className="text-xs text-muted-foreground">Otras claves posibles para ese DNI:</p>
                    <div className="flex flex-wrap gap-2">
                      {[identity, ...alternatives].map((alt) => (
                        <Button key={alt.cuil} type="button" size="sm" variant={alt.cuil === (merchantCuit || cuil) ? 'default' : 'outline'} onClick={() => applyMatch(alt)}>
                          {alt.cuil}
                          {alt.name ? ` · ${alt.name}` : ''}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
                {accountType === 'comercio' ? (
                  <div className="mb-3 grid gap-1 rounded-md border bg-background/70 p-3 text-xs">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Padrón ARCA</p>
                    <p>
                      <span className="text-muted-foreground">Razón social: </span>
                      <span className="font-medium">{identity.name || businessName || 'ARCA no informó la denominación'}</span>
                    </p>
                    <p>
                      <span className="text-muted-foreground">CUIT: </span>
                      <span className="font-mono">{formatCuil(merchantCuit || identity.cuil)}</span>
                    </p>
                    <p><span className="text-muted-foreground">Tipo: </span>{identity.personType === 'JURIDICA' ? 'Persona jurídica' : identity.personType === 'FISICA' ? 'Persona física' : 'Sin clasificar'}</p>
                    <p><span className="text-muted-foreground">Condición ARCA: </span>{identity.taxConditionLabel || identity.taxStatus || 'Sin dato'}</p>
                    {identity.monotributoCategory ? <p><span className="text-muted-foreground">Categoría monotributo: </span>{identity.monotributoCategory}</p> : null}
                    <p>
                      <span className="text-muted-foreground">Domicilio fiscal: </span>
                      {[identity.address, identity.city, identity.department, identity.province, identity.postalCode].filter(Boolean).join(' · ') || 'Sin domicilio en el padrón'}
                    </p>
                    {(identity.arcaErrors ?? []).length > 0 ||
                    identity.taxCondition === 'no_inscripto' ||
                    /inactiv|limitad/i.test(identity.taxStatus) ? (
                      <div className="mt-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-[11px] leading-relaxed text-amber-950 dark:text-amber-100">
                        <p className="font-medium">Esta clave no habilita el alta de comercio.</p>
                        {(identity.arcaErrors ?? []).slice(0, 2).map((msg) => (
                          <p key={msg} className="mt-1">
                            {msg}
                          </p>
                        ))}
                        {identity.taxStatus ? (
                          <p className="mt-1">Estado en ARCA: {identity.taxStatus}.</p>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ) : null}
                <Field
                  label={identity.personType === 'JURIDICA' ? 'Nombre y apellido del representante *' : 'Nombre / denominación'}
                  value={name}
                  onChange={setName}
                  placeholder={identity.personType === 'JURIDICA' ? 'Como figura en el DNI' : undefined}
                />
                {identity.personType === 'JURIDICA' && isSocietyLabelForDidit(name, businessName || identity.name) ? (
                  <p className="text-xs text-amber-800 dark:text-amber-200">
                    Didit verifica el DNI de una persona. Completá nombre y apellido del representante, no la razón social.
                  </p>
                ) : null}
                {identity.personType === 'JURIDICA' && accountType === 'comercio' ? (
                  <div className="grid gap-3 pt-2 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label>CUIT de la sociedad (ARCA)</Label>
                      <Input value={formatCuil(merchantCuit)} readOnly className="font-mono" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Rol del firmante *</Label>
                      <Select value={representativeRole} onValueChange={(v) => setRepresentativeRole((v as RepresentativeRole) || 'presidente')}>
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
                          setCuil(e.target.value.replace(/\D/g, '').slice(0, 11))
                          setTitularCuil(e.target.value.replace(/\D/g, '').slice(0, 11))
                        }}
                        placeholder="20-12345678-6"
                        className="font-mono"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>DNI del representante *</Label>
                      <Input inputMode="numeric" value={dni} onChange={(e) => setDni(e.target.value.replace(/\D/g, '').slice(0, 8))} />
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-3 pt-2 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label>CUIT / CUIL</Label>
                      <Input value={cuil} readOnly className="font-mono" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>DNI del titular *</Label>
                      <Input inputMode="numeric" value={dni} onChange={(e) => setDni(e.target.value.replace(/\D/g, '').slice(0, 8))} />
                    </div>
                  </div>
                )}
                <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
                  {identity.sources.map((s) => (
                    <li key={s.id}>
                      {s.ok ? '●' : '○'} {s.label}: {s.detail}
                    </li>
                  ))}
                </ul>
              </div>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={confirmedIdentity}
                  onChange={(e) => setConfirmedIdentity(e.target.checked)}
                />
                Confirmo que estos datos me pertenecen y autorizo a UNICRÉDITOS a consultar el BCRA.
              </label>
              {error && <Alert text={error} />}
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => go('id')}>
                  Volver
                </Button>
                <Button
                  className="flex-1"
                  disabled={
                    !confirmedIdentity ||
                    !name.trim() ||
                    dni.length < 7 ||
                    (identity.personType === 'JURIDICA' && isSocietyLabelForDidit(name, businessName || identity.name)) ||
                    (identity.personType === 'JURIDICA' && accountType === 'comercio' && cuil.replace(/\D/g, '').length !== 11)
                  }
                  onClick={() => go('datos')}
                >
                  Confirmar y continuar
                </Button>
              </div>
            </section>
          )}

          {step === 'datos' && (
            <section className="space-y-5">
              <Header title="Datos de contacto y domicilio" text="Provincias, departamentos y localidades salen del catálogo oficial." />
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="birthDate">Fecha de nacimiento *</Label>
                  <Input
                    id="birthDate"
                    type="date"
                    value={birthDate}
                    min={adultBirthDateBounds().min}
                    max={adultBirthDateBounds().max}
                    onChange={(e) => setBirthDate(e.target.value)}
                  />
                  {accountType === 'comercio' && identity?.personType === 'JURIDICA' ? (
                    <p className="text-xs text-muted-foreground">Del representante. No uses la fecha de constitución de la sociedad.</p>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Teléfono *</Label>
                  <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="11 1234-5678" />
                </div>
              </div>
              <GeoArFields value={geo} onChange={setGeo} />
              <div className="space-y-2">
                <Label htmlFor="address">Calle y número *</Label>
                <Input id="address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Av. Ejemplo 123, piso 2" />
              </div>
              {accountType === 'comercio' ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Razón social (padrón ARCA)</Label>
                    <Input value={businessName} onChange={(e) => setBusinessName(e.target.value)} readOnly={Boolean(identity?.name)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Rubro</Label>
                    <Select value={category || undefined} onValueChange={(v) => setCategory(v ?? '')}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Rubro" />
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
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Situación laboral *</Label>
                    <Select value={employmentStatus || undefined} onValueChange={(v) => setEmploymentStatus(v ?? '')}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Seleccioná" />
                      </SelectTrigger>
                      <SelectContent>
                        {SITUACIONES.map((s) => (
                          <SelectItem key={s} value={s}>
                            {s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="income">Ingresos mensuales (ARS)</Label>
                    <Input id="income" inputMode="numeric" value={monthlyIncome} onChange={(e) => setMonthlyIncome(e.target.value)} />
                  </div>
                </div>
              )}
              {error && <Alert text={error} />}
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => go('confirm')}>
                  Volver
                </Button>
                <Button
                  className="flex-1"
                  disabled={
                    !isPlausibleAdultBirthDate(birthDate) ||
                    !phone ||
                    !geo.province ||
                    !geo.department ||
                    !geo.city ||
                    !geo.postalCode ||
                    !address ||
                    (accountType === 'persona' && !employmentStatus) ||
                    (accountType === 'comercio' && !businessName.trim())
                  }
                  onClick={() => go('docs')}
                >
                  Continuar
                </Button>
              </div>
            </section>
          )}

          {step === 'docs' && (
            <section className="space-y-5">
              <Header
                title="Verificación de identidad"
                text={
                  accountType === 'comercio' && identity?.personType === 'JURIDICA'
                    ? 'Didit verifica el DNI, la prueba de vida y el rostro del representante. No se verifica la razón social ni el CUIT de la sociedad.'
                    : 'Didit valida tu DNI, prueba de vida y coincidencia facial dentro de UNICRÉDITOS. No se aceptan fotos ni videos cargados a mano.'
                }
              />
              {diditConfigured === null ? (
                <p className="text-sm text-muted-foreground">Comprobando Didit…</p>
              ) : !diditConfigured ? (
                <Alert text="Didit no está disponible. Falta DIDIT_API_KEY en el proceso de Next. Reiniciá el servidor local." />
              ) : (
                <div className="space-y-3 rounded-xl border bg-muted/20 p-4">
                  <p className="text-sm text-muted-foreground">
                    Completá la verificación acá mismo, sin salir de UNICRÉDITOS. Cuando Didit termine, seguí con la cuenta.
                  </p>
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
                    <p className="text-sm text-emerald-700 dark:text-emerald-400">
                      Verificación iniciada en UNICRÉDITOS. Cuando termines el panel, continuá.
                    </p>
                  )}
                </div>
              )}
              {error && <Alert text={error} />}
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => go('datos')}>
                  Volver
                </Button>
                <Button
                  className="flex-1"
                  disabled={!diditConfigured || !diditStarted}
                  onClick={() => go('cuenta')}
                >
                  Continuar
                </Button>
              </div>
            </section>
          )}

          {step === 'cuenta' && (
            <section className="space-y-5">
              <Header title="Creá tu acceso" text="Con esto entras al panel de créditos UNICRÉDITOS. Cada préstamo se evalúa aparte." />
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Contraseña</Label>
                <Input id="password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} placeholder="Mínimo 8 caracteres" />
              </div>
              <div className="space-y-3 rounded-lg border bg-muted/20 p-4 text-sm">
                <p className="flex gap-2">
                  <CreditCard className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  Vas a poder solicitar créditos, ver el scoring BCRA y pagar cuotas desde el panel.
                </p>
                <p className="flex gap-2">
                  <FileText className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  Tener cuenta no implica que se te otorgue un crédito o préstamo.
                </p>
              </div>
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" className="mt-1" checked={acceptedTerms} onChange={(e) => setAcceptedTerms(e.target.checked)} />
                Entiendo que la cuenta no garantiza crédito y que cada desembolso requiere
                autorización de UNICRÉDITOS. Acepto los{' '}
                <Link href="/legal/terminos" className="text-primary underline" target="_blank">
                  términos
                </Link>
                .
              </label>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={acceptedBcraConsent}
                  onChange={(e) => setAcceptedBcraConsent(e.target.checked)}
                />
                Autorizo a UNICRÉDITOS a consultar la Central de Deudores del BCRA (CENDEU) con mi
                CUIL, para evaluar el crédito. Esta autorización es distinta de los términos de la
                cuenta.
              </label>
              {error && <Alert text={error} />}
              {alreadyRegistered && (
                <p className="text-sm">
                  <Link href={signInHref} className="text-primary underline">
                    Ir a ingresar
                  </Link>
                </p>
              )}
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => go('docs')}>
                  Volver
                </Button>
                <Button className="flex-1" disabled={saving || !email || password.length < 8 || !acceptedTerms || !acceptedBcraConsent} onClick={handleCreate}>
                  {saving ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
                  Crear cuenta y consultar BCRA
                </Button>
              </div>
            </section>
          )}

          {step === 'resultado' && result && (
            <section className="space-y-5">
              <Header title="Tu cuenta ya está creada" text="Consultamos el BCRA con los datos que confirmaste." />
              {result.score != null ? (
                <div className="rounded-xl border bg-muted/20 p-5 text-center">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Scoring UNICRÉDITOS</p>
                  <p className="mt-2 font-mono text-5xl font-semibold">{result.score}</p>
                  <p className="mt-1 text-sm capitalize text-muted-foreground">{result.band}</p>
                  <ul className="mt-4 space-y-1 text-left text-sm text-muted-foreground">
                    {result.reasons?.map((r) => (
                      <li key={r}>· {r}</li>
                    ))}
                  </ul>
                </div>
              ) : (
                <Alert text={result.warning || 'La cuenta se creó. El BCRA no respondió ahora; podés consultar el scoring desde tu panel.'} />
              )}
              <div className="space-y-3 rounded-xl border bg-muted/20 p-4">
                <p className="text-sm text-muted-foreground">
                  Si Didit todavía no aprobó tu identidad, completalo ahora dentro de UNICRÉDITOS. Sin esa aprobación no se puede pedir crédito.
                </p>
                <DiditVerifyButton
                  mode="session"
                  fullName={isSocietyLabelForDidit(name, businessName) ? undefined : name}
                  dni={plausiblePersonDni(dni)}
                  birthDate={isPlausibleAdultBirthDate(birthDate) ? birthDate : undefined}
                  phone={phone}
                  email={email}
                  className="w-full"
                  onError={setError}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button asChild variant="outline">
                  <Link href="/dashboard?tab=documentos&doc=arca">
                    <Printer /> Constancia ARCA
                  </Link>
                </Button>
                {result.reportId && (
                  <Button asChild variant="outline">
                    <Link href={`/dashboard?tab=documentos&doc=bcra&docId=${encodeURIComponent(result.reportId)}`}>
                      <Printer /> Informe BCRA
                    </Link>
                  </Button>
                )}
                <Button className="flex-1" onClick={() => { router.push(result.dashboardUrl); router.refresh() }}>
                  Ir a mi cuenta
                </Button>
              </div>
            </section>
          )}

          {step !== 'resultado' && (
            <p className="mt-6 text-center text-sm text-muted-foreground">
              ¿Ya tenés cuenta?{' '}
              <Link href={signInHref} className="font-medium text-primary underline-offset-4 hover:underline">
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
      <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{text}</p>
    </div>
  )
}

function Alert({ text }: { text: string }) {
  return (
    <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
      {text}
    </p>
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
      className={`rounded-xl border p-4 text-left transition ${
        active ? 'border-primary bg-primary/5 ring-2 ring-primary/30' : 'border-border hover:bg-muted/40'
      }`}
    >
      <div className="mb-3 text-primary">{icon}</div>
      <p className="font-medium">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{text}</p>
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
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  )
}

