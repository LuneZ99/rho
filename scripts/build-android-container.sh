#!/usr/bin/env bash
set -euo pipefail
restore_ownership() {
  find /app/apps/mobile/android /app/apps/mobile/node_modules /app/node_modules /app/.local /app/artifacts -uid 0 -exec chown "$(stat -c %u:%g /app)" {} +
}
trap restore_ownership EXIT
if [[ ! -f /app/.local/rho-release.keystore ]]; then
  keytool -genkeypair -keystore /app/.local/rho-release.keystore -storepass:file /app/.local/signing.password -keypass:file /app/.local/signing.password -alias rho -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=rho personal demo" >/dev/null 2>&1
fi
cd /app/apps/mobile
npx expo prebuild --platform android --no-install --no-clean
cd android
./gradlew :app:assembleRelease --build-cache --init-script /app/deploy/signing.gradle -PreactNativeArchitectures=arm64-v8a,x86_64 --max-workers=8 --info -Dorg.gradle.jvmargs="-Xmx6g -XX:MaxMetaspaceSize=2g -Dfile.encoding=UTF-8"
# 原子替换，避免网页版下载过程中读到正在复制的安装包。
cp app/build/outputs/apk/release/app-release.apk /app/artifacts/.rho-demo.apk.next
mv /app/artifacts/.rho-demo.apk.next /app/artifacts/rho-demo.apk
