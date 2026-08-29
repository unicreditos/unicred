import { loadProjectEnv } from './load-env'
import path from 'node:path'

loadProjectEnv(path.join(process.cwd()))

async function main() {
  const { pool } = await import('../lib/db')
  await pool.query(`
    CREATE TABLE IF NOT EXISTS wallet_payout (
      id text PRIMARY KEY,
      "userId" text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
      "walletId" text NOT NULL REFERENCES wallet_account(id) ON DELETE CASCADE,
      status text NOT NULL DEFAULT 'queued',
      amount numeric(14, 2) NOT NULL,
      currency text NOT NULL DEFAULT 'ARS',
      "destinationKind" text NOT NULL,
      "destinationValue" text NOT NULL,
      concept text,
      reference text NOT NULL UNIQUE,
      "treasuryCbu" text NOT NULL,
      rail text NOT NULL DEFAULT 'treasury_rm',
      "providerPayload" jsonb,
      "executedAt" timestamptz,
      "executedBy" text,
      "failureReason" text,
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now()
    );
    ALTER TABLE wallet_account ADD COLUMN IF NOT EXISTS "pomeloAccountId" text;
    ALTER TABLE wallet_movement ADD COLUMN IF NOT EXISTS "payoutId" text;
    ALTER TABLE wallet_movement ADD COLUMN IF NOT EXISTS "counterpartyUserId" text;
    CREATE INDEX IF NOT EXISTS wallet_payout_user_idx ON wallet_payout ("userId");
    CREATE INDEX IF NOT EXISTS wallet_payout_status_idx ON wallet_payout (status);
  `)
  console.log('wallet_payout OK')
  await pool.end()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
