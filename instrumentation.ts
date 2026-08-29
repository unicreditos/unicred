export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  const { assertProductionEnv } = await import('@/lib/env')
  // No tumbar el runtime entero: un deploy con dominio en otra cuenta Vercel
  // puede tener env incompleto; preferimos sitio degradado a 500 global.
  try {
    assertProductionEnv()
  } catch (err) {
    console.error('[env] arranque con configuración incompleta:', (err as Error).message)
  }
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
