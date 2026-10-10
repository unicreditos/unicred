import { Grid, PageSection, PublicPageShell } from '@/components/unicred/public-page-shell'
import { BRAND } from '@/lib/brand'
import {
  Building2,
  Clock,
  Globe2,
  Handshake,
  Headphones,
  MapPin,
  MessageCircle,
  PhoneCall,
  Send,
  ShieldCheck,
} from 'lucide-react'
import Link from 'next/link'
import { PublicInquiryForm } from '@/components/unicred/public-inquiry-form'
import { pageMetadata } from '@/lib/seo'

export const metadata = pageMetadata({
  title: 'Contacto · Atención al Cliente',
  description: 'Formulario y email de soporte. Atención remota de lunes a viernes, 9 a 18 hs.',
  path: '/contacto',
})

export default function ContactoPage() {
  return (
    <PublicPageShell
      eyebrow="Atención al cliente"
      title="Escribinos por formulario o email"
      description="Atención remota de lunes a viernes, 9 a 18 hs. No hay WhatsApp ni 0800 publicado hasta que exista un número real."
      icon={<Headphones className="h-3.5 w-3.5" />}
      primaryAction={{ href: '#formulario', label: 'Escribir mensaje' }}
      secondaryAction={{ href: '/simulador', label: 'Ir al simulador' }}
    >
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-3">
          <PageSection eyebrow="Formulario web" title="Contanos en qué podemos ayudarte" id="formulario">
            <PublicInquiryForm kind="contacto" defaultSubject="Consulta general" />
          </PageSection>

          <PageSection eyebrow="Oficina Central" title="Dirección y horarios de atención">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex flex-col gap-3 rounded-2xl border border-brand-navy-200/70 bg-white p-5">
                <div className="flex items-center gap-2 text-brand-primary-700"><MapPin className="h-4 w-4" /><h3 className="text-sm font-bold uppercase tracking-wider">Ciudad Autónoma de Buenos Aires</h3></div>
                <p className="text-sm leading-relaxed text-brand-navy-600">{BRAND.address}</p>
                <ul className="space-y-1.5 text-sm text-brand-navy-600">
                  <li className="flex items-center gap-2"><Clock className="h-4 w-4 text-brand-navy-400" /> Lunes a Viernes · 9:00 a 18:00 hs (atención presencial con cita)</li>
                  <li className="flex items-center gap-2"><Globe2 className="h-4 w-4 text-brand-navy-400" /> {BRAND.domain} · {BRAND.legalName}</li>
                </ul>
              </div>
              <div className="flex flex-col gap-3 rounded-2xl border border-brand-navy-200/70 bg-white p-5">
                <div className="flex items-center gap-2 text-brand-primary-700"><Building2 className="h-4 w-4" /><h3 className="text-sm font-bold uppercase tracking-wider">Cobertura nacional</h3></div>
                <p className="text-sm leading-relaxed text-brand-navy-600">Operamos 100% digital en todo el país. La atención presencial es solo en CABA, con cita previa. No publicamos sucursales que no operan al público.</p>
                <ul className="space-y-1.5 text-sm text-brand-navy-600">
                  <li className="flex items-center gap-2"><Clock className="h-4 w-4 text-brand-navy-400" /> Soporte remoto: lunes a viernes 9 a 18 hs</li>
                  <li className="flex items-center gap-2"><Globe2 className="h-4 w-4 text-brand-navy-400" /> Incidentes de seguridad: {BRAND.supportEmail}</li>
                </ul>
              </div>
            </div>
          </PageSection>
        </div>

        <aside className="space-y-6 lg:col-span-2">
          <PageSection eyebrow="Canales" title="Formulario y email">
            <Grid cols={2}>
              <a href="#formulario" className="flex h-full flex-col gap-3 rounded-2xl border border-brand-navy-200 bg-paper p-5 transition hover:border-brand-primary/40 hover:bg-white">
                <MessageCircle className="h-6 w-6 text-brand-primary-700" />
                <h3 className="text-base font-bold text-brand-navy-900">Mensaje web</h3>
                <p className="text-sm text-muted-foreground">El envío llega a soporte si el servidor de correo está configurado.</p>
                <span className="mt-auto text-sm font-semibold text-brand-primary-700">Ir al formulario →</span>
              </a>
              <a href={`mailto:${BRAND.supportEmail}`} className="flex h-full flex-col gap-3 rounded-2xl border border-brand-navy-200 bg-paper p-5 transition hover:border-brand-primary/40 hover:bg-white">
                <Send className="h-6 w-6 text-brand-primary-700" />
                <h3 className="text-base font-bold text-brand-navy-900">Email soporte</h3>
                <p className="break-words text-sm text-muted-foreground">{BRAND.supportEmail}</p>
                <span className="mt-auto text-sm font-semibold text-brand-primary-700">Escribir →</span>
              </a>
              <a href={`mailto:${BRAND.privacyEmail}`} className="flex h-full flex-col gap-3 rounded-2xl border border-brand-navy-200 bg-paper p-5 transition hover:border-brand-primary/40 hover:bg-white">
                <Handshake className="h-6 w-6 text-brand-primary-700" />
                <h3 className="text-base font-bold text-brand-navy-900">Datos personales</h3>
                <p className="break-words text-sm text-muted-foreground">{BRAND.privacyEmail}</p>
                <span className="mt-auto text-sm font-semibold text-brand-primary-700">ARCO →</span>
              </a>
              <a href={`mailto:${BRAND.merchantsEmail}`} className="flex h-full flex-col gap-3 rounded-2xl border border-brand-navy-200 bg-paper p-5 transition hover:border-brand-primary/40 hover:bg-white">
                <PhoneCall className="h-6 w-6 text-brand-primary-700" />
                <h3 className="text-base font-bold text-brand-navy-900">Comercios</h3>
                <p className="break-words text-sm text-muted-foreground">{BRAND.merchantsEmail}</p>
                <span className="mt-auto text-sm font-semibold text-brand-primary-700">Escribir →</span>
              </a>
            </Grid>
          </PageSection>

          <PageSection eyebrow="Equipo comercial" title="Adhesiones PyMEs y Comercios">
            <div className="rounded-2xl border border-brand-navy-200/70 bg-gradient-to-br from-brand-primary/5 to-brand-cian-500/5 p-5">
              <p className="text-sm text-brand-navy-600">Si sos dueño/a de comercio o PyME y querés un asesor comercial que te acompañe en la adhesión y capacitación de tu equipo:</p>
              <div className="mt-4 flex items-center gap-2 text-sm font-semibold text-brand-primary-700">
                <ShieldCheck className="h-4 w-4" /> Atención personalizada · Sin costo
              </div>
              <Link href="/comercios" className="mt-3 inline-flex text-sm font-semibold underline">Ver beneficios Red Comercios →</Link>
            </div>
          </PageSection>
        </aside>
      </div>
    </PublicPageShell>
  )
}
