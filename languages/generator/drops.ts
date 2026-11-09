import {
  isLuaMatch,
  isVimMatch,
  luaPatternToRegex,
  SUPPORTED_DIRECTIVES,
  SUPPORTED_PREDICATES,
  TranslateError,
  vimRegexToRegex,
} from './predicates.ts';
import type { Pattern } from './scm.ts';

export type Dropped = { pattern: Pattern; reason: string };

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
