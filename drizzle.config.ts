import { defineConfig } from 'drizzle-kit'
import path from 'node:path'
import dotenv from 'dotenv'

for (const file of [
  '.env.development.local',
  '.env.production.local',
  '.env.local',
  '.env.development',
  '.env.production',
  '.env',
]) {
  dotenv.config({ path: path.join(__dirname, file) })
}

function cleanConnectionUrl(url: string | undefined): string | undefined {
  if (!url) return url
  try {
    const u = new URL(url)
    u.searchParams.delete('channel_binding')
    u.searchParams.delete('sslmode')
    return u.toString()
  } catch {
    return url
  }
}

export default defineConfig({
  schema: './lib/db/schema.ts',
  dialect: 'postgresql',
  out: './drizzle',
  dbCredentials: {
    url: cleanConnectionUrl(process.env.DATABASE_URL) ?? '',
  },
})
