import type { Settings } from '../settings';

/** The switches in the order the sheet shows them. */
export const SWITCHES: [keyof Settings, string][] = [
  ['softWrap', 'Soft wrap'],
  ['lineNumbers', 'Line numbers'],
  ['activeLine', 'Active line'],
  ['matchBrackets', 'Match brackets'],
  ['autoClose', 'Auto close brackets'],
  ['highlight', 'Syntax highlighting'],
  ['readOnly', 'Read only'],
];

export const SUGGESTIONS: [Settings['suggestions'], string][] = [
  ['off', 'Off'],
  ['forceOff', 'Force off'],
  ['on', 'On'],
];

export const FONT_SIZE = { min: 12, max: 22 };
