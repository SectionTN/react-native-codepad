import { dirPattern, ensureCheckout } from './git.ts';
import { loadManifest } from './manifest.ts';
import {
  isLuaMatch,
  isVimMatch,
  luaPatternToRegex,
  SUPPORTED_DIRECTIVES,
  SUPPORTED_PREDICATES,
  TranslateError,
  vimRegexToRegex,
} from './predicates.ts';
import { checkoutReader, collectQueryLangs, resolveQuery } from './queries.ts';
import { type Pattern, splitPatterns } from './scm.ts';

export type Dropped = { pattern: Pattern; reason: string };
export type Analysis = { kept: Pattern[]; dropped: Dropped[]; counts: Record<string, number> };
export type LangReport = {
  id: string;
  patterns: number;
  dropped: number;
  counts: Record<string, number>;
  reasons: string[];
};

function lastString(p: { args: { kind: string; value: string }[] }): string {
  const strings = p.args.filter((a) => a.kind === 'string');
  return strings.length ? strings[strings.length - 1]!.value : '';
}

export function dropReason(pattern: Pattern): string | null {
  for (const pred of pattern.predicates) {
    if (pred.name.endsWith('!')) {
      if (!SUPPORTED_DIRECTIVES.has(pred.name)) return `unsupported directive ${pred.name}`;
      continue;
    }
    if (!SUPPORTED_PREDICATES.has(pred.name)) return `unsupported predicate ${pred.name}`;
    try {
      if (isLuaMatch(pred.name)) luaPatternToRegex(lastString(pred));
      else if (isVimMatch(pred.name)) vimRegexToRegex(lastString(pred));
    } catch (e) {
      if (e instanceof TranslateError) return `${pred.name}: ${e.message}`;
      throw e;
    }
  }
  return null;
}

export function analyzePatterns(patterns: Pattern[]): Analysis {
  const kept: Pattern[] = [];
  const dropped: Dropped[] = [];
  const counts: Record<string, number> = {};
  for (const pattern of patterns) {
    for (const pred of pattern.predicates) counts[pred.name] = (counts[pred.name] ?? 0) + 1;
    const reason = dropReason(pattern);
    if (reason) dropped.push({ pattern, reason });
    else kept.push(pattern);
  }
  return { kept, dropped, counts };
}

export function formatReport(rows: LangReport[]): string {
  const lines = [
    '| language | patterns | dropped | drop % | predicates and directives |',
    '| --- | --- | --- | --- | --- |',
  ];
  let patterns = 0;
  let dropped = 0;
  for (const r of rows) {
    patterns += r.patterns;
    dropped += r.dropped;
    const pct = r.patterns ? ((100 * r.dropped) / r.patterns).toFixed(1) : '0.0';
    const preds = Object.entries(r.counts)
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `${k} ${v}`)
      .join(', ');
    lines.push(`| ${r.id} | ${r.patterns} | ${r.dropped} | ${pct}% | ${preds} |`);
  }
  const pct = patterns ? ((100 * dropped) / patterns).toFixed(1) : '0.0';
  lines.push('', `total: ${patterns} patterns, ${dropped} dropped (${pct}%)`);
  const reasons = rows.flatMap((r) => r.reasons.map((x) => `- ${r.id}: ${x}`));
  if (reasons.length) lines.push('', 'dropped patterns:', ...reasons);
  return lines.join('\n');
}

export function runReport(): string {
  const manifest = loadManifest();
  const roots = manifest.languages.flatMap((l) => l.grammars.map((g) => g.name));
  let dir = ensureCheckout(
    manifest.queries.repo,
    manifest.queries.rev,
    roots.map((l) => dirPattern(`runtime/queries/${l}`)),
  );
  // Inherited languages show up only after reading the modelines, so the checkout grows until nothing new appears.
  for (let pass = 0; pass < 5; pass++) {
    const all = collectQueryLangs(dir, roots);
    const next = ensureCheckout(
      manifest.queries.repo,
      manifest.queries.rev,
      all.map((l) => dirPattern(`runtime/queries/${l}`)),
    );
    if (collectQueryLangs(next, roots).length === all.length) break;
    dir = next;
  }
  const read = checkoutReader(dir);
  const rows: LangReport[] = [];
  for (const lang of manifest.languages) {
    for (const ql of lang.grammars.map((g) => g.name)) {
      let patterns: Pattern[] = [];
      for (const kind of ['highlights', 'injections'] as const) {
        const text = resolveQuery(ql, kind, read);
        if (text) patterns = patterns.concat(splitPatterns(text));
      }
      const a = analyzePatterns(patterns);
      rows.push({
        id: ql,
        patterns: patterns.length,
        dropped: a.dropped.length,
        counts: a.counts,
        reasons: a.dropped.map(
          (d) => `${d.reason}: ${d.pattern.text.replace(/\s+/g, ' ').slice(0, 100)}`,
        ),
      });
    }
  }
  return formatReport(rows);
}
