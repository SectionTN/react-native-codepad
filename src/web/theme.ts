import { githubLight } from '../themes/githubLight';
import type { Theme, TokenStyle } from '../types';

export type CssTokenStyle = { color: string; bold: boolean; italic: boolean };
type ColorKey = Exclude<keyof Theme, 'tokens'>;
export type CssTheme = Record<ColorKey, string> & {
  // Longest dotted prefix wins: keyword.function falls back to keyword, then to null for the plain foreground.
  token(name: string): CssTokenStyle | null;
};

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const RGB = /^rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*(?:,\s*[0-9.]+\s*)?\)$/;

// The color when it is one of the formats native accepts, #rgb, #rgba, #rrggbb, #rrggbbaa, rgb() and rgba().
export function cssColor(value: string, fallback: string): string {
  const v = typeof value === 'string' ? value.trim() : '';
  return HEX.test(v) || RGB.test(v) ? v : fallback;
}

// The theme as CSS colors. A color that does not parse takes the githubLight color of its key, as on iOS.
export function cssTheme(theme: Theme): CssTheme {
  const colors = {} as Record<ColorKey, string>;
  for (const key of Object.keys(githubLight) as (keyof Theme)[]) {
    if (key === 'tokens') continue;
    colors[key] = cssColor(theme[key], githubLight[key]);
  }
  const tokens = new Map<string, CssTokenStyle>();
  for (const [name, style] of Object.entries(theme.tokens ?? {})) {
    tokens.set(name, tokenStyle(style));
  }
  const cache = new Map<string, CssTokenStyle | null>();
  return {
    ...colors,
    token(name: string): CssTokenStyle | null {
      const cached = cache.get(name);
      if (cached !== undefined) return cached;
      let key = name;
      let found: CssTokenStyle | null = null;
      for (;;) {
        const style = tokens.get(key);
        if (style) {
          found = style;
          break;
        }
        const dot = key.lastIndexOf('.');
        if (dot < 0) break;
        key = key.slice(0, dot);
      }
      cache.set(name, found);
      return found;
    },
  };
}

function tokenStyle(style: TokenStyle): CssTokenStyle {
  if (typeof style === 'string') {
    return { color: cssColor(style, githubLight.foreground), bold: false, italic: false };
  }
  return {
    color: cssColor(style.color, githubLight.foreground),
    bold: style.bold ?? false,
    italic: style.italic ?? false,
  };
}
