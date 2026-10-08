import { desc, eq } from 'drizzle-orm'
import { BCRAScore } from '@/components/dashboard/bcra-score'
import { Badge, CardHead, Kv, Pad, PageHead } from '@/components/uc/blocks'
import { db } from '@/lib/db'
import { bcraCheck } from '@/lib/db/schema'
import { loadCustomer } from '@/lib/customer/load'
import { fdate, money } from '@/lib/uc/format'

export const metadata = { title: 'Informe BCRA' }

export default async function BcraPage() {
  const { userId, profile } = await loadCustomer()
  const last = await db
    .select()
    .from(bcraCheck)
    .where(eq(bcraCheck.userId, userId))
    .orderBy(desc(bcraCheck.createdAt))
    .limit(1)
    .then((r) => r[0] ?? null)
    .catch(() => null)
  const sit = last?.worstSituation ?? null

  return (
    <>
      <PageHead title="Informe BCRA" description="Tu situación en la Central de Deudores del Banco Central. Solo a título informativo y con tu consentimiento." />
      <Pad style={{ marginBottom: 20 }}>
        <CardHead
          title="Última consulta"
          aside={sit ? <Badge tone={sit === 1 ? 'success' : sit === 2 ? 'warning' : 'danger'}>Situación {sit}</Badge> : <Badge tone="neutral">{last ? 'Sin deudas' : 'Sin consultar'}</Badge>}
        />
        {last ? (
          <Kv
            rows={[
              ['Situación', sit ? `${sit}${sit === 1 ? ' · Normal' : ''}` : 'Sin deudas informadas'],
              ['Entidades informantes', <span key="e" className="uc-num">{last.entitiesCount ?? 0}</span>],
              ['Deuda informada', <span key="d" className="uc-num">{money(Number(last.totalDebt) || 0)}</span>],
              ['Fecha', <span key="u" className="uc-num">{fdate((last.consultedAt ?? last.createdAt) as Date)}</span>],
            ]}
          />
        ) : (
          <p className="uc-note">Todavía no se consultó. Se hace cuando pedís un crédito, o cuando lo pedís vos desde acá.</p>
        )}
      </Pad>
      <BCRAScore profile={profile} lastBcraCheck={last} />
    </>
  )
}
