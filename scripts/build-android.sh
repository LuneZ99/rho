#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p .local .build artifacts
chmod 700 .local
if [[ ! -f .local/signing.password ]]; then openssl rand -hex 32 > .local/signing.password; chmod 600 .local/signing.password; fi
docker image inspect rho-android-build >/dev/null 2>&1 || docker build -t rho-android-build -f deploy/Dockerfile.android .
docker run --rm --init --name rho-android-compile -e LANG=C.UTF-8 -v "$PWD:/app" -v rho_gradle:/root/.gradle rho-android-build bash /app/scripts/build-android-container.sh
sha256sum artifacts/rho-demo.apk > artifacts/rho-demo.apk.sha256
