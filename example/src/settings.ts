import type { Suggestions } from 'react-native-codepad';

export type Settings = {
  softWrap: boolean;
  lineNumbers: boolean;
  activeLine: boolean;
  matchBrackets: boolean;
  autoClose: boolean;
  highlight: boolean;
  jetBrainsMono: boolean;
  readOnly: boolean;
  decorations: boolean;
  suggestions: Suggestions;
  fontSize: number;
};

export const DEFAULT_SETTINGS: Settings = {
  softWrap: false,
  lineNumbers: true,
  activeLine: true,
  matchBrackets: true,
  autoClose: true,
  highlight: true,
  jetBrainsMono: false,
  readOnly: false,
  decorations: false,
  suggestions: 'off',
  fontSize: 14,
};
