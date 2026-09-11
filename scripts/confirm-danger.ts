/**
 * Gate para scripts que escriben o borran datos reales contra la DATABASE_URL
 * que esté activa en el momento (dev o producción, según qué .env se haya
 * cargado). Sin esto, correr el script a mano contra la base equivocada no
 * tiene ninguna fricción ni aviso.
 */
function maskDbTarget(url: string | undefined): string {
  if (!url) return '(sin DATABASE_URL)'
  try {
    const u = new URL(url)
    return `${u.hostname}${u.pathname}`
  } catch {
    return '(no se pudo parsear DATABASE_URL)'
  }
}

export function confirmDangerousScript(label: string) {
  const target = maskDbTarget(process.env.DATABASE_URL)
  console.log(`\n⚠️  ${label}`)
  console.log(`   Base de datos objetivo: ${target}`)
  if (!process.argv.includes('--yes')) {
    console.error('\nEste script escribe o borra datos reales. Volvé a correrlo agregando --yes al final si confirmás que esa es la base correcta.')
    process.exit(1)
  }
  console.log('   Confirmado con --yes. Continuando...\n')
}
