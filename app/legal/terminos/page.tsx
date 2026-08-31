import { PageSection, PublicPageShell } from '@/components/unicred/public-page-shell'
import { BRAND, legalPartyLine } from '@/lib/brand'
import { BadgeCheck, FileCheck2, Scale } from 'lucide-react'
import { pageMetadata } from '@/lib/seo'

export const metadata = pageMetadata({
  title: 'Términos y Condiciones Generales',
  description: 'Términos y Condiciones Generales de UNICRÉDITOS. Mutuo, TNA, CFT, arrepentimiento, Ley 24.240, Ley 25.326.',
  path: '/legal/terminos',
})

export default function TerminosPage() {
  const secciones = [
    {
      id: '1', t: '1 · Aceptación y partes',
      p: [
        `Los presentes Términos y Condiciones Generales (en adelante "TCG") regulan la relación contractual entre UNICRÉDITOS, unidad de negocios de ${legalPartyLine()} (en adelante "UNICRÉDITOS"), y el Usuario (persona humana y/o jurídica que acepta los presentes TCG para acceder a productos y servicios UNICRÉDITOS).`,
        'Al crear cuenta, marcar "Acepto Términos" o utilizar cualquier servicio, el Usuario declara tener capacidad legal para contratar (mayoría de edad o emancipación conforme Código Civil y Comercial), ser titular de la documentación presentada y aceptar los presentes TCG de forma voluntaria, libre y sin vicios de consentimiento.',
      ],
    },
    {
      id: '2', t: '2 · Servicios financieros',
      p: [
        'Los servicios ofrecidos al público son: préstamo personal digital y financiación comercial PyME (mutuo con interés, CCCN arts. 1525 y ss.). El cobro de cuotas puede hacerse por Mercado Pago, transferencia a RM International Group S.A.S. o saldo de ledger interno. La billetera interna no es un CVU Coelsa ni una cuenta PSP. Consulta a la Central de Deudores del BCRA, scoring UNICRÉDITOS, verificación de identidad (Didit) y paneles de cliente, comercio y administración.',
        'UNICRÉDITOS no es una entidad financiera autorizada por el BCRA, no capta depósitos y no está inscrita como Proveedor No Financiero de Crédito (PNFC) hasta que esa constancia se publique aquí. El CBU, CVU o alias bancario a nombre del titular se usa para desembolsar el crédito.',
        'Cada línea de producto podrá contar con condiciones particulares (monto mínimo/máximo, plazo, tasas, garantías, comisiones). Tales condiciones se informan en el simulador, oferta y contrato de préstamo (mutuo con interés, CCCN arts. 1525 y ss.), previo a la aceptación final del Usuario. “Préstamo” y “mutuo” designan el mismo negocio jurídico.',
      ],
    },
    {
      id: '3', t: '3 · Requisitos de elegibilidad y KYC',
      p: [
        'DNI argentino o pasaporte con residencia permanente; CUIL/CUIT propio; CBU/CVU activo a nombre del titular; ingresos comprobables; no inhabilitaciones legales vigentes; no sanción grave UIF/BCRA.',
        'El Usuario autoriza expresamente, con un consentimiento específico al alta o en el panel, la consulta a la Central de Deudores del BCRA (CENDEU) y fuentes permitidas para evaluar el crédito.',
        'UNICRÉDITOS se reserva el derecho de solicitar documentación complementaria, ejecutar verificación biométrica DNI + selfie y verificación de ingresos (CBU SALDO, recibos, monotributo) a fin de cumplir normativa ALA/FT UIF y Know Your Customer.',
      ],
    },
    {
      id: '4', t: '4 · Tasas, comisiones, TNA, CFT, CFT EA',
      p: [
        'TNA: tasa nominal anual = tasa mensual × 12. TEA: tasa efectiva anual = (1 + TEM)^12 − 1. CFT informado = TEA × 1,21 (IVA 21% sobre intereses). Hoy no se suman seguros, gastos de otorgamiento ni comisiones al deudor. Si en el futuro se cobran, se informarán en la oferta antes de firmar.',
        'El CFT publicado no es el indicador metodológico completo de un régimen de transparencia BCRA de entidad inscripta. Es el costo del interés más IVA, calculado por el motor de UNICRÉDITOS. Este mutuo se informa por Ley 24.240 art. 36, no por la Ley 25.065 (tarjetas de crédito).',
        'Los créditos del catálogo vigente son de cuota fija (sistema francés). No hay tasa variable. Si en el futuro se ofreciera un producto de tasa variable, se informaría en la oferta de ese crédito con 10 días de antelación a cualquier cambio.',
      ],
    },
    {
      id: '5', t: '5 · Sistema de amortización y cuotas',
      p: [
        'Salvo indicación contraria en la oferta, los préstamos operan por sistema francés (cuotas iguales, intereses decrecientes, amortización creciente).',
        'El día de vencimiento es el acordado en el contrato. Si el vencimiento coincide con día feriado o no hábil bancario, se traslada al próximo día hábil bancario.',
        'El pago se efectúa por Mercado Pago (tarjeta o cupón de red), transferencia a la cuenta de RM International Group S.A.S. informada en el panel, o código de cuponera UNICRÉDITOS como referencia. El débito automático de CBU no está habilitado.',
      ],
    },
    {
      id: '6', t: '6 · Mora, intereses punitorios y cobranza',
      p: [
        'La mora se registra en el cronograma. La tasa de interés punitorio es 0% (cero): UNICRÉDITOS no liquida ni capitaliza punitorios. En mora se exige el capital y los intereses compensatorios de la cuota vencida. La intimación no es automática: la emite un administrador y solo sobre cuotas con al menos 30 días de atraso.',
        'Los atrasos relevantes podrán informarse a bases de informes comerciales y, únicamente cuando corresponda según el régimen de información vigente y la normativa aplicable, a la Central de Deudores del BCRA. No se afirma capacidad de reporte BCRA si la sociedad no está alcanzada por ese régimen.',
        'Sin perjuicio de lo anterior, el Usuario podrá acogerse a planes de regularización, refinanciación, reestructuración, extensión y programas de recuperación crediticia a criterio de UNICRÉDITOS.',
      ],
    },
    {
      id: '7', t: '7 · Cancelación anticipada y prepago',
      p: [
        'El Usuario podrá cancelar el saldo en cualquier momento, sin multa, liquidando intereses no devengados. Ese derecho de prepago rige aunque no se trate de una tarjeta de crédito.',
        'Para cancelación parcial, el monto abonado se imputa primero a gastos, luego a intereses y por último a capital; UNICRÉDITOS informará el impacto en plazo y/o cuota antes de confirmar la operación.',
      ],
    },
    {
      id: '8', t: '8 · Garantías (si aplica)',
      p: [
        'Según línea de producto, podrán exigirse garantías prendarias, hipotecarias, fideicomisarias, solidarias de codeudor/a, garantía estatal PyME o caución bursátil.',
        'Los gastos de inscripción registral, gastos notariales, certificados de dominio y gravámenes correspondientes serán informados antes de otorgamiento y correrán a cargo del Usuario según oferta.',
      ],
    },
    {
      id: '9', t: '9 · Datos personales · Privacidad',
      p: [
        'El tratamiento de datos personales se rige por la Política de Privacidad vigente, Ley 25.326 de Protección de Datos Personales, RG AAIP 78/2019. El Usuario ejerce derechos ARCO (Acceso, Rectificación, Cancelación, Actualización, Supresión, Oposición, Portabilidad) ante UNICRÉDITOS.',
        'Se aplican controles de seguridad razonables (cifrado en tránsito, autenticación y auditoría de accesos). No se afirma certificación bancaria ni SIEM 24x7.',
      ],
    },
    {
      id: '10', t: '10 · ALA/FT · Prevención de lavado',
      p: [
        'El Usuario se obliga a no utilizar los servicios UNICRÉDITOS para actividades que configuren lavado de activos, financiación del terrorismo, evasión fiscal, corrupción, tráfico de estupefacientes ni delito alguno.',
        'UNICRÉDITOS aplica controles ALA/FT (Ley 25.246) sobre la operación. Hasta publicar inscripción como sujeto obligado UIF, no afirma esa calidad. Se reserva monitoreo, solicitud de documentación, bloqueo preventivo y denuncia ante autoridades.',
      ],
    },
    {
      id: '11', t: '11 · Uso indebido plataforma',
      p: [
        'Se prohíbe uso contrario a moral, orden público, normativa vigente; ingeniería inversa, scrapping abusivo, suplantación identidad, phishing, denial of service, explotación de vulnerabilidades, acceso no autorizado.',
        'Constatación de uso indebido habilita a UNICRÉDITOS suspender o cerrar cuenta inmediatamente, sin previo aviso, preservando derecho a reclamo por daños y perjuicios y denuncia penal.',
      ],
    },
    {
      id: '12', t: '12 · Límites de responsabilidad',
      p: [
        'UNICRÉDITOS responderá por daños y perjuicios derivados de dolo o culpa grave; no responderá por fuerza mayor o caso fortuito, fallos de prestadores terceros (red, banco, MP, ISP), actos de terceros, ni por datos incorrectos suministrados por el Usuario.',
        'UNICRÉDITOS procura disponibilidad continua, pero no garantiza acceso ininterrumpido ni libre de errores. Periodos de mantenimiento se comunicarán con antelación por panel y/o email.',
      ],
    },
    {
      id: '13', t: '13 · Reclamos, quejas, Defensa Consumidor',
      p: [
        `Canales: formulario de /contacto, email ${BRAND.supportEmail} y, con cita, el domicilio de la SAS. No hay WhatsApp ni 0800 publicado como canal habilitado. Plazo máximo de respuesta a reclamos: 10 días hábiles (Ley 24.240).`,
        'En caso de insatisfacción, el Usuario podrá recurrir ante Dirección General de Defensa y Protección al Consumidor, BCRA, AAIP, UIF, jueces y tribunales competentes.',
      ],
    },
    {
      id: '14', t: '14 · Modificación TCG',
      p: [
        'UNICRÉDITOS podrá modificar los presentes TCG por motivos regulatorios, de seguridad, de producto, de modelo de negocio o mejora de servicio.',
        'Se comunicará con no menos de 15 días corridos de antelación vía panel, email y/o cartas documentadas, dando derecho al Usuario a optar por cancelación anticipada sin multa si no acepta modificaciones.',
      ],
    },
    {
      id: '15', t: '15 · Jurisdicción y ley aplicable',
      p: [
        'Los presentes TCG se rigen por las leyes de la República Argentina. Fuero preferente: tribunales ordinarios de la Ciudad Autónoma de Buenos Aires. Si el Usuario es consumidor (Ley 24.240), puede demandar en el domicilio de su consumo; esa opción no puede renunciarse.',
      ],
    },
    {
      id: '16', t: '16 · Derecho de arrepentimiento',
      p: [
        'En contrataciones a distancia, el Usuario puede arrepentirse dentro de los 10 días corridos desde la aceptación del contrato (Ley 24.240 art. 34) desde el panel o desde /legal/arrepentimiento (CUIL + email + contrato), si el crédito todavía no se acreditó. UNICRÉDITOS anula el contrato y el cronograma.',
        'Si el dinero ya se acreditó, el arrepentimiento exige devolver el capital. Hasta que tesorería confirme la devolución, el crédito sigue vigente. También puede usarse la cancelación anticipada.',
      ],
    },
    {
      id: '17', t: '17 · Vigencia',
      p: [
        'Esta versión rige desde el 30/08/2026 y sustituye a TCG-v9.1.',
        'Versión: TCG-v9.2 · última revisión 30/08/2026.',
      ],
    },
  ]

  return (
    <PublicPageShell
      eyebrow="Legales · Términos y Condiciones"
      icon={<Scale className="h-3.5 w-3.5" />}
      title="Términos y Condiciones Generales"
      description="Regula la relación entre UNICRÉDITOS (RM International Group S.A.S.) y los usuarios. Ley 24.240 · Ley 25.326 · consulta BCRA RG A 7610."
      secondaryAction={{ href: '/legal/privacidad', label: 'Ver Política de Privacidad' }}
    >
      <div className="grid gap-6 lg:grid-cols-4">
        <aside className="space-y-4 lg:col-span-1">
          <PageSection eyebrow="Índice" title="17 secciones">
            <ul className="space-y-1.5 text-xs text-muted-foreground">
              {secciones.map(s => (
                <li key={s.id}>
                  <a href={`#sec-${s.id}`} className="flex items-start gap-2 rounded-md px-2 py-1 hover:bg-brand-primary/5 hover:text-brand-primary">
                    <span className="font-mono opacity-70">{s.id}</span><span>{s.t.replace(/^[\d\s·-]+/, '')}</span>
                  </a>
                </li>
              ))}
            </ul>
          </PageSection>
          <div className="rounded-2xl bg-emerald-500/5 p-4 ring-1 ring-emerald-500/20">
            <div className="flex items-start gap-2">
              <BadgeCheck className="h-4 w-4 shrink-0 text-emerald-700" />
              <p className="text-xs leading-relaxed text-emerald-900">Texto alineado al código vigente. No afirma inscripción BCRA, UIF ni revisión de un estudio externo.</p>
            </div>
          </div>
        </aside>

        <div className="space-y-6 lg:col-span-3">
          {secciones.map(s => (
            <section key={s.id} id={`sec-${s.id}`} className="space-y-3 rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm">
              <h2 className="flex items-center gap-3 text-lg font-bold text-slate-900">
                <FileCheck2 className="h-5 w-5 text-brand-primary" />{s.t}
              </h2>
              <div className="space-y-2.5">
                {s.p.map((par, i) => (
                  <p key={i} className="text-sm leading-relaxed text-slate-700 first-letter:pl-0">{par}</p>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </PublicPageShell>
  )
}
