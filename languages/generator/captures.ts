import { splitPatterns } from './scm.ts';

export function captureNames(query: string): string[] {
  const names = new Set<string>();
  for (const pattern of splitPatterns(query)) {
    for (const c of pattern.captures) if (!c.startsWith('_')) names.add(c);
  }
  return [...names].sort();
}
