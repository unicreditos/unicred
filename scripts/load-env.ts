import path from 'node:path'
import fs from 'node:fs'
import dotenv from 'dotenv'

/** Carga los archivos .env locales con soporte para sobrescribir placeholders */
export function loadProjectEnv(root = process.cwd()) {
  const files = [
    '.env.production.local',
    '.env.local',
    '.env.development.local',
    '.env.production',
    '.env',
  ]
  for (const file of files) {
    const fullPath = path.join(root, file)
    if (fs.existsSync(fullPath)) {
      try {
        const parsed = dotenv.parse(fs.readFileSync(fullPath))
        for (const [k, v] of Object.entries(parsed)) {
          if (
            !process.env[k] ||
            process.env[k].includes('host.neon.tech') ||
            process.env[k].includes('usuario:password') ||
            (v && v.trim() !== '')
          ) {
            process.env[k] = v
          }
        }
      } catch {
        // Ignorar errores de sintaxis
      }
    }
  }
}
