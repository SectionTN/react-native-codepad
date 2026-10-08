#!/usr/bin/env bash
# Builds the example app (debugOptimized) with its instrumented tests, installs both APKs and runs the suite.
# Usage: scripts/device-tests.sh [am instrument args, for example -e class codepad.example.HardwareKeysTest]
set -euo pipefail

root=$(cd "$(dirname "$0")/.." && pwd)
cd "$root/example/android"
./gradlew :app:assembleDebugOptimized :app:assembleDebugOptimizedAndroidTest -PreactNativeArchitectures=arm64-v8a --console=plain -q
adb install -r app/build/outputs/apk/debugOptimized/app-debugOptimized.apk
adb install -r app/build/outputs/apk/androidTest/debugOptimized/app-debugOptimized-androidTest.apk
log=$(mktemp)
trap 'rm -f "$log"' EXIT
adb shell am instrument -w -r "$@" codepad.example.test/androidx.test.runner.AndroidJUnitRunner | tee "$log"
grep -q 'INSTRUMENTATION_CODE: -1' "$log" &&
  ! grep -Eq 'INSTRUMENTATION_STATUS_CODE: -[12]' "$log" &&
  ! grep -q 'INSTRUMENTATION_RESULT: shortMsg=' "$log"
