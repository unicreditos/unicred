// Aviso de verificacion de identidad para quienes originaron creditos y NO la completaron.
//   (por defecto) --simulate  Solo lectura (BEGIN READ ONLY + ROLLBACK): lista destinatarios ENMASCARADOS.
//   --send                    ENVIA. Exige IDENTITY_NOTIFY_CONFIRM=SI_ENVIAR_AVISO_IDENTIDAD, RESEND_API_KEY
//                             y deja una linea de auditoria por mail (admin_audit_log). NO se corre sin OK de Angel.
//   --date YYYY-MM-DD         dia de origen (Argentina). Por defecto hoy.
//   --limit N                 maximo de envios por corrida (por defecto 25).
//   --env-file <ruta>         toma DATABASE_URL de ese archivo (solo en memoria).
// Idempotente: quien ya tiene IDENTITY_NOTICE_SENT en la auditoria no recibe otro. Ritmo: 1 mail cada 1,5 s.
// El aviso dentro de la app (bandeja) se arma solo en lib/notifications.ts y no necesita escribir nada.
import { connect, hostOf, readOnly, resolveDatabaseUrl } from './lib-ops-db'
import { sendEmail } from '../lib/email'
import {
  IDENTITY_NOTICE_ACTION,
  arDayBounds,
  arToday,
  identityCheck,
  identityRequiredEmail,
  identityVerifyUrl,
  maskCuil,
  maskEmail,
} from '../lib/identity-notice'

const argv = process.argv.slice(2)
const flag = (n: string) => argv.includes(n)
const opt = (n: string) => {
  const i = argv.indexOf(n)
  return i >= 0 ? argv[i + 1] : undefined
}
const CONFIRM_ENV = 'IDENTITY_NOTIFY_CONFIRM'
const CONFIRM_VALUE = 'SI_ENVIAR_AVISO_IDENTIDAD'
const DELAY_MS = 1500

const SQL = `
  SELECT DISTINCT ON (l."userId") l."userId", l.id AS "loanId", l.status, u.email, u.name, p.cuil, p."kycStatus" AS "profileKyc",
         (k.id IS NOT NULL) AS "hasRecord", k.provider, k.status AS "kycStatus", k."expiresAt", k."reviewedAt", k."updatedAt",
         EXISTS (SELECT 1 FROM admin_audit_log a WHERE a.action = '${IDENTITY_NOTICE_ACTION}' AND a."entityId" = l."userId") AS "alreadyNotified"
    FROM loan l
    JOIN "user" u ON u.id = l."userId"
    LEFT JOIN profile p ON p."userId" = l."userId"
    LEFT JOIN kyc_verification k ON k."userId" = l."userId"
   WHERE (l."createdAt" AT TIME ZONE 'UTC') >= $1::timestamptz AND (l."createdAt" AT TIME ZONE 'UTC') < $2::timestamptz
     AND l.status IN ('pending','approved')
   ORDER BY l."userId", l."createdAt" DESC`

type Row = Record<string, any>
const isRecipient = (r: Row) =>
  identityCheck({ provider: r.provider, status: r.kycStatus, expiresAt: r.expiresAt, reviewedAt: r.reviewedAt, updatedAt: r.updatedAt, profileKycStatus: r.profileKyc, hasRecord: r.hasRecord }) !== 'ok'

async function main() {
  const day = opt('--date') ?? arToday()
  const { start, end } = arDayBounds(day)
  const url = resolveDatabaseUrl(opt('--env-file'))
  const send = flag('--send')
  if (send && process.env[CONFIRM_ENV] !== CONFIRM_VALUE) throw new Error(`--send requiere ${CONFIRM_ENV}=${CONFIRM_VALUE}. No se envio nada.`)
  console.log(`${send ? 'MODO ENVIO' : 'SIMULACION (solo lectura)'} | dia ${day} AR | host ${hostOf(url)}`)

  const all = await readOnly(url, (q) => q(SQL, [start, end]))
  const pending = all.filter(isRecipient)
  const todo = pending.filter((r) => !r.alreadyNotified)
  console.log(`Clientes con solicitud abierta ese dia: ${all.length} | sin identidad: ${pending.length} | ya avisados: ${pending.length - todo.length} | a avisar: ${todo.length}`)
  for (const r of todo) console.log(`  ${maskEmail(r.email)}  CUIL ${maskCuil(r.cuil)}  credito \u2026${String(r.loanId).slice(-6)}  ${r.status}`)
  if (!send) return console.log('Simulacion: no se envio ni se escribio nada.')

  const limit = Number(opt('--limit') ?? 25)
  const client = await connect(url)
  let sent = 0
  try {
    for (const r of todo.slice(0, limit)) {
      const msg = identityRequiredEmail({ to: r.email, name: r.name, verifyUrl: identityVerifyUrl() })
      const res = await sendEmail(msg)
      if (!res.ok) {
        console.error(`  no enviado a ${maskEmail(r.email)}: ${res.error}`)
        continue
      }
      await client.query(
        `INSERT INTO admin_audit_log (id, "actorUserId", action, "entityType", "entityId", "targetUserId", severity, summary, changes)
         VALUES ($1, NULL, $2, 'user', $3, $3, 'info', $4, $5::jsonb)`,
        [crypto.randomUUID(), IDENTITY_NOTICE_ACTION, r.userId, 'Aviso de verificacion de identidad enviado por mail', JSON.stringify({ day, loanId: r.loanId, delivered: res.delivered })],
      )
      sent++
      await new Promise((ok) => setTimeout(ok, DELAY_MS))
    }
  } finally {
    await client.end()
  }
  console.log(`Enviados: ${sent} de ${todo.length} (limite ${limit}).`)
}

main().catch((e) => {
  console.error('Error:', e?.message || e)
  process.exit(1)
})