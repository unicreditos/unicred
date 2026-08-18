import { AuthForm } from '@/components/auth-form'
import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'

export default async function SignUpPage() {
  const session = await getSession()
  if (session?.user) redirect('/dashboard')
  return <AuthForm mode="sign-up" />
}
