import { githubDark, githubLight, oneDark, type Theme } from 'react-native-codepad';
import type { MenuChoice } from './chrome/types';

export type ThemeChoice = MenuChoice & { theme: Theme };

export const THEMES: ThemeChoice[] = [
  { id: 'githubDark', label: 'GitHub Dark', theme: githubDark },
  { id: 'githubLight', label: 'GitHub Light', theme: githubLight },
  { id: 'oneDark', label: 'One Dark', theme: oneDark },
];

export const DEFAULT_THEME_ID = THEMES[0]?.id ?? 'githubDark';

/** The theme behind a menu id, GitHub Dark when the id is unknown. */
export function themeById(id: string): Theme {
  return THEMES.find((t) => t.id === id)?.theme ?? githubDark;
}
