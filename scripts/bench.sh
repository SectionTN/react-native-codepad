#!/usr/bin/env bash
# Scroll jank, memory and typing latency numbers for the example app on the connected phone.
# Usage: scripts/bench.sh scroll [swipes]   or   scripts/bench.sh memory   or   scripts/bench.sh typing [chars]
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
  typing)
    count=${2:-40}
    alphabet=abcdefghijklmnopqrstuvwxyz
    text=""
    while ((${#text} < count)); do text+=$alphabet; done
    text=${text:0:count}
    adb shell settings put global codepad_debug 1
    # The view re-reads the setting at most once a second.
    sleep 1.2
    adb logcat -c
    adb shell input text "$text"
    sleep 1
    adb shell settings put global codepad_debug 0
    adb logcat -d -v raw -s codepad-ime:I | sed -n 's/.*"call":"paint","latency":\([0-9]*\).*/\1/p' | sort -n |
      awk '{ v[NR] = $1 } END {
        if (NR == 0) { print "no paint lines: focus the editor first"; exit 1 }
        printf "frames %d  p50 %d ms  p95 %d ms  max %d ms\n", NR, v[int(NR * 0.5 + 0.5)], v[int(NR * 0.95 + 0.5)], v[NR]
      }'
    ;;
  *)
    echo "usage: $0 scroll [swipes] | memory | typing [chars]" >&2
    exit 1
    ;;
esac
