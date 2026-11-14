export type FrameLine = { spans: Int32Array; text: string };
export type FrameRun = { lo: number; hi: number; lines: FrameLine[] };
export type DecodedFrame = {
  revision: number;
  length: number;
  lineCount: number;
  anchor: number;
  head: number;
  caretLine: number;
  decorationsVersion: number;
  history: number;
  // The window, clamped to the document.
  first: number;
  last: number;
  // first..last + 1. The line after the last one starts at length + 1.
  lineStarts: number[];
  // The lines to lay out, with their spans as cp_highlight writes them and their text.
  runs: FrameRun[];
};

// ignoreBOM keeps a line's leading U+FEFF, so span offsets stay right.
const decoder = new TextDecoder('utf-16le', { ignoreBOM: true });

// Reads one cp_editor_frame result, laid out as codepad.h describes it.
export function decodeFrame(ints: Int32Array, text: Uint16Array): DecodedFrame {
  let i = 0;
  const next = () => ints[i++] as number;
  const revision = next();
  const length = next();
  const lineCount = next();
  const anchor = next();
  const head = next();
  const caretLine = next();
  const decorationsVersion = next();
  const history = next();
  const first = next();
  const last = next();
  const lo = Math.min(Math.max(first, 0), lineCount - 1);
  const hi = Math.min(Math.max(last, lo), lineCount - 1);
  const lineStarts: number[] = [];
  for (let line = lo; line <= hi + 1; line++) lineStarts.push(next());
  const runCount = next();
  const runs: FrameRun[] = [];
  for (let r = 0; r < runCount; r++) runs.push({ lo: next(), hi: next(), lines: [] });
  const spans: Int32Array[] = [];
  for (const run of runs) {
    for (let line = run.lo; line <= run.hi; line++) {
      const triples = next();
      spans.push(ints.slice(i, i + triples * 3));
      i += triples * 3;
    }
  }
  let k = 0;
  for (const run of runs) {
    for (let line = run.lo; line <= run.hi; line++) {
      const offset = next();
      const count = next();
      const lineText = count === 0 ? '' : decoder.decode(text.subarray(offset, offset + count));
      run.lines.push({ spans: spans[k++] as Int32Array, text: lineText });
    }
  }
  return {
    revision,
    length,
    lineCount,
    anchor,
    head,
    caretLine,
    decorationsVersion,
    history,
    first: lo,
    last: hi,
    lineStarts,
    runs,
  };
}
