import { PedirContactForm } from '@/components/pedir/contact-form'
import { BRAND } from '@/lib/brand'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: `Contacto · ${BRAND.company}`,
  description: `Contactá a ${BRAND.company} por email o formulario. Soporte préstamos personales.`,
  alternates: { canonical: '/pedir/contacto' },
}

export default function PedirContactoPage() {
  return <PedirContactForm />
}
