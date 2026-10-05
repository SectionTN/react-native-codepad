#!/usr/bin/env bash
# Builds the example app with its instrumented tests, installs both APKs on the phone and runs the suite.
# Usage: scripts/device-tests.sh [am instrument args, for example -e class codepad.example.HardwareKeysTest]
set -euo pipefail

root=$(cd "$(dirname "$0")/.." && pwd)
cd "$root/example/android"
./gradlew :app:assembleDebug :app:assembleDebugAndroidTest -PreactNativeArchitectures=arm64-v8a --console=plain -q
echo "Installing two APKs; accept the MIUI dialog each time."
adb install -r app/build/outputs/apk/debug/app-debug.apk
adb install -r app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk
log=$(mktemp)
trap 'rm -f "$log"' EXIT
adb shell am instrument -w -r "$@" codepad.example.test/androidx.test.runner.AndroidJUnitRunner | tee "$log"
grep -q 'INSTRUMENTATION_CODE: -1' "$log" &&
  ! grep -Eq 'INSTRUMENTATION_STATUS_CODE: -[12]' "$log" &&
  ! grep -q 'INSTRUMENTATION_RESULT: shortMsg=' "$log"
