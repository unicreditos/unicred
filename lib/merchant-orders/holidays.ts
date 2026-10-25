/**
 * Feriados bancarios para el calendario de liquidación. La lista fija de `rules.ts` es el respaldo; el cron
 * trae cada año de la fuente pública y lo guarda en `bank_holiday`, y antes de calcular una fecha de pago el
 * servidor suma lo guardado. Así el calendario no depende de que alguien edite código cada diciembre.
 */
import { db } from '@/lib/db'
import { ensureMerchantCommerceSchema } from '@/lib/db/ensure-merchant-commerce'
import { bankHoliday } from '@/lib/db/schema'
import { registerBankHolidays } from '@/lib/merchant-orders/rules'
import { sql } from 'drizzle-orm'

const SOURCE_URL = 'https://api.argentinadatos.com/v1/feriados'
const CACHE_MS = 60 * 60 * 1000

let loadedAt = 0

/** Suma al calendario en memoria los feriados guardados. Cacheado una hora por instancia. */
export async function loadBankHolidays() {
  if (Date.now() - loadedAt < CACHE_MS) return
  try {
    await ensureMerchantCommerceSchema()
    const rows = await db.select({ date: bankHoliday.date }).from(bankHoliday)
    registerBankHolidays(rows.map((r) => r.date))
    loadedAt = Date.now()
  } catch (err) {
    // Sin base usamos la lista fija: nunca frena una entrega.
    console.error('[holidays] no se pudieron leer los feriados guardados:', err instanceof Error ? err.message : err)
  }
}

type SourceRow = { fecha?: unknown; nombre?: unknown; tipo?: unknown }

async function fetchYear(year: number) {
  const res = await fetch(`${SOURCE_URL}/${year}`, { cache: 'no-store', signal: AbortSignal.timeout(10_000) })
  if (!res.ok) throw new Error(`fuente de feriados ${year}: HTTP ${res.status}`)
  const data = (await res.json()) as unknown
  if (!Array.isArray(data)) throw new Error(`fuente de feriados ${year}: respuesta inesperada`)
  return (data as SourceRow[])
    .map((r) => ({ date: String(r.fecha ?? ''), name: r.nombre ? String(r.nombre).slice(0, 160) : null, kind: r.tipo ? String(r.tipo).slice(0, 40) : null }))
    .filter((r) => /^\d{4}-\d{2}-\d{2}$/.test(r.date) && r.date.startsWith(`${year}-`))
}

/** Trae el año actual y el siguiente de la fuente oficial y los guarda. Solo agrega o actualiza. */
export async function refreshBankHolidays(now: Date = new Date()) {
  await ensureMerchantCommerceSchema()
  const year = Number(now.toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }).slice(0, 4))
  const out: Record<number, number | string> = {}
  for (const y of [year, year + 1]) {
    try {
      const rows = await fetchYear(y)
      // El año siguiente puede no estar publicado todavía: una lista vacía no es error.
      if (rows.length) {
        await db
          .insert(bankHoliday)
          .values(rows.map((r) => ({ ...r, source: 'argentinadatos', updatedAt: new Date() })))
          .onConflictDoUpdate({ target: bankHoliday.date, set: { name: sql`excluded.name`, kind: sql`excluded.kind`, updatedAt: new Date() } })
        registerBankHolidays(rows.map((r) => r.date))
      }
      out[y] = rows.length
    } catch (err) {
      out[y] = err instanceof Error ? err.message : 'error'
    }
  }
  loadedAt = 0
  return out
}
