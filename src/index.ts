import { NitroModules } from 'react-native-nitro-modules';
import type { Codepad as CodepadSpec } from './specs/Codepad.nitro';

export { CodeEditor } from './CodeEditor';
export type { CodeEditorProps, CodeEditorRef } from './types';

export const Codepad: { availableLanguages(): string[] } =
  NitroModules.createHybridObject<CodepadSpec>('Codepad');
