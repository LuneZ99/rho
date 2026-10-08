#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
umask 077
backup_dir=".local/backups/$(date +%Y%m%d-%H%M%S)"
mkdir -p "$backup_dir"
docker compose stop api worker
trap 'docker compose start api worker' EXIT
docker compose exec -T db pg_dump -U rho -Fc rho > "$backup_dir/database.dump"
docker compose run --rm --no-deps -T worker tar -C /data/agent -czf - . > "$backup_dir/agent.tar.gz"
cp .env "$backup_dir/env"
for signing_file in .local/rho-release.keystore .local/signing.password; do
  if [[ -f "$signing_file" ]]; then cp "$signing_file" "$backup_dir/"; fi
done
printf '备份完成：%s\n' "$backup_dir"
