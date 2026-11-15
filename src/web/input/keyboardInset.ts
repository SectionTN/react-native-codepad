/// <reference lib="dom" />

// The editor's overlap with what the visual viewport lost from the layout viewport, which a keyboard covers.
export function keyboardOverlap(
  editorBottom: number,
  viewportTop: number,
  viewportHeight: number,
  layoutHeight: number,
): number {
  return Math.max(0, Math.min(editorBottom, layoutHeight) - (viewportTop + viewportHeight));
}

// The keyboard's overlap with an element's box, 0 where the page has no visual viewport or is pinch-zoomed.
export function overlapOf(el: HTMLElement): number {
  const vv = typeof window === 'undefined' ? undefined : window.visualViewport;
  if (!vv || Math.abs(vv.scale - 1) > 0.01) return 0;
  const bottom = el.getBoundingClientRect().bottom;
  const layout = document.documentElement.clientHeight;
  return Math.round(keyboardOverlap(bottom, vv.offsetTop, vv.height, layout));
}

// Calls back when the visual viewport moves or resizes, as the keyboard opens, closes or animates. Returns the removal.
export function watchViewport(changed: () => void): () => void {
  const vv = typeof window === 'undefined' ? undefined : window.visualViewport;
  if (!vv) return () => {};
  vv.addEventListener('resize', changed);
  vv.addEventListener('scroll', changed);
  return () => {
    vv.removeEventListener('resize', changed);
    vv.removeEventListener('scroll', changed);
  };
}
