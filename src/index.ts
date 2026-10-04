import { NitroModules } from 'react-native-nitro-modules';
import type { Codepad as CodepadSpec } from './specs/Codepad.nitro';

export type { CodeEditorProps, CodeEditorRef } from './CodeEditor';
export { CodeEditor } from './CodeEditor';

export const Codepad: { availableLanguages(): string[] } =
  NitroModules.createHybridObject<CodepadSpec>('Codepad');
