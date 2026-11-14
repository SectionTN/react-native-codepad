import { availableLanguages } from './web/loader';

export { githubDark } from './themes/githubDark';
export { githubLight } from './themes/githubLight';
export { oneDark } from './themes/oneDark';
export type {
  CaretDirection,
  ChangeEvent,
  ChangeOrigin,
  CodeEditorProps,
  CodeEditorRef,
  ContentInsets,
  ContentSizeEvent,
  Decoration,
  GapLayoutEvent,
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
export { configureWeb } from './web/configure';

// The languages the web command found in the app, once languages.json loaded.
export const Codepad: { availableLanguages(): string[] } = { availableLanguages };
