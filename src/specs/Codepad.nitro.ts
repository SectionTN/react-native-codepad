import type { HybridObject } from 'react-native-nitro-modules';

export interface Codepad extends HybridObject<{ ios: 'swift'; android: 'kotlin' }> {
  availableLanguages(): string[];
}
