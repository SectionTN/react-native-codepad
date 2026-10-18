import { type MaterialColors, useMaterialColors } from '@expo/ui/jetpack-compose';
import type { Scheme } from './theme';

/** Material 3 roles for the scheme the document chose, dynamic on Android 12 and later. */
export function useAndroidColors(scheme: Scheme): MaterialColors {
  return useMaterialColors({ colorScheme: scheme });
}
