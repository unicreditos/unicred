import { betterAuth } from 'better-auth'
import { createAuthMiddleware, getSessionFromCtx } from 'better-auth/api'
import { recordAudit } from '@/lib/audit'
import { trustedOrigins } from '@/lib/site'
import { cleanConnectionUrl, isLocalPostgres, isPlaceholderDbUrl } from '@/lib/db'
import { Pool } from 'pg'

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
  if (process.env.NG_ALLOWED_HOSTS) {
    add(`https://${process.env.NG_ALLOWED_HOSTS}`)
  }
  if (process.env.APP_URL) {
    add(process.env.APP_URL)
  }
  return Array.from(origins)
}

const rawDatabaseUrl = process.env.DATABASE_URL
const cleanedDatabaseUrl = cleanConnectionUrl(rawDatabaseUrl)
const isNeonAuth = cleanedDatabaseUrl?.includes('neon.tech') ||
  process.env.POSTGRES_HOST?.includes('neon.tech')

function authHostIsLocal() {
  try {
    return rawDatabaseUrl ? isLocalPostgres(new URL(rawDatabaseUrl).hostname) : false
  } catch {
    return false
  }
}

const authDbPool = new Pool({
  connectionString: isPlaceholderDbUrl(cleanedDatabaseUrl) ? undefined : cleanedDatabaseUrl,
  max: 20,
  // min:0 hacía que este pool (separado del de lib/db/index.ts, better-auth
  // no reusa el mismo) se quedara sin conexiones abiertas apenas pasaba un
  // rato sin auth-checks. Como getSession() corre en CADA request
  // autenticado (páginas, server actions, API routes), esa reconexión fría
  // se pagaba una y otra vez — medido en vivo, ~2s parejos en cualquier
  // acción sin importar qué tan simple fuera. min:1 mantiene una conexión
  // lista.
  min: 1,
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
    : {
        // Base en la misma máquina: sin TLS.
        ssl: authHostIsLocal() ? false : undefined,
      }),
})

authDbPool.on('error', (err) => {
  const msg = err?.message || ''
  if (!msg.includes('ENOTFOUND') && !msg.includes('ECONNREFUSED')) {
    console.warn('[auth pool error]:', msg)
  }
})

/** Eventos de autenticación que quedan en la auditoría (ingresos, fallos, cierres, claves). */
const AUTH_AUDIT: Record<string, { action: string; okSeverity?: 'info' | 'warning'; label: string }> = {
  '/sign-in/email': { action: 'AUTH_LOGIN', label: 'Ingreso' },
  '/sign-up/email': { action: 'AUTH_SIGNUP', label: 'Alta de cuenta' },
  '/change-password': { action: 'AUTH_PASSWORD_CHANGED', okSeverity: 'warning', label: 'Cambio de contraseña' },
  '/reset-password': { action: 'AUTH_PASSWORD_RESET', okSeverity: 'warning', label: 'Restablecimiento de contraseña' },
  '/request-password-reset': { action: 'AUTH_RESET_REQUESTED', label: 'Pedido de restablecimiento de contraseña' },
  '/forget-password': { action: 'AUTH_RESET_REQUESTED', label: 'Pedido de restablecimiento de contraseña' },
}

const auditAuthEvents = createAuthMiddleware(async (ctx) => {
  try {
    const meta = AUTH_AUDIT[ctx.path]
    if (!meta) return
    const c = ctx.context as any
    const returned = c.returned
    const failed =
      returned instanceof Error || (returned && typeof returned === 'object' && Number((returned as any).statusCode ?? 0) >= 400)
    const user = c.newSession?.user ?? c.session?.user ?? null
    const body = (ctx.body ?? {}) as { email?: string }
    const email = String(user?.email ?? body.email ?? '').toLowerCase().trim().slice(0, 200)
    const headers = ctx.request?.headers
    const ip = headers?.get('x-forwarded-for')?.split(',')[0]?.trim() || headers?.get('x-real-ip') || null
    const ua = headers?.get('user-agent')?.slice(0, 200) ?? null
    await recordAudit({
      actorUserId: user?.id ?? '',
      action: failed ? `${meta.action}_FAILED` : meta.action,
      entityType: 'session',
      entityId: user?.id ?? null,
      targetUserId: user?.id ?? null,
      severity: failed ? 'warning' : (meta.okSeverity ?? 'info'),
      summary: `${meta.label}${failed ? ' fallido' : ''}: ${email || 'sin email'}`,
      changes: { email, ip, ua },
    })
  } catch (err) {
    console.warn('[audit] hook de autenticación:', (err as Error).message)
  }
})

/** El cierre de sesión se registra ANTES de borrar la sesión: después ya no se sabe quién era. */
const auditLogout = createAuthMiddleware(async (ctx) => {
  try {
    if (ctx.path !== '/sign-out') return
    const session = await getSessionFromCtx(ctx)
    const user = session?.user
    if (!user) return
    const headers = ctx.request?.headers
    await recordAudit({
      actorUserId: user.id,
      action: 'AUTH_LOGOUT',
      entityType: 'session',
      entityId: user.id,
      targetUserId: user.id,
      summary: `Cierre de sesión: ${user.email}`,
      changes: {
        email: user.email,
        ip: headers?.get('x-forwarded-for')?.split(',')[0]?.trim() || headers?.get('x-real-ip') || null,
        ua: headers?.get('user-agent')?.slice(0, 200) ?? null,
      },
    })
  } catch (err) {
    console.warn('[audit] cierre de sesión:', (err as Error).message)
  }
})

export const auth = betterAuth({
  baseURL: getBaseURL(),
  hooks: { before: auditLogout, after: auditAuthEvents },
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
    cookieDomain: isDev ? undefined : (process.env.BETTER_AUTH_COOKIE_DOMAIN || undefined),
  },
  logger: {
    level: isDev ? 'warn' : 'error',
  },
})
