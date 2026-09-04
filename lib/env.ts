/**
 * Verificación de configuración. En producción, arrancar sin estas variables
 * deja la app en un estado inseguro, así que se corta el arranque.
 */

type EnvCheck = {
  name: string
  required: boolean
  detail: string
}

/**
 * Vercel siempre buildea con NODE_ENV=production, incluso los previews de PR
 * — así que NODE_ENV solo no alcanza para saber si esto es tráfico real.
 * VERCEL_ENV sí distingue 'production' de 'preview'; fuera de Vercel (Docker,
 * otro host) no existe esa variable y NODE_ENV vuelve a ser la señal válida.
 */
function isProduction() {
  if (process.env.VERCEL_ENV) return process.env.VERCEL_ENV === 'production'
  return process.env.NODE_ENV === 'production'
}

function checks(): EnvCheck[] {
  const prod = isProduction()
  return [
    { name: 'DATABASE_URL', required: true, detail: 'Conexión a Postgres (Neon).' },
    {
      name: 'BETTER_AUTH_SECRET',
      required: true,
      detail: 'Secreto de firma de sesiones. Generá uno con `openssl rand -base64 48`.',
    },
    {
      name: 'NEXT_PUBLIC_SITE_URL',
      required: true,
      detail: 'URL canónica HTTPS (https://unicreditos.com).',
    },
    {
      name: 'BETTER_AUTH_URL',
      required: prod,
      detail: 'Debe coincidir con NEXT_PUBLIC_SITE_URL en el host.',
    },
    {
      name: 'MERCADO_PAGO_ACCESS_TOKEN',
      required: prod,
      detail: 'Sin esto no se pueden generar links de pago.',
    },
    {
      name: 'MERCADO_PAGO_WEBHOOK_SECRET',
      required: prod,
      detail: 'Sin esto el webhook rechaza todas las notificaciones y no se acreditan cuotas.',
    },
    {
      name: 'CRON_SECRET',
      // Opcional: sin secreto los crons quedan cerrados (401). No tumba /api/health.
      required: false,
      detail: 'Bearer para /api/cron/* (Vercel Cron). Sin esto no corren reconcile MP/KYC.',
    },
    {
      name: 'RESEND_API_KEY',
      required: false,
      detail: 'Sin una key `re_…` no se envían correos de recuperación ni contacto.',
    },
    {
      name: 'DIDIT_API_KEY',
      required: prod,
      detail: 'Sin esto no se puede iniciar la verificación de identidad Didit.',
    },
    {
      name: 'DIDIT_WEBHOOK_SECRET',
      required: prod,
      detail: 'Sin esto el webhook de Didit se rechaza y el KYC no se actualiza solo.',
    },
    {
      name: 'AFIP_PTO_VTA',
      required: false,
      detail: 'Punto de venta WsFE para facturar IVA sobre intereses. Sin esto la factura queda en cola de CAE.',
    },
  ]
}

export type EnvReport = {
  ok: boolean
  missingRequired: EnvCheck[]
  missingOptional: EnvCheck[]
}

export function checkEnv(): EnvReport {
  const missingRequired: EnvCheck[] = []
  const missingOptional: EnvCheck[] = []

  for (const check of checks()) {
    if (process.env[check.name]) continue
    if (check.required) missingRequired.push(check)
    else missingOptional.push(check)
  }

  if (process.env.ALLOW_SESSION_OVERRIDE === 'true' && isProduction()) {
    missingRequired.push({
      name: 'ALLOW_SESSION_OVERRIDE',
      required: true,
      detail: 'Debe estar desactivada en producción: permite saltear la validación de sesión.',
    })
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? ''
  if (isProduction() && /localhost|127\.0\.0\.1/i.test(siteUrl)) {
    missingRequired.push({
      name: 'NEXT_PUBLIC_SITE_URL',
      required: true,
      detail: 'En producción tiene que ser la URL pública HTTPS, no localhost.',
    })
  }

  const mpToken = process.env.MERCADO_PAGO_ACCESS_TOKEN ?? ''
  if (isProduction() && mpToken.startsWith('TEST-')) {
    missingRequired.push({
      name: 'MERCADO_PAGO_ACCESS_TOKEN',
      required: true,
      detail: 'En producción tiene que ser un token live (APP_USR-), no TEST-.',
    })
  }

  const resend = process.env.RESEND_API_KEY ?? ''
  if (resend && !resend.startsWith('re_')) {
    const item = {
      name: 'RESEND_API_KEY',
      required: isProduction(),
      detail: 'Tiene que ser una API key de Resend (empieza con re_). La actual no es válida.',
    }
    if (item.required) missingRequired.push(item)
    else missingOptional.push(item)
  }

  return { ok: missingRequired.length === 0, missingRequired, missingOptional }
}

export function assertProductionEnv(): void {
  const report = checkEnv()

  for (const item of report.missingOptional) {
    console.warn(`[env] Falta ${item.name}: ${item.detail}`)
  }

  if (report.ok) return

  const detail = report.missingRequired.map((m) => `  - ${m.name}: ${m.detail}`).join('\n')
  const message = `Configuración incompleta:\n${detail}`

  if (isProduction()) {
    throw new Error(message)
  }
  console.warn(`[env] ${message}`)
}
