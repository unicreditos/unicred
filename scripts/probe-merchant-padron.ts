import { arcaConfigured, lookupPersonaByCuit } from '../lib/arca/padron'
import { evaluateMerchantKyb } from '../lib/merchant-kyb'
import { isValidCuit, normalizeCuit } from '../lib/bcra'
import { BRAND } from '../lib/brand'
import { loadProjectEnv } from './load-env'
import path from 'node:path'

loadProjectEnv(path.join(process.cwd()))

const targets = Array.from(
  new Set(
    [BRAND.cuit, process.env.AFIP_CUIT, process.argv[2]]
      .map((v) => normalizeCuit(String(v ?? '')))
      .filter((v) => isValidCuit(v)),
  ),
)

async function main() {
  if (!arcaConfigured()) {
    console.error('ARCA no configurado: faltan certificado WSAA / AFIP_CERT.')
    process.exit(1)
  }
  if (!targets.length) {
    console.error('No hay CUIT válido para consultar.')
    process.exit(1)
  }

  let failed = 0
  for (const cuit of targets) {
    const padron = await lookupPersonaByCuit(cuit)
    if (!padron) {
      console.error(`FAIL ${cuit}: padrón sin constancia`)
      failed++
      continue
    }
    const evaluation = evaluateMerchantKyb({
      declaredCuit: cuit,
      padron,
      padronConfigured: true,
      titular: {
        diditApproved: true,
        dni: padron.dni,
        cuil: padron.personType === 'FISICA' ? cuit : null,
      },
      representativeRole: padron.personType === 'JURIDICA' ? 'presidente' : 'titular',
      uploadedDocTypes:
        padron.personType === 'JURIDICA' ? ['estatuto_contrato_social', 'acta_designacion'] : [],
    })
    console.log(
      JSON.stringify(
        {
          cuit,
          name: padron.name,
          personType: padron.personType,
          taxStatus: padron.taxStatus,
          taxCondition: padron.taxCondition,
          monotributoCategory: padron.monotributoCategory,
          taxes: padron.taxes,
          canPersist: evaluation.canPersist,
          canSubmit: evaluation.canSubmit,
          blockers: evaluation.blockers,
        },
        null,
        2,
      ),
    )
  }
  process.exit(failed ? 1 : 0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
