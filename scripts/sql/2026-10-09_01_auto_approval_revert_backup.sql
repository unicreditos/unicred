-- scripts/sql/2026-10-09_01_auto_approval_revert_backup.sql
-- Idempotente y aditivo. NO aplicado. Aplicar a mano solo con aprobacion de Angel.
CREATE TABLE IF NOT EXISTS loan_autoapproval_revert_backup (
  id            text PRIMARY KEY,
  "runId"       text NOT NULL,
  "loanId"      text NOT NULL,
  "loanRow"     jsonb NOT NULL,
  "contractRow" jsonb,
  "revertedAt"  timestamptz NOT NULL DEFAULT now(),
  "revertedBy"  text,
  "restoredAt"  timestamptz
);
CREATE INDEX IF NOT EXISTS loan_autoapproval_revert_backup_run_idx ON loan_autoapproval_revert_backup ("runId");
CREATE UNIQUE INDEX IF NOT EXISTS loan_autoapproval_revert_backup_run_loan_uq ON loan_autoapproval_revert_backup ("runId", "loanId");