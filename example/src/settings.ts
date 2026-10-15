import type { Suggestions } from 'react-native-codepad';

export type Settings = {
  softWrap: boolean;
  lineNumbers: boolean;
  activeLine: boolean;
  matchBrackets: boolean;
  autoClose: boolean;
  highlight: boolean;
  readOnly: boolean;
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
  readOnly: false,
  suggestions: 'off',
  fontSize: 14,
};
