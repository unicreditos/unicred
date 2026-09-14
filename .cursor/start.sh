#!/usr/bin/env bash
# Cloud Agent start: bring up local Postgres on every boot. Idempotent.
set -euo pipefail

PG_VER="$(ls /usr/lib/postgresql/ 2>/dev/null | sort -n | tail -1)"
sudo pg_ctlcluster "$PG_VER" main start 2>/dev/null || true

for _ in $(seq 1 30); do
  if pg_isready -q -h 127.0.0.1 -p 5432; then
    echo "[start] postgres ready"
    exit 0
  fi
  sleep 1
done

echo "[start] postgres did not become ready" >&2
exit 1
