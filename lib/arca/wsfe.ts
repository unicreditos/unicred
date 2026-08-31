import { getAFIPCredentials, getTicketAcceso } from '@/lib/arca/wsaa'

const WSFE = {
  testing: 'https://wswhomo.afip.gov.ar/wsfev1/service.asmx?WSDL',
  production: 'https://servicios1.afip.gov.ar/wsfev1/service.asmx?WSDL',
} as const

export type WsfeCaeResult = {
  ok: true
  cae: string
  caeVto: string
  cbteNro: number
  ptoVta: number
  cbteTipo: number
} | {
  ok: false
  error: string
}

function yyyymmdd(d = new Date()) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}${m}${day}`
}

function round2(n: number) {
  return Math.round(n * 100) / 100
}

export function wsfePointOfSale() {
  const n = Number(process.env.AFIP_PTO_VTA || '1')
  return Number.isInteger(n) && n > 0 ? n : 1
}

export function wsfeConfigured() {
  return Boolean(getAFIPCredentials())
}

/**
 * Factura B (tipo 6) al consumidor: IVA 21% sobre el interés de la cuota.
 * El capital no se factura. Si ARCA no está configurado, el caller deja pending_cae.
 */
export async function emitFacturaBInterest(input: {
  docNro: string
  impNeto: number
  impIva: number
}): Promise<WsfeCaeResult> {
  const creds = getAFIPCredentials()
  if (!creds) {
    return { ok: false, error: 'Sin certificado ARCA/AFIP. La factura queda en cola de CAE.' }
  }
  const cuit = Number(String(creds.cuit).replace(/\D/g, ''))
  const docNro = Number(String(input.docNro).replace(/\D/g, ''))
  if (!Number.isFinite(cuit) || String(cuit).length < 10) {
    return { ok: false, error: 'CUIT emisor inválido.' }
  }
  if (!Number.isFinite(docNro) || String(docNro).length < 7) {
    return { ok: false, error: 'CUIT/CUIL del receptor inválido.' }
  }
  const impNeto = round2(input.impNeto)
  const impIva = round2(input.impIva)
  const impTotal = round2(impNeto + impIva)
  if (impNeto <= 0 || impIva < 0) {
    return { ok: false, error: 'No hay interés gravado para facturar.' }
  }

  const ptoVta = wsfePointOfSale()
  const cbteTipo = 6
  const ticket = await getTicketAcceso('wsfe')
  const soap = await import('soap')
  const client = await soap.createClientAsync(WSFE[creds.environment], {
    wsdl_options: { timeout: 30000 },
  })
  const Auth = { Token: ticket.token, Sign: ticket.sign, Cuit: cuit }

  const [ultimo] = await client.FECompUltimoAutorizadoAsync({
    Auth,
    PtoVta: ptoVta,
    CbteTipo: cbteTipo,
  })
  const last = Number(ultimo?.FECompUltimoAutorizadoResult?.CbteNro ?? 0)
  const cbteNro = last + 1
  const fecha = yyyymmdd()

  const [res] = await client.FECAESolicitarAsync({
    Auth,
    FeCAEReq: {
      FeCabReq: { CantReg: 1, PtoVta: ptoVta, CbteTipo: cbteTipo },
      FeDetReq: {
        FECAEDetRequest: {
          Concepto: 2,
          DocTipo: 80,
          DocNro: docNro,
          CbteDesde: cbteNro,
          CbteHasta: cbteNro,
          CbteFch: fecha,
          ImpTotal: impTotal,
          ImpTotConc: 0,
          ImpNeto: impNeto,
          ImpOpEx: 0,
          ImpIVA: impIva,
          ImpTrib: 0,
          FchServDesde: fecha,
          FchServHasta: fecha,
          FchVtoPago: fecha,
          MonId: 'PES',
          MonCotiz: 1,
          Iva: { AlicIva: [{ Id: 5, BaseImp: impNeto, Importe: impIva }] },
        },
      },
    },
  })

  const result = res?.FECAESolicitarResult
  const det = result?.FeDetResp?.FECAEDetResponse
  const obs = result?.Errors?.Err || det?.Observaciones?.Obs
  const cae = String(det?.CAE ?? '')
  const caeVto = String(det?.CAEFchVto ?? '')
  const resultado = String(det?.Resultado ?? result?.FeCabResp?.Resultado ?? '')
  if (cae && (resultado === 'A' || resultado === 'Aprobado')) {
    return { ok: true, cae, caeVto, cbteNro, ptoVta, cbteTipo }
  }
  const msg = Array.isArray(obs)
    ? obs.map((o: { Msg?: string }) => o.Msg).filter(Boolean).join('; ')
    : typeof obs === 'object' && obs
      ? String((obs as { Msg?: string }).Msg ?? JSON.stringify(obs))
      : resultado || 'ARCA no autorizó el CAE'
  return { ok: false, error: msg }
}
