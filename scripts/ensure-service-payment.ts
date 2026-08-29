import { loadProjectEnv } from './load-env'
import path from 'node:path'

loadProjectEnv(path.join(process.cwd()))

async function main() {
  const { pool } = await import('../lib/db')
  await pool.query(`
    CREATE TABLE IF NOT EXISTS service_payment (
      id text PRIMARY KEY,
      "userId" text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
      "walletId" text NOT NULL REFERENCES wallet_account(id) ON DELETE CASCADE,
      "providerId" text NOT NULL,
      "providerName" text NOT NULL,
      category text NOT NULL,
      kind text NOT NULL,
      "accountRef" text NOT NULL,
      amount numeric(14, 2) NOT NULL,
      currency text NOT NULL DEFAULT 'ARS',
      status text NOT NULL DEFAULT 'queued',
      reference text NOT NULL UNIQUE,
      "movementId" text,
      "providerPayload" jsonb,
      "executedAt" timestamptz,
      "failureReason" text,
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS service_payment_user_idx ON service_payment ("userId");
    CREATE INDEX IF NOT EXISTS service_payment_status_idx ON service_payment (status);
  `)
  console.log('service_payment OK')
  await pool.end()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
