import { Badge, Callout, Grid, Kv, NoAccess, PageHead, Pad, CardHead } from '@/components/uc/blocks'
import type { Tone } from '@/components/uc/grid-types'
import { loadDesk } from '@/lib/admin-desk/load'
import { money } from '@/lib/uc/format'

export const metadata = { title: 'Configuración' }

const set = (...names: string[]) => names.every((n) => Boolean(process.env[n]?.trim()))

export default async function ConfiguracionPage() {
  const { state, perms } = await loadDesk()
  const head = <PageHead title="Configuración" description="Parámetros generales del sistema, en modo lectura." />
  if (!perms.has('users.manage')) return <>{head}<NoAccess what="la configuración" /></>

  const { config, products } = state
  const active = products.filter((p) => p.active)
  const min = active.length ? Math.min(...active.map((p) => p.minAmount)) : 0
  const max = active.length ? Math.max(...active.map((p) => p.maxAmount)) : 0
  const terms = active.length ? `${Math.min(...active.map((p) => p.minInstallments))} a ${Math.max(...active.map((p) => p.maxInstallments))}` : '—'

  const integrations: Array<{ code: string; name: string; what: string; ok: boolean }> = [
    { code: 'MP', name: 'Mercado Pago', what: 'Cobro de cuotas y webhooks', ok: set('MERCADO_PAGO_ACCESS_TOKEN') && set('MERCADO_PAGO_WEBHOOK_SECRET') },
    { code: 'DI', name: 'Didit', what: 'Validación de identidad y prueba de vida', ok: set('DIDIT_API_KEY') },
    { code: 'AR', name: 'ArgenAPI', what: 'Validación de CBU, CVU y alias', ok: set('ARGENAPI_API_KEY') },
    { code: 'RE', name: 'Resend', what: 'Emails transaccionales', ok: set('RESEND_API_KEY') },
  ]

  return (
    <>
      {head}
      <div style={{ marginBottom: 20 }}>
        <Callout icon="lock" title="Cambios fuera de esta pantalla">
          Estos valores salen del código y de las variables de entorno. Para modificarlos hay que cambiarlos en la configuración del proyecto (y
          queda en el historial de despliegues).
        </Callout>
      </div>
      <Grid cols="2">
        <Pad>
          <CardHead title="Parámetros de crédito" />
          <Kv
            rows={[
              ['Monto mínimo', <span key="a" className="uc-num">{money(min)}</span>],
              ['Monto máximo', <span key="b" className="uc-num">{money(max)}</span>],
              ['Cuotas', terms],
              ['Productos activos', <span key="c" className="uc-num">{active.length}</span>],
              ['Intereses punitorios', config.punitiveInterest ? 'Activos' : 'Desactivados'],
            ]}
          />
        </Pad>
        <Pad>
          <CardHead title="Operación" />
          <Kv
            rows={[
              ['Desembolso', config.manualDisbursement ? 'Manual, con confirmación' : 'Automático'],
              ['Proveedor de identidad', 'Didit'],
              ['Plazo de gestión de cobranzas', `${config.collectionsSlaHours} horas`],
              ['Moneda', config.currency],
              ['Zona horaria', config.timezone],
              ['Email de soporte', config.supportEmail],
            ]}
          />
        </Pad>
        <Pad>
          <CardHead title="Empresa" />
          <Kv rows={[['Razón social', config.companyName], ['CUIT', <span key="c" className="uc-num">{config.cuit}</span>]]} />
        </Pad>
        <Pad>
          <CardHead title="Integraciones" />
          {integrations.map((i) => {
            const tone: Tone = i.ok ? 'success' : 'warning'
            return (
              <div key={i.code} className="uc-integr">
                <span className="uc-logo-sq">{i.code}</span>
                <span className="uc-tx">
                  <b>{i.name}</b>
                  <small>{i.what}</small>
                </span>
                <Badge tone={tone}>{i.ok ? 'Configurado' : 'Falta configurar'}</Badge>
              </div>
            )
          })}
        </Pad>
      </Grid>
    </>
  )
}
