import { betterAuth } from 'better-auth'
import { trustedOrigins } from '@/lib/site'
import { Pool } from 'pg'

function cleanConnectionUrl(url: string | undefined): string | undefined {
  if (!url) return url
  try {
    const u = new URL(url)
    u.searchParams.delete('channel_binding')
    u.searchParams.delete('sslmode')
    u.searchParams.set('uselibpqcompat', 'true')
    return u.toString()
  } catch {
    return url
  }
}

function getBaseURL() {
  if (process.env.NODE_ENV === 'development') return 'http://localhost:3000'
  const fromEnv =
    process.env.BETTER_AUTH_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL
  if (fromEnv) {
    try {
      const u = new URL(fromEnv.includes('://') ? fromEnv : `https://${fromEnv}`)
      // Apex redirige a www en Vercel: la cookie y el CSRF deben vivir en www.
      if (u.hostname === 'unicreditos.com') u.hostname = 'www.unicreditos.com'
      return u.origin
    } catch {
      return fromEnv.replace(/\/$/, '')
    }
  }
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL)
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  if (process.env.VERCEL_BRANCH_URL) return `https://${process.env.VERCEL_BRANCH_URL}`
  if (process.env.V0_RUNTIME_URL) return process.env.V0_RUNTIME_URL
  return 'https://www.unicreditos.com'
}

const isDev = process.env.NODE_ENV === 'development'
/** Solo si se fuerza explícitamente. No bloquear login solo por tener Resend. */
const requireEmailVerification = process.env.REQUIRE_EMAIL_VERIFICATION === 'true'

/**
 * Orígenes desde los que se aceptan requests autenticadas. Cada comodín acá es
 * una puerta de CSRF, así que la lista se arma con dominios concretos: los
 * propios, los declarados por entorno y, sólo fuera de producción, el dominio
 * efímero del preview.
 */
function getTrustedOrigins() {
  const origins = new Set(trustedOrigins())
  const add = (value: string | undefined) => {
    const v = value?.trim()
    if (!v) return
    origins.add(v.startsWith('http://') || v.startsWith('https://') ? v.replace(/\/$/, '') : `https://${v}`)
  }
  add(getBaseURL())
  add(
    process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : undefined,
  )
  if (process.env.VERCEL_ENV !== 'production') {
    add(process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined)
    add(process.env.VERCEL_BRANCH_URL ? `https://${process.env.VERCEL_BRANCH_URL}` : undefined)
  }
  return Array.from(origins)
}

const rawDatabaseUrl = process.env.DATABASE_URL
const cleanedDatabaseUrl = cleanConnectionUrl(rawDatabaseUrl)
const isNeonAuth = cleanedDatabaseUrl?.includes('neon.tech') ||
  process.env.POSTGRES_HOST?.includes('neon.tech')

const authDbPool = new Pool({
  connectionString: cleanedDatabaseUrl,
  max: 20,
  min: 0,
  connectionTimeoutMillis: 15000,
  idleTimeoutMillis: 60000,
  allowExitOnIdle: false,
  maxUses: 7500,
  ...(isNeonAuth
    ? {
        ssl: {
          rejectUnauthorized: true,
          minVersion: 'TLSv1.2',
        },
      }
    : {}),
})

export const auth = betterAuth({
  baseURL: getBaseURL(),
  trustedOrigins: getTrustedOrigins(),
  database: authDbPool,
  emailAndPassword: {
    enabled: true,
    autoSignIn: false,
    requireEmailVerification,
    maxPasswordLength: 128,
    minPasswordLength: 8,
    resetPasswordTokenExpiresIn: 60 * 60,
    sendResetPassword: async ({ user, url }) => {
      const { sendEmail, passwordResetEmail } = await import('@/lib/email')
      await sendEmail({ to: user.email, ...passwordResetEmail(url) })
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      const { sendEmail, emailVerificationEmail } = await import('@/lib/email')
      await sendEmail({ to: user.email, ...emailVerificationEmail(url) })
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 14,
    freshAge: 60 * 60 * 24,
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60,
    },
  },
  advanced: {
    defaultCookieAttributes: {
      sameSite: 'lax' as const,
      secure: !isDev,
      httpOnly: true,
      path: '/',
      priority: 'high',
    },
    useSecureCookies: !isDev,
    csrfProtection: true,
    cookieDomain: process.env.BETTER_AUTH_COOKIE_DOMAIN || undefined,
  },
  logger: {
    level: isDev ? 'warn' : 'error',
  },
})
