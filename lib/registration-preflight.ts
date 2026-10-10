import { arcaConfigured, lookupPersonaByCuit, type ArcaPersona } from '@/lib/arca/padron'
import { consultFullBcra } from '@/lib/bcra'
import {
  arcaRequiredForClients,
  bcraPreflightEnabled,
  decidePreflight,
  withRetry,
  type PreflightDecision,
} from '@/lib/registration-preflight-core'

/**
 * Control previo al alta: se consulta BCRA y ARCA ANTES de escribir nada del perfil.
 * 3 reintentos con espera creciente en cada consulta. No guarda nada: solo decide.
 */
export async function runRegistrationPreflight(input: {
  cuil: string
  declaredName: string
}): Promise<PreflightDecision & { persona: ArcaPersona | null; attempts: { bcra: number; arca: number } }> {
  const bcraRequired = bcraPreflightEnabled()
  const arcaRequired = arcaRequiredForClients()

  const bcraRes = bcraRequired
    ? await withRetry(() => consultFullBcra(input.cuil), { isFailure: (s) => Boolean(s?.unavailable) })
    : ({ ok: true, value: null, attempts: 0 } as const)

  const configured = arcaConfigured()
  const arcaRes =
    arcaRequired && configured
      ? await withRetry(() => lookupPersonaByCuit(input.cuil), { isFailure: (p) => !p })
      : ({ ok: true, value: null, attempts: 0 } as const)
  const persona = arcaRes.ok ? arcaRes.value : null

  const decision = decidePreflight({
    bcra: { ok: bcraRes.ok, error: bcraRes.ok ? undefined : bcraRes.error },
    arca: {
      configured,
      found: !!persona,
      // Si ARCA no respondio tras los reintentos es una caida, no un "no figura".
      error: !arcaRes.ok || (arcaRequired && configured && !persona) ? 'sin_respuesta' : undefined,
      name: persona?.name ?? null,
      taxStatus: persona?.taxStatus ?? null,
    },
    declaredName: input.declaredName,
    arcaRequired,
    bcraRequired,
  })
  return { ...decision, persona, attempts: { bcra: bcraRes.attempts, arca: arcaRes.attempts } }
}