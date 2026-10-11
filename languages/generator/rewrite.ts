import { isLuaMatch, isVimMatch, luaPatternToRegex, vimRegexToRegex } from './predicates.ts';
import { type Dropped, dropReason } from './report.ts';
import { type Pattern, splitPatterns, tokenize } from './scm.ts';

function queryString(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function renamed(name: string): string {
  return name.replace('lua-match?', 'match?').replace('vim-match?', 'match?');
}

/** Rewrites every lua-match? and vim-match? predicate of one pattern into a match? with a translated regex. */
function rewritePattern(pattern: Pattern): string {
  const toks = tokenize(pattern.text);
  const edits: { s: number; e: number; text: string }[] = [];
  for (let k = 0; k < toks.length; k++) {
    const t = toks[k]!;
    if (t.t !== 'pred') continue;
    const name = t.v.slice(1);
    if (!isLuaMatch(name) && !isVimMatch(name)) continue;
    let lastStr = -1;
    for (let a = k + 1; a < toks.length && toks[a]!.t !== 'close'; a++) {
      if (toks[a]!.t === 'str') lastStr = a;
    }
    if (lastStr < 0) continue;
    const raw = toks[lastStr]!.v;
    const regex = isLuaMatch(name) ? luaPatternToRegex(raw) : vimRegexToRegex(raw);
    edits.push({ s: t.s, e: t.e, text: `#${renamed(name)}` });
    edits.push({ s: toks[lastStr]!.s, e: toks[lastStr]!.e, text: queryString(regex) });
  }
  let out = pattern.text;
  for (const edit of edits.sort((a, b) => b.s - a.s)) {
    out = out.slice(0, edit.s) + edit.text + out.slice(edit.e);
  }
  return out;
}

const ANCESTOR_PREDICATES = new Set([
  'has-parent?',
  'has-ancestor?',
  'not-has-parent?',
  'not-has-ancestor?',
]);

/** The engine re-queries an injection only where its captures changed, so a match may not depend on nodes outside them. */
function ancestorPredicate(pattern: Pattern): string | null {
  for (const t of tokenize(pattern.text)) {
    if (t.t !== 'pred') continue;
    const name = t.v.slice(1);
    if (ANCESTOR_PREDICATES.has(name)) return name;
  }
  return null;
}

export function rewriteQuery(
  src: string,
  options: { injections?: boolean } = {},
): { text: string; dropped: Dropped[] } {
  const patterns = splitPatterns(src);
  const dropped: Dropped[] = [];
  let out = '';
  let cursor = 0;
  for (const pattern of patterns) {
    out += src.slice(cursor, pattern.start);
    if (options.injections) {
      const name = ancestorPredicate(pattern);
      if (name) {
        throw new Error(
          `${name} is not allowed in injections.scm: a match could change outside its captures (injection reconciliation design, 2026-10-11)`,
        );
      }
    }
    const reason = dropReason(pattern);
    if (reason) {
      dropped.push({ pattern, reason });
      out += `; dropped: ${reason}`;
      // The comment runs to the end of the line, so anything that shared the line must move down.
      if (pattern.end < src.length && src[pattern.end] !== '\n') out += '\n';
    } else {
      out += rewritePattern(pattern);
    }
    cursor = pattern.end;
  }
  out += src.slice(cursor);
  return { text: out, dropped };
}
