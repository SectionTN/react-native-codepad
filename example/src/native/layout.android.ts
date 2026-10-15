import type { ModifierConfig } from '@expo/ui/jetpack-compose/modifiers';
import { fillMaxWidth, weight } from '@expo/ui/jetpack-compose/modifiers';

/** Lets a child take the remaining width of its row. */
export const fill: ModifierConfig[] = [weight(1)];

/** Stretches a row to the width its host was given. */
export const fullWidth: ModifierConfig[] = [fillMaxWidth()];

/** Compose sheets take their colors from props, so nothing is needed here. */
export function sheetScheme(_scheme: 'light' | 'dark'): ModifierConfig[] {
  return [];
}
