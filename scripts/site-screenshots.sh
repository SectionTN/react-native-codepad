#!/bin/sh
# Captures the editor on the booted iOS simulator and the running Android emulator for the docs site.
set -eu

udid="${1:-booted}"
out="$(cd "$(dirname "$0")/.." && pwd)/website/static/img"
tmp="$(mktemp -d)"

xcrun simctl io "$udid" screenshot "$tmp/editor-ios.png" > /dev/null
adb exec-out screencap -p > "$tmp/editor-android.png"

for name in editor-ios editor-android; do
  sips -g pixelWidth -g pixelHeight "$tmp/$name.png" | awk -v n="$name" '/pixel/ { printf "%s %s %s\n", n, $1, $2 }'
  cwebp -quiet -q 88 "$tmp/$name.png" -o "$out/$name.webp"
done
rm -rf "$tmp"
ls -la "$out"/editor-ios.webp "$out"/editor-android.webp
