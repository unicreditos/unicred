import { desc, eq, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { ensureAppTables } from '@/lib/db/ensure'
import { mpQrOrder, mpQrPayment, mpQrPos, user as userTable } from '@/lib/db/schema'

/** Panel de administración de los cobros con QR: cajas, pagos recibidos y lo que requiere atención. */
export async function getQrAdminOverview() {
  await ensureAppTables()
  const [kpi, payments, boxes] = await Promise.all([
    db
      .select({
        posActive: sql<number>`(select count(*) from mp_qr_pos where status = 'active')::int`,
        posTotal: sql<number>`(select count(*) from mp_qr_pos)::int`,
        collected: sql<string>`coalesce(sum("creditedAmount") filter (where status in ('credited','reversed','reversal_pending')),0)::text`,
        reversed: sql<string>`coalesce(sum("reversedAmount"),0)::text`,
        fees: sql<string>`coalesce(sum(fee) filter (where status in ('credited','reversed','reversal_pending')),0)::text`,
        credited: sql<number>`count(*) filter (where status in ('credited','reversed','reversal_pending'))::int`,
        unmatched: sql<number>`count(*) filter (where status = 'unmatched')::int`,
        reversalPending: sql<number>`count(*) filter (where status = 'reversal_pending')::int`,
        pending: sql<number>`count(*) filter (where status = 'pending')::int`,
        openOrders: sql<number>`(select count(*) from mp_qr_order where status = 'created')::int`,
      })
      .from(mpQrPayment),
    db
      .select({ p: mpQrPayment, name: userTable.name, email: userTable.email })
      .from(mpQrPayment)
      .leftJoin(userTable, eq(userTable.id, mpQrPayment.userId))
      .orderBy(desc(mpQrPayment.createdAt))
      .limit(50),
    db
      .select({
        pos: mpQrPos,
        name: userTable.name,
        collected: sql<string>`coalesce((select sum("creditedAmount" - "reversedAmount") from mp_qr_payment p where p."userId" = ${mpQrPos.userId} and p.status in ('credited','reversed','reversal_pending')),0)::text`,
        orders: sql<number>`(select count(*) from mp_qr_order o where o."userId" = ${mpQrPos.userId} and o.status <> 'failed')::int`,
      })
      .from(mpQrPos)
      .innerJoin(userTable, eq(userTable.id, mpQrPos.userId))
      .orderBy(desc(mpQrPos.createdAt))
      .limit(50),
  ])
  return { kpi: kpi[0], payments, boxes }
}

export { mpQrOrder }
