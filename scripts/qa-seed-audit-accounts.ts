// Script temporal de un solo uso para la auditoría de diseño de los 3 dashboards.
// Crea 3 cuentas de prueba (persona, comercio, admin) con datos sintéticos y
// kycStatus/kybStatus aprobados a mano, sin pasar por Didit ni ARCA real.
// Se borra al terminar la auditoría.
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadProjectEnv } from './load-env'
import { confirmDangerousScript } from './confirm-danger'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
loadProjectEnv(rootDir)
confirmDangerousScript('Sembrar 3 cuentas QA sintéticas (persona/comercio/admin)')

function cuitCheckDigit(base10: string): number {
  const factors = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2]
  let sum = 0
  for (let i = 0; i < 10; i++) sum += parseInt(base10[i], 10) * factors[i]
  const mod = sum % 11
  return mod === 0 ? 0 : mod === 1 ? 9 : 11 - mod
}

function makeCuit(prefix: '20' | '27' | '30', body: string) {
  const base = `${prefix}${body}`
  return `${base}${cuitCheckDigit(base)}`
}

async function main() {
  const { auth } = await import('@/lib/auth')
  const { db, pool } = await import('@/lib/db')
  const { profile, user, merchant } = await import('@/lib/db/schema')
  const { eq } = await import('drizzle-orm')

  const password = 'QaAudit#2026!'

  async function ensureUser(email: string, name: string) {
    const [existing] = await db.select({ id: user.id }).from(user).where(eq(user.email, email)).limit(1)
    if (existing) {
      console.log(`ya existía ${email} (${existing.id})`)
      return existing.id
    }
    const res = await auth.api.signUpEmail({ body: { email, password, name } })
    const id = (res as { user?: { id?: string } })?.user?.id
    if (!id) throw new Error(`signUpEmail no devolvió id para ${email}`)
    console.log(`creado ${email} (${id})`)
    return id
  }

  // --- Persona ---
  const personaId = await ensureUser('qa-persona-audit@unicreditos.com', 'QA Auditoría Persona')
  const personaDni = makeCuit('20', '99999990').slice(2, 10)
  await db
    .insert(profile)
    .values({
      id: `prof_qa_persona_${personaId.slice(-8)}`,
      userId: personaId,
      role: 'customer',
      dni: personaDni,
      cuil: makeCuit('20', '99999990'),
      phone: '+5491100000000',
      birthDate: '1990-01-01',
      province: 'CABA',
      city: 'Ciudad Autónoma de Buenos Aires',
      address: 'Calle Falsa 123',
      monthlyIncome: '900000',
      employmentStatus: 'relacion_dependencia',
      kycStatus: 'approved',
      creditScore: 720,
    })
    .onConflictDoUpdate({
      target: profile.userId,
      set: { kycStatus: 'approved', creditScore: 720, updatedAt: new Date() },
    })
  console.log('persona: profile OK, kycStatus=approved')

  // --- Comercio ---
  const comercioId = await ensureUser('qa-comercio-audit@unicreditos.com', 'QA Auditoría Comercio')
  await db
    .insert(profile)
    .values({
      id: `prof_qa_comercio_${comercioId.slice(-8)}`,
      userId: comercioId,
      role: 'merchant',
      phone: '+5491100000001',
      kycStatus: 'approved',
    })
    .onConflictDoUpdate({
      target: profile.userId,
      set: { role: 'merchant', kycStatus: 'approved', updatedAt: new Date() },
    })
  const merchantCuit = makeCuit('30', '99999991')
  await db
    .insert(merchant)
    .values({
      id: `merch_qa_${comercioId.slice(-8)}`,
      userId: comercioId,
      businessName: 'QA Auditoría Comercio SAS',
      cuit: merchantCuit,
      category: 'retail',
      province: 'CABA',
      city: 'Ciudad Autónoma de Buenos Aires',
      address: 'Av. Falsa 456',
      phone: '+5491100000001',
      status: 'active',
      personType: 'JURIDICA',
      taxCondition: 'responsable_inscripto',
      legalName: 'QA Auditoría Comercio SAS',
      titularMatch: 'ok',
      representativeRole: 'apoderado',
      kybStatus: 'approved',
    })
    .onConflictDoUpdate({
      target: merchant.userId,
      set: { status: 'active', kybStatus: 'approved', updatedAt: new Date() },
    })
  console.log('comercio: merchant OK, status=active, kybStatus=approved')

  // --- Admin ---
  const adminId = await ensureUser('qa-admin-audit@unicreditos.com', 'QA Auditoría Admin')
  await db.update(user).set({ role: 'admin', updatedAt: new Date() }).where(eq(user.id, adminId))
  await db
    .insert(profile)
    .values({
      id: `prof_qa_admin_${adminId.slice(-8)}`,
      userId: adminId,
      role: 'admin',
      kycStatus: 'approved',
      creditScore: 850,
    })
    .onConflictDoUpdate({
      target: profile.userId,
      set: { role: 'admin', kycStatus: 'approved', updatedAt: new Date() },
    })
  console.log('admin: profile OK, role=admin')

  console.log('\nListo. Password para las 3 cuentas:', password)
  await pool.end()
}

main().catch((e) => {
  console.error('Error:', e?.message || e)
  process.exit(1)
})
