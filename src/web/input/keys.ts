import type { MoveUnit } from '../core/EditorCore';

export type KeyLike = {
  key: string;
  shiftKey: boolean;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  isComposing: boolean;
  code?: string;
  keyCode?: number;
};

export type KeyCommand =
  | { kind: 'move'; unit: MoveUnit; forward: boolean; extend: boolean }
  | { kind: 'vertical'; by: 'row' | 'page'; forward: boolean; extend: boolean }
  | { kind: 'tab' | 'shiftTab' | 'undo' | 'redo' | 'selectAll' };

// Keydown 229 is a key the keyboard's composition takes.
const COMPOSING_KEY_CODE = 229;

// The letter of a shortcut, from the physical key when the layout's key is not a Latin letter.
function letter(k: KeyLike): string {
  const key = k.key.toLowerCase();
  if (/^[a-z]$/.test(key)) return key;
  return /^Key[A-Z]$/.test(k.code ?? '') ? (k.code as string).slice(3).toLowerCase() : key;
}

// What a hardware key asks the editor to do, or null for a key the textarea handles itself.
export function keyCommand(k: KeyLike, mac: boolean): KeyCommand | null {
  if (k.isComposing || k.keyCode === COMPOSING_KEY_CODE) return null;
  const extend = k.shiftKey;
  const move = (unit: MoveUnit, forward: boolean): KeyCommand => ({
    kind: 'move',
    unit,
    forward,
    extend,
  });
  const vertical = (by: 'row' | 'page', forward: boolean): KeyCommand => ({
    kind: 'vertical',
    by,
    forward,
    extend,
  });
  // Command on a Mac, Control elsewhere.
  const primary = mac ? k.metaKey && !k.ctrlKey : k.ctrlKey && !k.metaKey;
  const plain = !k.ctrlKey && !k.metaKey && !k.altKey;
  switch (k.key) {
    case 'ArrowLeft':
    case 'ArrowRight': {
      const forward = k.key === 'ArrowRight';
      if (plain) return move('char', forward);
      if (mac && k.altKey && !k.metaKey && !k.ctrlKey) return move('word', forward);
      if (mac && k.metaKey && !k.altKey && !k.ctrlKey)
        return move(forward ? 'lineEnd' : 'lineStart', forward);
      if (!mac && k.ctrlKey && !k.altKey && !k.metaKey) return move('word', forward);
      return null;
    }
    case 'ArrowUp':
    case 'ArrowDown': {
      const forward = k.key === 'ArrowDown';
      if (plain) return vertical('row', forward);
      if (mac && k.metaKey && !k.altKey && !k.ctrlKey)
        return move(forward ? 'docEnd' : 'docStart', forward);
      return null;
    }
    case 'PageUp':
    case 'PageDown':
      return plain ? vertical('page', k.key === 'PageDown') : null;
    case 'Home':
    case 'End': {
      const forward = k.key === 'End';
      if (plain) return move(forward ? 'lineEnd' : 'lineStart', forward);
      if ((k.ctrlKey || k.metaKey) && !k.altKey)
        return move(forward ? 'docEnd' : 'docStart', forward);
      return null;
    }
    case 'Tab':
      if (!plain) return null;
      return { kind: k.shiftKey ? 'shiftTab' : 'tab' };
  }
  if (!primary || k.altKey) return null;
  switch (letter(k)) {
    case 'z':
      return { kind: k.shiftKey ? 'redo' : 'undo' };
    case 'y':
      return !mac && !k.shiftKey ? { kind: 'redo' } : null;
    case 'a':
      return k.shiftKey ? null : { kind: 'selectAll' };
  }
  return null;
}
