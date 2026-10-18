import type { CaretDirection, CodeEditorRef } from 'react-native-codepad';
import { type AppIcon, ICONS } from './icons';

export type Key = {
  label: string;
  icon?: AppIcon;
  run: (api: CodeEditorRef, selectMode: boolean) => unknown;
  disabled?: (state: { canUndo: boolean; canRedo: boolean }) => boolean;
};

const MOVES: [string, AppIcon, CaretDirection][] = [
  ['Left', ICONS.left, 'left'],
  ['Right', ICONS.right, 'right'],
  ['Up', ICONS.up, 'up'],
  ['Down', ICONS.down, 'down'],
];

// Typed through typeText so the auto closer treats them like keystrokes.
const SYMBOLS = ['{', '}', '(', ')', '[', ']', ';', '=', '<', '>', '"', "'"];

/** Every key after Select, in the order the row shows them. */
export const KEYS: Key[] = [
  ...MOVES.map(
    ([label, icon, direction]): Key => ({
      label,
      icon,
      run: (api, select) => api.moveCaret(direction, { select }),
    }),
  ),
  { label: 'Home', run: (api, select) => api.moveCaret('lineStart', { select }) },
  { label: 'End', run: (api, select) => api.moveCaret('lineEnd', { select }) },
  { label: 'Tab', icon: ICONS.tab, run: (api) => api.indent() },
  { label: 'Untab', icon: ICONS.untab, run: (api) => api.outdent() },
  { label: 'Enter', icon: ICONS.enter, run: (api) => api.typeText('\n') },
  { label: 'Delete', icon: ICONS.backspace, run: (api) => api.deleteBackward() },
  ...SYMBOLS.map((symbol): Key => ({ label: symbol, run: (api) => api.typeText(symbol) })),
  { label: 'Undo', icon: ICONS.undo, run: (api) => api.undo(), disabled: (s) => !s.canUndo },
  { label: 'Redo', icon: ICONS.redo, run: (api) => api.redo(), disabled: (s) => !s.canRedo },
  { label: 'Hide keyboard', icon: ICONS.hideKeyboard, run: (api) => api.blur() },
];
