import type { Decoration } from 'react-native-codepad';

const IDENTIFIER = /[A-Za-z_][A-Za-z0-9_]*/g;
const NOTE_LINE = 1;
const MAX = 100;

/**
 * The demo a checker would send: a red underline on the first identifier of line 2, a two row gap and a tint under
 * that line, an amber wave on the next identifier, then thin underlines on later ones up to 100 decorations.
 */
export function buildDemoDecorations(text: string, scheme: 'light' | 'dark'): Decoration[] {
  const dark = scheme === 'dark';
  const red = dark ? '#F26B62' : '#C8322B';
  const amber = dark ? '#F0B24B' : '#B8730E';
  const lines = text.split('\n');
  const line = Math.min(NOTE_LINE, lines.length - 1);
  let lineStart = 0;
  for (let i = 0; i < line; i++) lineStart += (lines[i] ?? '').length + 1;
  const lineEnd = lineStart + (lines[line] ?? '').length;
  const out: Decoration[] = [
    { kind: 'gap', line, rows: 2 },
    { kind: 'lineBackground', line, color: dark ? '#3A1A18' : '#FAE8E6' },
  ];
  let first = true;
  let wave = true;
  for (const m of text.matchAll(IDENTIFIER)) {
    if (out.length >= MAX) break;
    const start = m.index ?? 0;
    const range = { start, end: start + m[0].length };
    if (start < lineStart) continue;
    if (first && start < lineEnd) {
      out.push({ kind: 'underline', range, color: red, thickness: 2, offset: 4 });
      first = false;
    } else if (start >= lineEnd && wave) {
      out.push({ kind: 'underline', range, color: amber, style: 'wavy', offset: 4 });
      wave = false;
    } else if (start >= lineEnd) {
      out.push({ kind: 'underline', range, color: red });
    }
  }
  return out;
}
