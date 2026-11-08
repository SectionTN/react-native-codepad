#!/usr/bin/env bash
# Builds the example app with its XCTest bundle and runs CodepadTests on the simulator. The full xcodebuild
# output lands in a temp log; the terminal gets the test lines, since -quiet withholds the summary.
# Usage: scripts/device-tests-ios.sh [xcodebuild args, for example -skip-testing:CodepadTests/LanguagesTests]
set -euo pipefail

cd "$(dirname "$0")/.."
log=$(mktemp)
trap 'rm -f "$log"' EXIT
status=0
xcodebuild test -workspace example/ios/CodepadExample.xcworkspace -scheme CodepadExample \
  -destination "platform=iOS Simulator,id=${CODEPAD_IOS_UDID:-6BF45D63-4F4D-495C-846D-28B63F0E99E2}" \
  -only-testing:CodepadTests "$@" > "$log" 2>&1 || status=$?
grep -E "Test Case .* (passed|failed)|(^|: )error: |Executed [0-9]+ tests|\*\* TEST" "$log" | sed "s|$PWD/||" || true
exit "$status"
