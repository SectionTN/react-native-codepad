---
title: Performance
description: Targets, measured numbers and what costs what.
sidebar:
  order: 7
---

The design targets, measured by the example app's Benchmark tab on generated JavaScript files:

| Scenario | Target |
| --- | --- |
| Open a 10k line file | First paint within 300 ms |
| Open a 100k line file | First paint within 1 s, scrolling never waits for highlighting |
| Typing in a 10k line file | Key handler plus draw under 16 ms at p95 |
| Fling scroll in a 10k line file | Under 1 percent dropped frames |
| Memory | Document, parser mirror and layout caches under 3x the text size |

## Measured

Pixel 9a emulator (API 36, host GPU) on an M1 Pro, `debugOptimized` build with Metro attached, fresh process before each run. The scripts behind `yarn bench:scroll`, `yarn bench:memory` and `yarn bench:typing` read the numbers from the device log and `dumpsys`.

| Measure | Result |
| --- | --- |
| First paint, 10k lines | 39, 47, 42 ms |
| First paint, 100k lines | 150, 181, 143 ms warm, 175 ms cold |
| Fling scroll, 10k lines, 8 flings | 832 frames, 2 janky (0.24 percent), p50 23 ms, p95 27, p99 28 |
| Fling scroll, 100k lines during the first parse | 829 frames, 4 janky (0.48 percent), p50 24 ms, p95 27, p99 31 |
| Typing, 60 keys on 10k lines, key handler plus draw | p50 4 to 7 ms, p95 5 to 11 ms, max 6 to 15 ms over three runs |
| Typing, key event to end of draw | p50 14 to 15 ms, p95 18 to 19 ms, which includes the wait for the next vsync |
| Typing with 120 search matches painted | p50 3 ms, p95 8 ms |
| Java heap growth for a 100k line file (6.6 MB of UTF-16) | 14.3 MB, 2.2x the text |
| Search on 100k lines | 274316 literal matches in 165 ms, 54864 regex matches in 103 ms |

Highlighting never blocks these: the parser runs on its own thread with a time budget on the first parse, and lines paint plain until the first snapshot lands.

## Markdown and injections

A markdown document is the heaviest case: every paragraph is an injection into the inline grammar and every fenced block one into its language, so one keystroke used to reparse all of them. Injected trees are now kept across edits and reparsed incrementally, so an edit reparses the host and the one injection it touched. The Benchmark tab's "Markdown 2k" document (2000 paragraphs, a fenced javascript block every tenth, about 5900 lines) is the bench, typed into through `yarn bench:typing`, which prints the edit to snapshot latency and the fresh and reused injection counts.

Numbers: pending the phase 7 bench run.

## What costs what

- `onChangeText` copies the whole document after every change and crosses the bridge as UTF-8. On a megabyte of text that is tens of milliseconds per keystroke. Use `onChange` deltas and `getText()` when you need the text.
- `getText()` on a multi megabyte document costs the same copy. `getTextInRange()` and `getLine()` are cheap.
- Soft wrap measures every visible line against the width, and a width change relayouts the visible lines and resets the row counts. Rotation and a resize of the editor pay this once; a height change does not.
- Nested, auto height editors lay out every line. Keep them to a few hundred lines; see [nested in a ScrollView](/react-native-codepad/guides/nested-scroll/).
- Object props (`theme`, `contentInsets`) are compared by identity. A literal in JSX sends them to native on every render of the parent, which with `theme` means a map of a few dozen entries each time.
- `onScroll` and `onSelectionChange` are coalesced to one event per frame; setting React state from them is fine.
- Language libraries load on first use. The first editor with a language pays the library load and the query compile once per process; later editors reuse them.
