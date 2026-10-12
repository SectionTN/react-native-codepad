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

A markdown document is the heaviest case: every paragraph is an injection into the inline grammar and every fenced block one into its language, so a keystroke used to parse all of them again. The engine now reconciles the injected trees against what changed: it keeps a copy of the host tree from the last completed pass, asks tree-sitter for the ranges whose structure changed since (plus the edits' own spans), runs the injections query over those ranges only, reparses the kept trees they touch and carries every other tree over with no parser call. A carried tree is not even edited: an edit before it only moves its extent by arithmetic, the snapshot records the accumulated shift so the painter can read the tree in its own units, and the engine applies the shift as one synthetic edit when the tree is next touched. The painter likewise queries only the injected trees that meet the painted lines. The Benchmark tab's "Markdown 2k" document (2000 paragraphs, a fenced javascript block every tenth, 5880 lines, 2239 injections) is the bench. Same device and build as above; "before" is the phase 7 build with the kept trees disabled, "kept trees" the phase 7 engine, "after reconciliation" the shipped engine.

| Measure | Before | Kept trees | After reconciliation |
| --- | --- | --- | --- |
| First paint | 43 to 50 ms, 246 ms the first time in a process (two grammars load and compile their queries) | same | same, the first pass is still a full one |
| Typing, a key every 210 ms: edit to snapshot | p50 146 ms, p95 165 ms, all 2239 injections parsed per key | p50 147 ms, p95 166 ms, max 172 ms, 0 parsed and 2239 reused per key | p50 3 ms, p95 4 ms, max 9 ms once the process is warm; p50 7 ms, p95 41 ms over the first 60 keys of a fresh process, while ART still compiles the pass; 1 reused and 2238 carried per key |
| A burst of 60 keys in a quarter second | one snapshot 359 ms after the first key | one snapshot 380 to 400 ms after the first key | 17 snapshots during the burst, p50 5 ms, p95 6 ms each |
| Key handler plus draw during that typing | p50 3 ms | p50 2 to 4 ms | p50 2 ms, p95 4 ms |

What the table says: a key inside a paragraph now costs the diff, a query over a few lines, the parse of that one paragraph's inline tree and a handle copy per carried tree for the snapshot; the other trees are neither parsed nor edited, so the snapshot lands well inside the key interval and the edited paragraph re-highlights as you type. The `"carried"` field of the parse log line counts the injected trees a pass kept without calling the parser; on this document it reads 2238 for a key inside a paragraph (the paragraph's own tree is the one reused). A burst faster than the pass is cancelled by each key and resolves once at the end, and a cancelled pass is never published, so the inline spans never flicker.

## iOS

The targets apply to both platforms and the iOS editor is built to the same design: recycled line layers, a layout cache around the viewport, the parser on its own queue with the same first parse budget. `yarn bench:ios scroll`, `memory` and `typing` collect the same measures on the simulator as the Android scripts collect on the emulator, from the view's log lines and the process's resident size. Simulator numbers say nothing about a phone (the editor runs on the Mac's CPU, in the example's debug build), so they are kept for regressions and not published here; the device numbers come with the first iPhone in the loop.

## What costs what

- `onChangeText` copies the whole document after every change and crosses the bridge as UTF-8. On a megabyte of text that is tens of milliseconds per keystroke. Use `onChange` deltas and `getText()` when you need the text.
- `getText()` on a multi megabyte document costs the same copy. `getTextInRange()` and `getLine()` are cheap.
- Soft wrap measures every visible line against the width, and a width change relayouts the visible lines and resets the row counts. Rotation and a resize of the editor pay this once; a height change does not.
- Nested, auto height editors lay out every line. Keep them to a few hundred lines; see [nested in a ScrollView](/react-native-codepad/guides/nested-scroll/).
- Object props (`theme`, `contentInsets`) are compared by identity. A literal in JSX sends them to native on every render of the parent, which with `theme` means a map of a few dozen entries each time.
- `onScroll` and `onSelectionChange` are coalesced to one event per frame; setting React state from them is fine.
- Language libraries load on first use. The first editor with a language pays the library load and the query compile once per process; later editors reuse them.
