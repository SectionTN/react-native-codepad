#!/usr/bin/env bash
# Records the calls the keyboard makes while you type in the example app into tests/ime/<name>.json.
# Usage: scripts/ime-record.sh <name>   (a focused editor reconnects within a second; Ctrl-C ends the recording)
set -euo pipefail

name=${1:?usage: $0 <name>}
root=$(cd "$(dirname "$0")/.." && pwd)
raw=$(mktemp)
trap 'adb shell settings put global codepad_debug 0; rm -f "$raw"' EXIT

adb shell settings put global codepad_debug 1
adb logcat -c
echo "Recording. Keep the editor focused, type, then press Ctrl-C."
adb logcat -v raw -s codepad-ime:I > "$raw" &
logcat=$!
trap 'kill "$logcat" 2>/dev/null' INT
wait "$logcat" || true
trap - INT
device=$(adb shell getprop ro.product.model | tr -d '\r')
node "$root/scripts/ime-record-convert.mjs" "$name" "$device" < "$raw" > "$root/tests/ime/$name.json"
echo "wrote tests/ime/$name.json ($(grep -c '"call"' "$root/tests/ime/$name.json") steps)"
