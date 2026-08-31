import { PageSection, PublicPageShell } from '@/components/unicred/public-page-shell'
import { BRAND, legalPartyLine } from '@/lib/brand'
import { BadgeCheck, Database, Eye, EyeOff, FileCheck2, FileSearch, Handshake, Lock, Shield, ShieldCheck, UserCheck } from 'lucide-react'
import { pageMetadata } from '@/lib/seo'

export const metadata = pageMetadata({
  title: 'Política de Privacidad · RG 78/2019',
  description: 'Política de Privacidad y tratamiento de datos personales. Ley 25.326 · AAIP RG 78/2019. Derechos ARCO, bases, finalidades, conservación, seguridad.',
  path: '/legal/privacidad',
})

export default function PrivacidadPage() {
  const secs = [
    {
      t: '1 · Responsable de datos',
      p: [
        `Responsable del tratamiento de datos personales: UNICRÉDITOS, unidad de negocios de ${legalPartyLine()}. Oficial de Privacidad: ${BRAND.privacyEmail}${BRAND.phone ? ` · Tel ${BRAND.phone}` : ''}.`,
        'Autoridad de control: Agencia de Acceso a la Información Pública (AAIP) · www.aaip.gob.ar. Los usuarios podrán presentar reclamos y denuncias ante dicha autoridad.',
      ],
    },
    {
      t: '2 · Alcance y bases legales',
      p: [
        'La presente política regula toda colección, tratamiento, almacenamiento, intercambio, eliminación y/o supresión de datos personales que UNICRÉDITOS lleva a cabo conforme normativa vigente: Ley 25.326 (PDPL), RG AAIP 78/2019, Ley 24.240, consultas BCRA/CENDEU con autorización del titular, Ley 25.246 (ALA/FT) y normativa sectorial. La Ley 25.065 (tarjetas) no aplica a este mutuo.',
        'Bases legales: consentimiento; ejecución de contrato y medidas precontractuales; obligaciones legales (consulta BCRA con tu autorización, conservación de comprobantes); interés legítimo de prevención de fraude.',
      ],
    },
    {
      t: '3 · Qué datos recolectamos',
      p: [
        'Datos identificatorios: nombre, apellido, CUIL/CUIT, DNI número/ejemplar/fecha emisión, domicilio real, mail, teléfono, nacionalidad, fecha nacimiento, estado civil, profesión/ocupación, foto DNI, selfie liveness.',
        'Datos patrimoniales y financieros: CBU/CVU, ingresos mensuales, recibos, información Central Deudores BCRA, situación crediticia, score UNICRÉDITOS, operaciones de préstamo, cuotas, pagos, movimientos, productos financieros contratados.',
        'Datos de transacción y comportamiento: IP, user agent, geolocalización aproximada, cookies técnicas/analíticas, sesiones, historial navegación plataforma, interacciones.',
      ],
    },
    {
      t: '4 · Finalidades de tratamiento',
      p: [
        'Ejecución y gestión contractual de productos financieros: originación, otorgamiento, cuotas, cancelaciones, contabilidad.',
        'Gestión riesgo, scoring, análisis perfil, verificación identidad, biometría, antifraude, ALA/FT, KYC/KYB, listas control, sanciones, OFAC, PEP (persona expuesta políticamente).',
        'Cumplimiento normativo, obligaciones legales con BCRA, UIF, AAIP, impositivas, judiciales, informes regulatorios, auditorías.',
        'Atención al cliente, soporte, SLA, encuestas CSAT/NPS, mejoras producto, marketing (solo con consentimiento opt-in).',
        'Seguridad plataforma, continuidad negocio, auditoría, backups, migración cloud, mejora infraestructura.',
      ],
    },
    {
      t: '5 · Compartición y transferencias',
      p: [
        'Compartición con autoridades y entes de control: BCRA, UIF, ARCA, AAIP, jueces y tribunales, fuerzas de seguridad, ministerios, conforme obligación legal o solicitud válida.',
        'Encargados actuales: Didit (verificación de identidad y biometría, verify.didit.me); Mercado Pago (cobro de cuotas); Neon/Postgres u otro hosting de base de datos; Vercel u otro hosting de la aplicación. Cada uno trata solo lo necesario para su servicio. Didit y Mercado Pago pueden almacenar datos fuera de Argentina; el titular acepta esa transferencia al usar KYC o pagar.',
        'UNICRÉDITOS NO vende datos personales a terceros para fines comerciales sin consentimiento previo expreso e inequívoco del titular.',
      ],
    },
    {
      t: '6 · Plazos de conservación',
      p: [
        'Datos se conservan durante el plazo necesario para la finalidad por la cual fueron recolectados; y por los plazos legales mínimos: 5 años Ley 25.326; 10 años información de deudas conforme normativa aplicable; 10 años registros ALA/FT cuando corresponda; plazos de prescripción de acciones judiciales.',
        'Cumplido plazo legal, los datos se anonimizan irreversiblemente o se suprimen de manera segura, de conformidad con normativa vigente y políticas internas retención.',
      ],
    },
    {
      t: '7 · Medidas de seguridad',
      p: [
        'Administrativas: clasificación datos, necesidad de conocer, política contraseñas, MFA obligatorio internamente, concienciación formación, control accesos rol-based least privilege.',
        'Técnicas que sí aplicamos en esta plataforma: HTTPS, cookies de sesión, hash de contraseñas de better-auth, control de roles (cliente / comercio / admin) y registro de auditoría de acciones sensibles.',
        'No afirmamos pentest trimestral, SIEM 24x7 ni certificación bancaria. Esas medidas se publicarán cuando existan.',
      ],
    },
    {
      t: '8 · Cookies y tecnologías tracking',
      p: [
        'Cookies técnicas de sesión y de la plataforma. Analytics de Vercel solo se carga si aceptás cookies no esenciales en el banner del primer acceso. No usamos Google Analytics 4 ni cookies de marketing en este código.',
        'Podés gestionar el consentimiento desde el banner al primer acceso (Solo esenciales / Aceptar), desde la configuración del navegador, o solicitando bloqueo a soporte.',
      ],
    },
    {
      t: '9 · Derechos de los titulares (ARCO+P+L)',
      p: [
        'Acceso · Rectificación · Cancelación · Actualización · Supresión (derecho al olvido casos permitidos) · Oposición · Portabilidad · Limitación tratamiento · Retiro consentimiento en cualquier momento.',
        `Cómo ejercitar: email a ${BRAND.privacyEmail}; formulario en /contacto; o escrito al domicilio de la SAS. Respuesta en 10 días hábiles.`,
        'El titular podrá reclamar ante AAIP si no está conforme respuesta, dentro de plazo reglamentario, sin necesidad de agotar instancia previa.',
      ],
    },
    {
      t: '10 · Marketing, comunicaciones comerciales, opt-in/out',
      p: [
        'Solo recibirás comunicaciones comerciales (novedades, ofertas, eventos) si marcaste opt-in explícito al crear cuenta o en formulario posterior.',
        'Podés darte de baja en cualquier momento clic link "Cancelar suscripción" del email o desde Panel > Perfil > Preferencias de comunicación.',
        'Comunicaciones de servicio (pago vencimiento, seguridad, operativa, regulatorias) son obligatorias y no requieren consentimiento.',
      ],
    },
    {
      t: '11 · Menores y grupos vulnerables',
      p: [
        `Los servicios requieren mayoría de edad. Si detectás datos de un menor, escribí a ${BRAND.privacyEmail} para supresión.`,
        'Grupos vulnerables (adultos mayores, personas con discapacidad): accesibilidad WCAG 2.1 AA, atención preferencial canales, formatos alternativos comunicación por razones fundadas.',
      ],
    },
    {
      t: '12 · Transferencia internacional datos',
      p: [
        'Los datos podrán ser transferidos o accedidos desde nodo cloud PaaS/saaS situado en jurisdicciones que aseguren nivel adecuado protección (Decision EU Adecuacy, RGAAIP normativa, cláusulas contractuales tipo modelo).',
        'Transferencias a jurisdicciones sin nivel adecuado requieren garantías apropiadas, norma o autorización AAIP; se informará al titular previamente.',
      ],
    },
    {
      t: '13 · Actualizaciones Política de Privacidad',
      p: [
        'Esta política podrá actualizarse por razones regulatorias, de producto, nuevas finalidades o cambio responsable. Versión nueva se publica en /legal/privacidad con fecha de vigencia.',
        'Cambios materiales se notificarán por email, panel y/o comunicaciones oficiales con 15 días hábiles de antelación.',
        'Versión actual: Privacy-v4.1 · vigente desde 30/08/2026 · fecha última revisión 30/08/2026.',
      ],
    },
    {
      t: '14 · Contacto',
      p: [
        `DPO Oficial de Privacidad · ${BRAND.privacyEmail}${BRAND.phone ? ` · ${BRAND.phone}` : ''} · ${BRAND.address}.`,
        'Horario atención datos: Lunes a Viernes 9 a 18 hs. Respuesta a ejercicio ARCO: máximo 10 días hábiles conforme normativa.',
      ],
    },
  ]
  return (
    <PublicPageShell
      eyebrow="Legales · Privacidad · AAIP"
      icon={<Lock className="h-3.5 w-3.5" />}
      title="Política de Privacidad · Tratamiento de Datos Personales"
      description="Documento oficial conforme Ley 25.326 de Protección de Datos Personales y RG AAIP 78/2019. Qué datos recolectamos, finalidades, compartición, conservación, medidas de seguridad, derechos ARCO y ejercicio."
      primaryAction={{ href: '/contacto', label: 'Ejercitar derechos ARCO' }}
      secondaryAction={{ href: '/legal/terminos', label: 'Términos y Condiciones' }}
    >
      <div className="grid gap-6 lg:grid-cols-4">
        <aside className="space-y-5 lg:col-span-1">
          <PageSection eyebrow="Resumen 30seg" title="Principios clave">
            <ul className="space-y-3 text-sm">
              <LI i={<ShieldCheck className="h-4 w-4" />} t="NO vendemos datos" />
              <LI i={<EyeOff className="h-4 w-4" />} t="Necesidad conocer" />
              <LI i={<UserCheck className="h-4 w-4" />} t="Consentimiento marketing opt-in" />
              <LI i={<Shield className="h-4 w-4" />} t="Cifrado 256-bit AES + TLS 1.3" />
              <LI i={<Database className="h-4 w-4" />} t="Retención legal mínima" />
              <LI i={<Handshake className="h-4 w-4" />} t="Derechos ARCO plenos" />
            </ul>
          </PageSection>
          <PageSection eyebrow="Índice" title="Navegación">
            <ul className="space-y-1.5 text-xs text-muted-foreground">
              {secs.map((s, i) => (
                <li key={s.t}>
                  <a href={`#pp-${i}`} className="flex items-start gap-2 rounded-md px-2 py-1 hover:bg-brand-primary/5 hover:text-brand-primary">
                    <span className="font-mono opacity-70">{String(i + 1).padStart(2, '0')}</span>
                    <span>{s.t.replace(/^[\d\s·-]+/, '')}</span>
                  </a>
                </li>
              ))}
            </ul>
          </PageSection>
        </aside>
        <div className="space-y-6 lg:col-span-3">
          {secs.map((s, i) => (
            <section id={`pp-${i}`} key={s.t} className="space-y-3 rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm">
              <h2 className="flex items-center gap-3 text-lg font-bold text-slate-900">
                <FileSearch className="h-5 w-5 text-brand-primary" />
                {s.t}
              </h2>
              <div className="space-y-2.5">
                {s.p.map((par, k) => <p key={k} className="text-sm leading-relaxed text-slate-700">{par}</p>)}
              </div>
            </section>
          ))}
          <div className="rounded-3xl border border-emerald-500/20 bg-emerald-500/5 p-6 ring-1 ring-emerald-500/20">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-emerald-600 ring-1 ring-emerald-500/30"><Eye className="h-5 w-5" /></div>
                <div>
                  <h3 className="text-sm font-bold text-emerald-900">Transparencia total</h3>
                  <p className="text-xs leading-relaxed text-emerald-900/80">Pedido de acceso: email identificado a {BRAND.privacyEmail}</p>
                </div>
              </div>
              <div className="flex flex-col gap-1 text-xs text-emerald-900/80">
                <span className="flex items-center gap-1.5"><BadgeCheck className="h-3.5 w-3.5" /> RG AAIP 78/2019 · OK</span>
                <span className="flex items-center gap-1.5"><BadgeCheck className="h-3.5 w-3.5" /> Ley 25.326 PDPL · OK</span>
                <span className="flex items-center gap-1.5"><FileCheck2 className="h-3.5 w-3.5" /> RGPD alignment (best effort) · OK</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PublicPageShell>
  )
}

function LI({ i, t }: { i: any; t: string }) {
  return (
    <li className="flex items-start gap-2 rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200/70">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white text-brand-primary ring-1 ring-brand-primary/20">{i}</span>
      <span className="text-sm font-semibold text-slate-800">{t}</span>
    </li>
  )
}
