---
title: Performance
description: Targets, measured numbers and what costs what.
sidebar_position: 7
---

The targets, measured in the example app on its generated JavaScript files:

| Scenario | Target |
| --- | --- |
| Open a 10k line file | First paint within 300 ms |
| Open a 100k line file | First paint within 1 s, scrolling never waits for highlighting |
| Typing in a 10k line file | Key handler plus draw under 16 ms at p95 |
| Fling scroll in a 10k line file | Under 1 percent dropped frames |
| Memory | Document, parser mirror and layout caches under 3x the text size |

## Measured

Pixel 9a emulator (API 36, host GPU) on an M1 Pro, `debugOptimized` build with Metro attached, a fresh process per run. `yarn bench:scroll`, `yarn bench:memory` and `yarn bench:typing` read the numbers from the device log and `dumpsys`.

| Measure | Result |
| --- | --- |
| First paint, 10k lines | 39, 47, 42 ms |
| First paint, 100k lines | 150, 181, 143 ms warm, 175 ms cold |
| Fling scroll, 10k lines, 8 flings | 832 frames, 2 janky (0.24 percent), p50 23 ms, p95 27, p99 28 |
| Fling scroll, 100k lines during the first parse | 829 frames, 4 janky (0.48 percent), p50 24 ms, p95 27, p99 31 |
| Typing, 60 keys on 10k lines, key handler plus draw | p50 4 to 7 ms, p95 5 to 11 ms, max 6 to 15 ms over three runs |
| Typing, key event to end of draw | p50 14 to 15 ms, p95 18 to 19 ms, including the wait for the next vsync |
| Typing with 120 search matches painted | p50 3 ms, p95 8 ms |
| Java heap growth for a 100k line file (6.6 MB of UTF-16) | 14.3 MB, 2.2x the text |
| Search on 100k lines | 274316 literal matches in 165 ms, 54864 regex matches in 103 ms |

Highlighting never blocks these: the parser runs on its own thread with a time budget on the first parse, and lines paint plain until the first snapshot lands.

## Markdown and injections

A markdown document is the heaviest case: every paragraph is an injection into the inline grammar and every fenced block one into its language. The engine reparses only the injected trees an edit touched and carries the rest over without a parser call. The bench is the example app's `2k-paragraphs.md`: 2000 paragraphs, a fenced javascript block every tenth, 5880 lines, 2239 injections. Same device and build as above.

| Measure | Every injection reparsed | Shipped engine |
| --- | --- | --- |
| First paint | 43 to 50 ms, 246 ms the first time in a process | same |
| Typing, a key every 210 ms, edit to snapshot | p50 146 ms, p95 165 ms | p50 3 ms, p95 4 ms warm; p50 7 ms over the first 60 keys of a fresh process |
| A burst of 60 keys in a quarter second | one snapshot 359 ms after the first key | 17 snapshots during the burst, p50 5 ms each |
| Key handler plus draw during that typing | p50 3 ms | p50 2 ms, p95 4 ms |

A burst faster than the pass is cancelled by each key and resolves once at the end; a cancelled pass is never published, so the inline spans never flicker.

## iOS

The iOS editor is built to the same design: recycled line layers, a layout cache around the viewport, the parser on its own queue with the same first parse budget. `yarn bench:ios scroll`, `memory` and `typing` collect the same measures on the simulator. Simulator numbers say nothing about a phone, so they are kept for regressions; the device numbers come with the first iPhone in the loop. On the simulator the 10k line file types at 3 ms of key handler plus layout and 11 ms from key event to end of draw, p50.

## What costs what

- `onChangeText` copies the whole document after every change. Use `onChange` deltas and `getText()` when you need the text.
- `getText()` on a multi megabyte document costs the same copy. `getTextInRange()` and `getLine()` are cheap.
- Soft wrap measures every visible line against the width. A width change (rotation, a resize) relayouts the visible lines once; a height change does not.
- Nested auto height editors lay out every line. Keep them to a few hundred lines.
- Object props (`theme`, `contentInsets`) are compared by identity. Hoist them, or they cross to native on every render.
- `onScroll` and `onSelectionChange` are coalesced to one event per frame; setting React state from them is fine.
- The first editor with a language pays its library load and query compile once per process.
