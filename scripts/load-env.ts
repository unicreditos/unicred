import path from 'node:path'
import dotenv from 'dotenv'

/** Carga los mismos archivos que Next, en el mismo orden de prioridad. */
export function loadProjectEnv(root = process.cwd()) {
  const prod = process.env.NODE_ENV === 'production'
  const files = prod
    ? ['.env.production.local', '.env.local', '.env.production', '.env']
    : ['.env.development.local', '.env.local', '.env.development', '.env']
  for (const file of files) {
    dotenv.config({ path: path.join(root, file) })
  }
}
