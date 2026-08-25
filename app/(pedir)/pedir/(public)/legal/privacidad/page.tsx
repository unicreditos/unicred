import { PedirFooter, PedirHeader } from '@/components/pedir/chrome'
import { BRAND, legalPartyLine } from '@/lib/brand'
import { LEGAL_COPY, LEGAL_PRIVACY_VERSION, LEGAL_REVISION } from '@/lib/legal/copy'
import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: `Privacidad · ${BRAND.company}`,
  description: 'Política de privacidad del canal de préstamos personales UNICRÉDITOS. Ley 25.326.',
  alternates: { canonical: '/pedir/legal/privacidad' },
}

const SECS = [
  {
    t: '1 · Responsable',
    p: [
      `Responsable: UNICRÉDITOS, unidad de negocios de ${legalPartyLine()}. Privacidad: ${BRAND.privacyEmail}.${BRAND.phone ? ` Tel: ${BRAND.phone}.` : ''}`,
      'Autoridad de control: Agencia de Acceso a la Información Pública (AAIP).',
    ],
  },
  {
    t: '2 · Datos que tratamos',
    p: [
      'Identificación (nombre, DNI, CUIL, domicilio, email, teléfono), biometría vía Didit, ingresos declarados, CBU/CVU/alias, score y consulta BCRA autorizada, préstamos, cuotas y pagos.',
    ],
  },
  {
    t: '3 · Finalidades',
    p: [
      'Originación y gestión del crédito, KYC, prevención de fraude, cobro de cuotas, cumplimiento legal, soporte y seguridad de la plataforma.',
    ],
  },
  {
    t: '4 · Encargados',
    p: [
      'Didit (identidad/biometría), Mercado Pago (cobros), proveedores de hosting y base de datos. No vendemos datos personales.',
    ],
  },
  {
    t: '5 · Consulta BCRA',
    p: [LEGAL_COPY.bcraConsulta, LEGAL_COPY.bcraReporte],
  },
  {
    t: '6 · Derechos ARCO',
    p: [
      `Acceso, rectificación, actualización, cancelación y oposición ante ${BRAND.privacyEmail} o el formulario de /pedir/contacto.`,
    ],
  },
  {
    t: '7 · Conservación',
    p: [
      'Conservamos los datos el tiempo necesario para el contrato, reclamos y obligaciones legales aplicables.',
    ],
  },
  {
    t: '8 · Vigencia',
    p: [`Versión ${LEGAL_PRIVACY_VERSION} · revisión ${LEGAL_REVISION}.`],
  },
]

export default function PedirPrivacidadPage() {
  return (
    <>
      <PedirHeader solid />
      <main className="pb-20 pt-28">
        <div className="lp-container max-w-3xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--lp-muted)]">Legal</p>
          <h1 className="lp-display mt-2 text-4xl text-[var(--lp-ink)] sm:text-5xl">Política de privacidad</h1>
          <p className="mt-3 text-sm text-[var(--lp-muted)]">
            Ley 25.326 · RG AAIP 78/2019. Ver también{' '}
            <Link href="/pedir/legal/terminos" className="font-semibold text-[var(--lp-mint-deep)] underline">
              términos y condiciones
            </Link>
            .
          </p>
          <div className="mt-10 space-y-6">
            {SECS.map((s) => (
              <section key={s.t} className="lp-tile">
                <h2 className="text-lg font-semibold text-[var(--lp-ink)]">{s.t}</h2>
                <div className="mt-3 space-y-2">
                  {s.p.map((par) => (
                    <p key={par.slice(0, 48)} className="text-sm leading-relaxed text-[var(--lp-muted)]">
                      {par}
                    </p>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      </main>
      <PedirFooter />
    </>
  )
}
