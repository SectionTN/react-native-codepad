import { NitroModules } from 'react-native-nitro-modules';
import type { Codepad as CodepadSpec } from './specs/Codepad.nitro';

export { CodeEditor } from './CodeEditor';
export { githubDark } from './themes/githubDark';
export { githubLight } from './themes/githubLight';
export { oneDark } from './themes/oneDark';
export type {
  ChangeEvent,
  ChangeOrigin,
  CodeEditorProps,
  CodeEditorRef,
  ContentInsets,
  Position,
  Range,
  Rect,
  ScrollEvent,
  SearchHit,
  SearchQuery,
  Selection,
  SelectionChangeEvent,
  Suggestions,
  Theme,
  TokenStyle,
} from './types';

export const Codepad: { availableLanguages(): string[] } =
  NitroModules.createHybridObject<CodepadSpec>('Codepad');
