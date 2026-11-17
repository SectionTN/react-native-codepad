// Splits a CDP CPU profile into groups by the nearest named root on each sample's stack, then ranks self time.

/**
 * @param {{ nodes: { id: number, callFrame: { functionName: string }, children?: number[] }[], samples: number[], timeDeltas: number[] }} profile
 * @param {Record<string, string>} roots function name to group name
 * @param {number} top functions kept per group
 * @returns {Record<string, { fn: string, selfMs: number }[]>}
 */
export function summarize(profile, roots, top) {
  const byId = new Map();
  const parent = new Map();
  for (const node of profile.nodes) {
    byId.set(node.id, node);
    for (const child of node.children ?? []) parent.set(child, node.id);
  }
  const groupOf = new Map();
  const group = (id) => {
    const known = groupOf.get(id);
    if (known) return known;
    const name = byId.get(id)?.callFrame.functionName;
    const up = parent.get(id);
    let found = 'other';
    if (Object.hasOwn(roots, name)) found = roots[name];
    else if (up !== undefined) found = group(up);
    groupOf.set(id, found);
    return found;
  };
  // Microseconds per group and function, so sums stay exact.
  const totals = new Map();
  profile.samples.forEach((id, i) => {
    const fn = byId.get(id)?.callFrame.functionName || '(anonymous)';
    if (fn === '(idle)') return;
    const g = group(id);
    const fns = totals.get(g) ?? new Map();
    fns.set(fn, (fns.get(fn) ?? 0) + (profile.timeDeltas[i] ?? 0));
    totals.set(g, fns);
  });
  const out = {};
  for (const [g, fns] of totals) {
    out[g] = [...fns]
      .sort((a, b) => b[1] - a[1])
      .slice(0, top)
      .map(([fn, us]) => ({ fn, selfMs: us / 1000 }));
  }
  return out;
}
