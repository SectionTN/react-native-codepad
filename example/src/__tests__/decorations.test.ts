import { describe, expect, it } from '@jest/globals';
import { buildDemoDecorations } from '../decorations';
import { sample } from '../sample';

describe('buildDemoDecorations', () => {
  it('builds a capped set with one note gap, both underline styles and per scheme colors', () => {
    for (const [scheme, red, amber] of [
      ['light', '#C8322B', '#B8730E'],
      ['dark', '#F26B62', '#F0B24B'],
    ] as const) {
      const items = buildDemoDecorations(sample, scheme);
      expect(items.length).toBeLessThanOrEqual(100);
      const gaps = items.filter((d) => d.kind === 'gap');
      expect(gaps).toEqual([{ kind: 'gap', line: 1, rows: 2 }]);
      const underlines = items.filter((d) => d.kind === 'underline');
      expect(underlines.some((d) => d.style === 'wavy' && d.color === amber)).toBe(true);
      expect(underlines.some((d) => d.style !== 'wavy' && d.color === red)).toBe(true);
    }
  });
});
