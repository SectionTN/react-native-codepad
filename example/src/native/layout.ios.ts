import type { ModifierConfig } from '@expo/ui/swift-ui/modifiers';
import { frame, preferredColorScheme } from '@expo/ui/swift-ui/modifiers';

/** Lets a child take the remaining width of its row; SwiftUI text fields grow on their own. */
export const fill: ModifierConfig[] = [];

/** Stretches a row to the width its host was given. */
export const fullWidth: ModifierConfig[] = [frame({ maxWidth: Infinity })];

/** A sheet presents in its own window, so it takes the theme's scheme here instead of from its host. */
export function sheetScheme(scheme: 'light' | 'dark'): ModifierConfig[] {
  return [preferredColorScheme(scheme)];
}
