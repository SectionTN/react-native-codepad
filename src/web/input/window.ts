import type { EditorCore } from '../core/EditorCore';

// The most text the keyboard's textarea holds, like the native text window.
export const WINDOW_CAP = 8192;

// The caret's line and its two neighbors, widened to the selection, at most WINDOW_CAP units around the head.
export function windowAround(core: EditorCore): { start: number; end: number } {
  const { anchor, head } = core.selection;
  const first = Math.max(0, core.lineAt(Math.min(anchor, head)) - 1);
  const last = Math.min(core.lineCount - 1, core.lineAt(Math.max(anchor, head)) + 1);
  let start = core.lineStart(first);
  let end = core.lineEnd(last);
  if (end - start > WINDOW_CAP) {
    start = Math.min(Math.max(start, head - WINDOW_CAP / 2), end - WINDOW_CAP);
    end = start + WINDOW_CAP;
  }
  return { start, end };
}
