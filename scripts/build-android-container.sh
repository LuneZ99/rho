#!/usr/bin/env bash
set -euo pipefail
restore_ownership() {
  find /app/apps/mobile/android /app/apps/mobile/node_modules /app/node_modules /app/.local /app/artifacts -uid 0 -exec chown "$(stat -c %u:%g /app)" {} +
}
trap restore_ownership EXIT
export AAPT=/opt/android/build-tools/36.0.0/aapt
export APKSIGNER=/opt/android/build-tools/36.0.0/apksigner
cd /app
version=$(node -p 'require("./apps/mobile/app.json").expo.version')
notes="releases/$version.md"
[[ -f "$notes" ]] || { echo "缺少发布说明：$notes" >&2; exit 1; }
# 迁移旧发布：先留存当前可下载的 APK，禁止新版构建把历史抹掉。
if [[ -f artifacts/rho-demo.apk ]]; then
  previous_version=$($AAPT dump badging artifacts/rho-demo.apk | sed -n "s/.*versionName='\([^']*\)'.*/\1/p" | head -1)
  previous_notes="releases/$previous_version.md"
  [[ -f "$previous_notes" ]] || { echo "请先为旧版补充发布说明：$previous_notes" >&2; exit 1; }
  npx tsx scripts/archive-release.ts artifacts/rho-demo.apk "$previous_notes" --import
fi
cd /app/apps/mobile
npx expo prebuild --platform android --no-install --no-clean
cd android
./gradlew :app:assembleRelease --build-cache --init-script /app/deploy/signing.gradle -PreactNativeArchitectures=arm64-v8a,x86_64 --max-workers=8 --info -Dorg.gradle.jvmargs="-Xmx6g -XX:MaxMetaspaceSize=2g -Dfile.encoding=UTF-8"
cd /app
# prebuild 的配置必须真实进入 APK，不能将旧版本误当成新版本归档。
actual_version=$($AAPT dump badging apps/mobile/android/app/build/outputs/apk/release/app-release.apk | sed -n "s/.*versionName='\([^']*\)'.*/\1/p" | head -1)
[[ "$actual_version" == "$version" ]] || { echo "APK 版本与配置不一致" >&2; exit 1; }
# 从真实 APK 提取版本、校验签名，再原子更新历史列表。
npx tsx scripts/archive-release.ts apps/mobile/android/app/build/outputs/apk/release/app-release.apk "$notes"
# 保持已有指南的最新下载地址兼容。
cp apps/mobile/android/app/build/outputs/apk/release/app-release.apk artifacts/.rho-demo.apk.next
mv artifacts/.rho-demo.apk.next artifacts/rho-demo.apk
