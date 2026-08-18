import { betterAuth } from 'better-auth'
import { Pool } from 'pg'

function getBaseURL() {
  if (process.env.BETTER_AUTH_URL) return process.env.BETTER_AUTH_URL
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL)
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return process.env.V0_RUNTIME_URL
}

const isDev = process.env.NODE_ENV === 'development'

function getTrustedOrigins() {
  if (isDev) {
    const origins = [
      'http://localhost:3000',
      'https://*.vusercontent.net',
      'https://*.vercel.run',
      'https://*.v0.build',
    ]
    if (process.env.V0_RUNTIME_URL) origins.push(process.env.V0_RUNTIME_URL)
    return origins
  }
  const origins: string[] = []
  if (process.env.VERCEL_URL) origins.push(`https://${process.env.VERCEL_URL}`)
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL)
    origins.push(`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`)
  return origins
}

export const auth = betterAuth({
  baseURL: getBaseURL(),
  trustedOrigins: getTrustedOrigins(),
  database: new Pool({ connectionString: process.env.DATABASE_URL }),
  emailAndPassword: {
    enabled: true,
  },
  ...(isDev
    ? {
        advanced: {
          defaultCookieAttributes: {
            sameSite: 'none' as const,
            secure: true,
          },
        },
      }
    : {}),
})
