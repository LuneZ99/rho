#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p .local .build artifacts
chmod 700 .local
if [[ ! -f .local/signing.password || ! -f .local/rho-release.keystore ]]; then
  echo '缺少原签名材料。请从安全备份恢复到 .local/，不要为已有应用另建签名。' >&2
  exit 1
fi
docker image inspect rho-android-build >/dev/null 2>&1 || docker build -t rho-android-build -f deploy/Dockerfile.android .
docker run --rm --init --name rho-android-compile -e LANG=C.UTF-8 -v "$PWD:/app" -v rho_gradle:/root/.gradle rho-android-build bash /app/scripts/build-android-container.sh
sha256sum artifacts/rho-demo.apk > artifacts/rho-demo.apk.sha256
