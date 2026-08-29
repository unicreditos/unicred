import type { Metadata } from 'next'
import { Suspense } from 'react'
import { ResetPasswordForm } from '@/components/auth/reset-password-form'

export const metadata: Metadata = {
  title: 'Nueva contraseña',
  description: 'Elegí una nueva contraseña para tu cuenta UNICRÉDITOS.',
  robots: { index: false, follow: false },
}

export default function RestablecerClavePage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  )
}
