#!/usr/bin/env bash
# Scroll jank and memory numbers for the example app on the connected phone.
# Usage: scripts/bench.sh scroll [swipes]   or   scripts/bench.sh memory
set -euo pipefail

pkg=${CODEPAD_PACKAGE:-codepad.example}
cmd=${1:-scroll}

case "$cmd" in
  scroll)
    swipes=${2:-8}
    size=$(adb shell wm size | sed -n 's/.*: *\([0-9]*\)x\([0-9]*\).*/\1 \2/p' | tail -n 1)
    read -r width height <<< "$size"
    x=$((width / 2))
    from=$((height * 8 / 10))
    to=$((height * 2 / 10))
    adb shell dumpsys gfxinfo "$pkg" reset > /dev/null
    for ((i = 0; i < swipes; i++)); do
      adb shell input swipe "$x" "$from" "$x" "$to" 80
      sleep 1.5
    done
    sleep 1
    adb shell dumpsys gfxinfo "$pkg" | sed -n '/Total frames rendered/,/99th percentile/p'
    ;;
  memory)
    adb shell dumpsys meminfo "$pkg" | grep -E 'Java Heap:|Native Heap:|Graphics:|TOTAL PSS'
    ;;
  *)
    echo "usage: $0 scroll [swipes] | memory" >&2
    exit 1
    ;;
esac
