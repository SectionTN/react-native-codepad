/// <reference lib="dom" />

// How far the editor reaches below the visual viewport, which the keyboard shrinks on phones.
export function keyboardOverlap(
  editorBottom: number,
  viewportTop: number,
  viewportHeight: number,
): number {
  return Math.max(0, editorBottom - (viewportTop + viewportHeight));
}

// The keyboard's overlap with an element's box, 0 where the page has no visual viewport.
export function overlapOf(el: HTMLElement): number {
  const vv = typeof window === 'undefined' ? undefined : window.visualViewport;
  if (!vv) return 0;
  return Math.round(keyboardOverlap(el.getBoundingClientRect().bottom, vv.offsetTop, vv.height));
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
