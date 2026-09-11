export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  const { assertProductionEnv } = await import('@/lib/env')
  // assertProductionEnv() ya distingue producción real de un preview de PR
  // (VERCEL_ENV, no NODE_ENV) y solo lanza en producción real — ahí sí
  // queremos cortar el arranque: un sitio "degradado" con pagos/KYC rotos
  // frente a clientes reales es peor que no levantar.
  assertProductionEnv()
  try {
    const { applyEmitiaAfipEnv } = await import('@/lib/arca/emitia-certs')
    const bundle = applyEmitiaAfipEnv()
    if (bundle) {
      const tail = bundle.cuit.slice(-4)
      console.info(`[arca] certificados Emitia listos (${bundle.source}, CUIT …${tail}, ${bundle.environment})`)
    } else {
      console.warn('[arca] no se encontraron certificados en emitia/certificates ni AFIP_*')
    }
  } catch (err) {
    console.warn('[arca] certificados no cargados:', (err as Error).message)
  }
  if (process.env.DIDIT_API_KEY) {
    console.info('[didit] API key cargada; webhook', process.env.DIDIT_WEBHOOK_SECRET ? 'con secreto' : 'sin secreto')
  } else {
    console.warn('[didit] falta DIDIT_API_KEY')
  }
}
