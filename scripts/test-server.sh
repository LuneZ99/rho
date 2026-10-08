#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
docker compose exec -T db sh -c 'psql -U rho -tc "SELECT 1 FROM pg_database WHERE datname='"'"'rho_test'"'"'" | grep -q 1 || createdb -U rho rho_test'
docker compose run --rm --no-deps -v "$PWD/apps/server:/app/apps/server:ro" api sh -c 'export DATABASE_URL="${DATABASE_URL%/rho}/rho_test"; npm test'
