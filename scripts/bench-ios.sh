#!/usr/bin/env bash
# Scroll frames, memory and typing latency for the example app on the simulator; regression numbers only.
# Usage: scripts/bench-ios.sh scroll [udid] | memory [udid] | typing [udid]
# scroll and typing stream the log for CODEPAD_BENCH_SECONDS (default 30) while argent drives the editor.
set -euo pipefail

cmd=${1:-scroll}
udid=${2:-${CODEPAD_IOS_UDID:-C337C80F-5873-4156-B2AC-D9E22BC6ADFD}}
bundle=${CODEPAD_BUNDLE:-codepad.example}
seconds=${CODEPAD_BENCH_SECONDS:-30}

summary() {
  sort -n | awk -v name="$1" '{ v[NR] = $1 } END {
    if (NR == 0) exit
    printf "%-8s p50 %d ms  p90 %d ms  p95 %d ms  p99 %d ms  max %d ms\n", name, v[int(NR * 0.5 + 0.5)], v[int(NR * 0.9 + 0.5)], v[int(NR * 0.95 + 0.5)], v[int(NR * 0.99 + 0.5)], v[NR]
  }'
}

# Streams the paint, frame and parse lines into $1 for $seconds while the editor is driven from outside.
stream() {
  xcrun simctl spawn "$udid" defaults write "$bundle" codepad_debug -bool true
  # The view re-reads the setting at most once a second.
  sleep 1.2
  xcrun simctl spawn "$udid" log stream --level info --style compact \
    --predicate 'subsystem == "me.sectiontn.codepad"' > "$1" &
  local pid=$!
  echo "streaming for $seconds s: drive the editor now"
  sleep "$seconds"
  # log stream stops on SIGINT; the process behind the simctl wrapper needs its own.
  kill -INT "$pid" 2>/dev/null || true
  pkill -INT -f "[l]og stream --level info --style compact --predicate subsystem == .me.sectiontn.codepad.$" 2>/dev/null || true
  wait "$pid" 2>/dev/null || true
  xcrun simctl spawn "$udid" defaults write "$bundle" codepad_debug -bool false
}

case "$cmd" in
  scroll)
    raw=$(mktemp)
    trap 'rm -f "$raw"' EXIT
    stream "$raw"
    frames=$(sed -n 's/.*"call":"frame","ms":\([0-9]*\).*/\1/p' "$raw")
    [ -n "$frames" ] || { echo "no frame lines: scroll the editor while it streams"; exit 1; }
    echo "frames $(echo "$frames" | wc -l | tr -d ' ')  over 16 ms $(echo "$frames" | awk '$1 > 16 { n++ } END { print n + 0 }')"
    echo "$frames" | summary frame
    ;;
  memory)
    pid=$(pgrep -f "CodepadExample.app/CodepadExample" | head -n 1)
    [ -n "$pid" ] || { echo "the example app is not running"; exit 1; }
    echo "rss $(( $(ps -o rss= -p "$pid" | tr -d ' ') / 1024 )) MB (pid $pid)"
    ;;
  typing)
    raw=$(mktemp)
    trap 'rm -f "$raw"' EXIT
    stream "$raw"
    lines=$(sed -n 's/.*"call":"paint","latency":\([0-9]*\),"work":\([0-9]*\).*/\1 \2/p' "$raw")
    [ -n "$lines" ] || { echo "no paint lines: focus the editor and type while it streams"; exit 1; }
    # latency runs from the key event to the end of the frame, so it includes the wait for the display link; work is the time in the input handler and the layout pass.
    echo "frames $(echo "$lines" | wc -l | tr -d ' ')"
    echo "$lines" | awk '{ print $1 }' | summary latency
    echo "$lines" | awk '{ print $2 }' | summary work
    parses=$(sed -n 's/.*"call":"parse","ms":\([0-9]*\).*/\1/p' "$raw")
    if [ -n "$parses" ]; then
      echo "parses $(echo "$parses" | wc -l | tr -d ' ')"
      echo "$parses" | summary parse
    fi
    ;;
  *)
    echo "usage: $0 scroll [udid] | memory [udid] | typing [udid]" >&2
    exit 1
    ;;
esac
