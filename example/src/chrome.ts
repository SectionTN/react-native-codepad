import type { Theme } from 'react-native-codepad';

/** Colors for everything drawn around the editor, taken from the theme so the chrome never fights the document. */
export type Chrome = {
  background: string;
  surface: string;
  text: string;
  muted: string;
  hairline: string;
  scheme: 'light' | 'dark';
};

function rgb(hex: string): [number, number, number] {
  const digits = hex.replace('#', '');
  const full = digits.length < 6 ? [...digits].map((d) => d + d).join('') : digits;
  return [
    Number.parseInt(full.slice(0, 2), 16),
    Number.parseInt(full.slice(2, 4), 16),
    Number.parseInt(full.slice(4, 6), 16),
  ];
}

function withAlpha(hex: string, alpha: number): string {
  const [r, g, b] = rgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function chromeFor(theme: Theme): Chrome {
  const [r, g, b] = rgb(theme.background);
  const dark = 0.299 * r + 0.587 * g + 0.114 * b < 128;
  return {
    background: theme.background,
    surface: theme.gutterBackground,
    text: theme.foreground,
    muted: theme.gutterForeground,
    hairline: withAlpha(theme.gutterForeground, 0.35),
    scheme: dark ? 'dark' : 'light',
  };
}
