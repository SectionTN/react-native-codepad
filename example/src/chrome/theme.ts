import type { Theme } from 'react-native-codepad';

export type Scheme = 'light' | 'dark';

/** System colors for the iOS chrome; the editor theme never reaches these. */
export type IosPalette = {
  label: string;
  secondaryLabel: string;
  separator: string;
  systemBackground: string;
  groupedBackground: string;
  cellBackground: string;
  fieldBackground: string;
  keyboard: string;
  key: string;
  keyAlt: string;
  keyText: string;
};

export const IOS: Record<Scheme, IosPalette> = {
  dark: {
    label: '#FFFFFF',
    secondaryLabel: '#EBEBF599',
    separator: '#54545899',
    systemBackground: '#000000',
    groupedBackground: '#1C1C1E',
    cellBackground: '#2C2C2E',
    fieldBackground: '#7676803D',
    keyboard: '#1C1C1E',
    key: '#4A4A4C',
    keyAlt: '#2C2C2E',
    keyText: '#FFFFFF',
  },
  light: {
    label: '#000000',
    secondaryLabel: '#3C3C4399',
    separator: '#3C3C4349',
    systemBackground: '#FFFFFF',
    groupedBackground: '#F2F2F7',
    cellBackground: '#FFFFFF',
    fieldBackground: '#7676801F',
    keyboard: '#D1D3D9',
    key: '#FFFFFF',
    keyAlt: '#ADB3BD',
    keyText: '#000000',
  },
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

/** The chrome follows the document: a dark background gets the dark system scheme. */
export function schemeFor(theme: Theme): Scheme {
  const [r, g, b] = rgb(theme.background);
  return 0.299 * r + 0.587 * g + 0.114 * b < 128 ? 'dark' : 'light';
}

/** The chrome keeps this much above the top bar when the status bar is gone, as in landscape. */
export function topInsetFor(safeTop: number): number {
  return Math.max(safeTop, 8);
}

/** The translucent surface behind the whole top chrome while the find bar is open. */
export function chromeBand(scheme: Scheme): string {
  return `${IOS[scheme].systemBackground}D9`;
}
