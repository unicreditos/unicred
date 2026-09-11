'use server'

import { createArcaSalesPointVersion as createArcaSalesPointVersionImpl, getArcaSalesPointDeskData } from '@/lib/arca/config'

export async function getArcaSalesPointConfig() {
  const { versions, canWrite } = await getArcaSalesPointDeskData()
  return {
    canWrite,
    versions: versions.map((v) => ({ ...v, createdAt: v.createdAt.toISOString() })),
  }
}

export async function createArcaSalesPointVersion(input: { ptoVta: number; notes: string }) {
  return createArcaSalesPointVersionImpl(input)
}
