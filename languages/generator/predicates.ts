export class TranslateError extends Error {}

export const SUPPORTED_PREDICATES = new Set([
  'eq?',
  'not-eq?',
  'any-eq?',
  'any-not-eq?',
  'match?',
  'not-match?',
  'any-match?',
  'any-not-match?',
  'vim-match?',
  'not-vim-match?',
  'any-vim-match?',
  'lua-match?',
  'not-lua-match?',
  'any-lua-match?',
  'contains?',
  'not-contains?',
  'any-contains?',
  'any-of?',
  'not-any-of?',
  'has-ancestor?',
  'not-has-ancestor?',
  'has-parent?',
  'not-has-parent?',
]);

// The runtime ignores offset! and reads set! only for injection keys.
export const SUPPORTED_DIRECTIVES = new Set(['set!', 'offset!']);

export const isLuaMatch = (name: string): boolean => name.endsWith('lua-match?');
export const isVimMatch = (name: string): boolean =>
  /(^|-)(vim-)?match\?$/.test(name) && !isLuaMatch(name);

export function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const LUA_CLASS: Record<string, string> = {
  d: '\\d',
  D: '\\D',
  s: '\\s',
  S: '\\S',
  a: '[A-Za-z]',
  A: '[^A-Za-z]',
  w: '[A-Za-z0-9]',
  W: '[^A-Za-z0-9]',
  u: '[A-Z]',
  U: '[^A-Z]',
  l: '[a-z]',
  L: '[^a-z]',
  x: '[0-9A-Fa-f]',
  X: '[^0-9A-Fa-f]',
  p: '[!-/:-@\\[-`{-~]',
  P: '[^!-/:-@\\[-`{-~]',
};
const LUA_CLASS_IN_SET: Record<string, string> = {
  d: '0-9',
  s: '\\s',
  a: 'A-Za-z',
  w: 'A-Za-z0-9',
  u: 'A-Z',
  l: 'a-z',
  x: '0-9A-Fa-f',
  p: '!-/:-@\\[-`{-~',
};

export function luaPatternToRegex(p: string): string {
  let out = '';
  let i = 0;
  const n = p.length;
  while (i < n) {
    const c = p[i]!;
    if (c === '%') {
      const d = p[i + 1];
      if (d === undefined) throw new TranslateError('trailing %');
      if (d === 'b' || d === 'f' || /[1-9]/.test(d)) throw new TranslateError(`unsupported %${d}`);
      if (/[A-Za-z]/.test(d)) {
        const cls = LUA_CLASS[d];
        if (!cls) throw new TranslateError(`unsupported class %${d}`);
        out += cls;
      } else {
        out += escapeRegex(d);
      }
      i += 2;
    } else if (c === '[') {
      let j = i + 1;
      let neg = false;
      if (p[j] === '^') {
        neg = true;
        j++;
      }
      let body = '';
      let first = true;
      while (j < n && (p[j] !== ']' || first)) {
        first = false;
        const e = p[j]!;
        if (e === '%') {
          const d = p[j + 1] ?? '';
          if (/[A-Za-z]/.test(d)) {
            const cls = LUA_CLASS_IN_SET[d];
            if (!cls) throw new TranslateError(`unsupported class %${d} in set`);
            body += cls;
          } else {
            body += escapeRegex(d);
          }
          j += 2;
        } else if (e === '\\' || e === '[' || e === ']' || (e === '^' && body.length > 0)) {
          body += `\\${e}`;
          j++;
        } else {
          body += e;
          j++;
        }
      }
      if (j >= n) throw new TranslateError('unterminated set');
      out += `[${neg ? '^' : ''}${body}]`;
      i = j + 1;
    } else if (c === '(' || c === ')') {
      throw new TranslateError('captures are unsupported');
    } else if (c === '.') {
      out += '.';
      i++;
    } else if (c === '^') {
      out += i === 0 ? '^' : '\\^';
      i++;
    } else if (c === '$') {
      out += i === n - 1 ? '$' : '\\$';
      i++;
    } else if (c === '*' || c === '+' || c === '?') {
      out += c;
      i++;
    } else if (c === '-') {
      out += '*?';
      i++;
    } else {
      out += escapeRegex(c);
      i++;
    }
  }
  return out;
}

const VIM_CLASS: Record<string, string> = {
  d: '\\d',
  D: '\\D',
  s: '\\s',
  S: '\\S',
  w: '\\w',
  W: '\\W',
  a: '[A-Za-z]',
  A: '[^A-Za-z]',
  l: '[a-z]',
  L: '[^a-z]',
  u: '[A-Z]',
  U: '[^A-Z]',
  x: '[0-9A-Fa-f]',
  X: '[^0-9A-Fa-f]',
  h: '[A-Za-z_]',
  H: '[^A-Za-z_]',
  n: '\\n',
  t: '\\t',
  r: '\\r',
  e: '\\x1b',
};

function vimBraces(v: string, from: number): { text: string; next: number } {
  const close = v.indexOf('}', from);
  if (close < 0) throw new TranslateError('unterminated \\{');
  let inner = v.slice(from, close);
  let lazy = false;
  if (inner.startsWith('-')) {
    lazy = true;
    inner = inner.slice(1);
  }
  return { text: `{${inner}}${lazy ? '?' : ''}`, next: close + 1 };
}

function classEnd(v: string, from: number): number {
  let j = from + 1;
  if (v[j] === '^') j++;
  if (v[j] === ']') j++;
  while (j < v.length && v[j] !== ']') j++;
  return j < v.length ? j : -1;
}

export function vimRegexToRegex(v: string): string {
  let veryMagic = false;
  let i = 0;
  if (v.startsWith('\\v')) {
    veryMagic = true;
    i = 2;
  } else if (v.startsWith('\\m')) {
    i = 2;
  } else if (v.startsWith('\\V') || v.startsWith('\\M')) {
    throw new TranslateError('nomagic patterns are unsupported');
  }
  const start = i;
  const n = v.length;
  let out = '';
  while (i < n) {
    const c = v[i]!;
    if (c === '\\') {
      const d = v[i + 1];
      if (d === undefined) throw new TranslateError('trailing backslash');
      i += 2;
      if (d === '<' || d === '>') out += '\\b';
      else if (VIM_CLASS[d]) out += VIM_CLASS[d];
      else if ('ikfpIKFPz%_&cC@'.includes(d)) throw new TranslateError(`\\${d} is unsupported`);
      else if (veryMagic) out += escapeRegex(d);
      else if (d === '(' || d === ')' || d === '|' || d === '+' || d === '?') out += d;
      else if (d === '=') out += '?';
      else if (d === '{') {
        const b = vimBraces(v, i);
        out += b.text;
        i = b.next;
      } else out += escapeRegex(d);
      continue;
    }
    if (veryMagic) {
      if (c === '<' || c === '>') out += '\\b';
      else if (c === '=') out += '?';
      else if (c === '{') {
        const b = vimBraces(v, i + 1);
        out += b.text;
        i = b.next;
        continue;
      } else if ('@%&~'.includes(c))
        throw new TranslateError(`${c} is unsupported in very magic mode`);
      else if (c === '^') out += i === start ? '^' : '\\^';
      else if (c === '$') out += i === n - 1 ? '$' : '\\$';
      else out += c;
      i++;
      continue;
    }
    if ('()|+?{}='.includes(c)) out += `\\${c}`;
    else if (c === '[') {
      const end = classEnd(v, i);
      if (end < 0) out += '\\[';
      else {
        out += v.slice(i, end + 1);
        i = end + 1;
        continue;
      }
    } else if (c === '~') throw new TranslateError('~ is unsupported');
    else if (c === '^') out += i === start ? '^' : '\\^';
    else if (c === '$') out += i === n - 1 ? '$' : '\\$';
    else out += c;
    i++;
  }
  return out;
}
