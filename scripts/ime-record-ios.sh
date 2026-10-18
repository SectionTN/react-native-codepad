#!/usr/bin/env bash
# Records the UITextInput calls the keyboard makes while you type in the example app on the simulator into
# tests/ime-ios/<name>.json. Usage: scripts/ime-record-ios.sh <name> [udid]   (keep the editor focused; Ctrl-C ends it)
set -euo pipefail

name=${1:?usage: $0 <name> [udid]}
udid=${2:-${CODEPAD_IOS_UDID:-C337C80F-5873-4156-B2AC-D9E22BC6ADFD}}
bundle=${CODEPAD_BUNDLE:-me.sectiontn.codepad.example}
root=$(cd "$(dirname "$0")/.." && pwd)
raw=$(mktemp)
trap 'xcrun simctl spawn "$udid" defaults write "$bundle" codepad_debug -bool false; rm -f "$raw"' EXIT

xcrun simctl spawn "$udid" defaults write "$bundle" codepad_debug -bool true
echo "Recording. Keep the editor focused, type, then press Ctrl-C."
xcrun simctl spawn "$udid" log stream --level info --style compact \
  --predicate 'subsystem == "me.sectiontn.codepad" AND category == "ime"' > "$raw" &
stream=$!
# log stream stops on SIGINT; the process behind the simctl wrapper needs its own.
stop() {
  kill -INT "$stream" 2>/dev/null || true
  pkill -INT -f "[l]og stream --level info --style compact --predicate subsystem == .me.sectiontn.codepad. AND category == .ime." 2>/dev/null || true
}
trap stop INT
wait "$stream" || true
trap - INT
sleep 1
device=$(xcrun simctl list devices | sed -n "s/^ *\(.*\) ($udid).*/\1/p" | head -n 1)
node "$root/scripts/ime-record-convert.mjs" "$name" "${device:-the simulator}" "$root/tests/ime-ios" < "$raw"
# The committed fixtures keep biome's compact arrays.
npx biome format --write "$root/tests/ime-ios/$name.json" > /dev/null 2>&1 || true
