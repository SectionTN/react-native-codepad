export type TokType = 'open' | 'close' | 'lopen' | 'lclose' | 'str' | 'cap' | 'pred' | 'word';
export type Tok = { t: TokType; v: string; s: number; e: number };
export type Arg = { kind: 'capture' | 'string' | 'ident'; value: string };
export type Predicate = { name: string; args: Arg[] };
export type Pattern = {
  start: number;
  end: number;
  text: string;
  predicates: Predicate[];
  captures: string[];
};

const ESCAPES: Record<string, string> = { n: '\n', t: '\t', r: '\r', '0': '\0' };

export function tokenize(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i]!;
    if (c === ';') {
      while (i < src.length && src[i] !== '\n') i++;
    } else if (/\s/.test(c)) {
      i++;
    } else if (c === '(' || c === ')' || c === '[' || c === ']') {
      const t: TokType = c === '(' ? 'open' : c === ')' ? 'close' : c === '[' ? 'lopen' : 'lclose';
      out.push({ t, v: c, s: i, e: i + 1 });
      i++;
    } else if (c === '"') {
      let j = i + 1;
      let v = '';
      while (j < src.length && src[j] !== '"') {
        if (src[j] === '\\') {
          const n = src[j + 1] ?? '';
          v += ESCAPES[n] ?? n;
          j += 2;
        } else {
          v += src[j];
          j++;
        }
      }
      out.push({ t: 'str', v, s: i, e: j + 1 });
      i = j + 1;
    } else {
      let j = i;
      while (j < src.length && !/[\s()[\]";]/.test(src[j]!)) j++;
      if (j === i) {
        i++;
        continue;
      }
      const w = src.slice(i, j);
      out.push({
        t: w.startsWith('@') ? 'cap' : w.startsWith('#') ? 'pred' : 'word',
        v: w,
        s: i,
        e: j,
      });
      i = j;
    }
  }
  return out;
}

function matchingClose(toks: Tok[], from: number): number {
  let depth = 0;
  for (let k = from; k < toks.length; k++) {
    const t = toks[k]!.t;
    if (t === 'open' || t === 'lopen') depth++;
    else if (t === 'close' || t === 'lclose') {
      depth--;
      if (depth === 0) return k;
    }
  }
  throw new Error(`unbalanced query near offset ${toks[from]!.s}`);
}

const SUFFIX = new Set(['*', '+', '?']);

function readPredicates(toks: Tok[], from: number, to: number): Predicate[] {
  const preds: Predicate[] = [];
  for (let k = from; k <= to; k++) {
    if (toks[k]!.t === 'open' && toks[k + 1]?.t === 'pred') {
      const close = matchingClose(toks, k);
      const args: Arg[] = [];
      for (let a = k + 2; a < close; a++) {
        const t = toks[a]!;
        if (t.t === 'cap') args.push({ kind: 'capture', value: t.v.slice(1) });
        else if (t.t === 'str') args.push({ kind: 'string', value: t.v });
        else if (t.t === 'word') args.push({ kind: 'ident', value: t.v });
      }
      preds.push({ name: toks[k + 1]!.v.slice(1), args });
      k = close;
    }
  }
  return preds;
}

export function splitPatterns(src: string): Pattern[] {
  const toks = tokenize(src);
  const patterns: Pattern[] = [];
  let k = 0;
  while (k < toks.length) {
    const first = toks[k]!;
    let last: number;
    if (first.t === 'open' || first.t === 'lopen') last = matchingClose(toks, k);
    else if (first.t === 'close' || first.t === 'lclose')
      throw new Error(`stray closer at offset ${first.s}`);
    else last = k;
    // Trailing quantifiers, captures and field names belong to the pattern they follow.
    while (
      toks[last + 1] &&
      (toks[last + 1]!.t === 'cap' ||
        (toks[last + 1]!.t === 'word' &&
          (SUFFIX.has(toks[last + 1]!.v) || toks[last + 1]!.v.endsWith(':'))))
    )
      last++;
    const isPredicateGroup = first.t === 'open' && toks[k + 1]?.t === 'pred';
    if (isPredicateGroup && patterns.length > 0) {
      const prev = patterns[patterns.length - 1]!;
      prev.end = toks[last]!.e;
      prev.text = src.slice(prev.start, prev.end);
      prev.predicates.push(...readPredicates(toks, k, last));
    } else {
      const start = first.s;
      const end = toks[last]!.e;
      const captures = [
        ...new Set(
          toks
            .slice(k, last + 1)
            .filter((t) => t.t === 'cap')
            .map((t) => t.v.slice(1)),
        ),
      ];
      patterns.push({
        start,
        end,
        text: src.slice(start, end),
        predicates: readPredicates(toks, k, last),
        captures,
      });
    }
    k = last + 1;
  }
  return patterns;
}
