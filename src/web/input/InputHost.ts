/// <reference lib="dom" />
import type { Suggestions } from '../../types';
import type { TextareaState, WebInputSession } from './WebInputSession';

export type InputHooks = {
  // True when the key ran an editor command, so the browser must not act on it.
  keyDown(e: KeyboardEvent): boolean;
  focusChanged(focused: boolean): void;
  changed(): void;
};

const SUGGESTION_ATTRIBUTES: [string, string, string][] = [
  ['autocomplete', 'on', 'off'],
  ['autocorrect', 'on', 'off'],
  ['autocapitalize', 'sentences', 'off'],
  ['spellcheck', 'true', 'false'],
];

// The hidden textarea the keyboard types into, wired to a WebInputSession.
export class InputHost {
  readonly textarea: HTMLTextAreaElement;
  // iOS reports the selection as 0,0 for a moment after focus, so selection changes wait a frame.
  private settling = false;
  private readonly listeners: [EventTarget, string, EventListener][] = [];

  constructor(
    root: HTMLElement,
    private readonly session: WebInputSession,
    private readonly hooks: InputHooks,
  ) {
    const ta = document.createElement('textarea');
    // 16px keeps iOS from zooming the page on focus.
    ta.style.cssText =
      'position:absolute;left:0;top:0;width:2px;height:1px;padding:0;border:0;margin:0;opacity:0;' +
      'resize:none;overflow:hidden;white-space:pre;font-size:16px;line-height:1;color:transparent;' +
      'background:transparent;caret-color:transparent;outline:none;pointer-events:none;';
    this.textarea = ta;
    this.setSuggestions('off');
    root.append(ta);
    this.on(ta, 'beforeinput', () => this.session.beforeInput(this.state()));
    this.on(ta, 'input', (e) => {
      const ie = e as InputEvent;
      this.write(
        this.session.input(
          { inputType: ie.inputType ?? '', data: ie.data ?? null, isComposing: !!ie.isComposing },
          this.state(),
        ),
      );
      this.hooks.changed();
    });
    this.on(ta, 'compositionstart', () => {
      this.session.compositionStart(this.state());
      this.hooks.changed();
    });
    this.on(ta, 'compositionend', () => {
      const value = ta.value;
      const next = this.session.compositionEnd(this.state());
      this.hooks.changed();
      // A browser may still send the composition's last input after this event.
      setTimeout(() => {
        if (ta.value === value && !this.session.composing) this.write(next);
      }, 0);
    });
    this.on(ta, 'keydown', (e) => {
      if (this.hooks.keyDown(e as KeyboardEvent)) e.preventDefault();
    });
    this.on(ta, 'focus', () => {
      this.settling = true;
      requestAnimationFrame(() => {
        this.settling = false;
      });
      this.hooks.focusChanged(true);
    });
    this.on(ta, 'blur', () => {
      this.session.finishComposition();
      this.hooks.focusChanged(false);
    });
    this.on(document, 'selectionchange', () => {
      if (this.settling || document.activeElement !== ta) return;
      this.write(this.session.selectionChange(this.state()));
      this.hooks.changed();
    });
  }

  get focused(): boolean {
    return document.activeElement === this.textarea;
  }

  state(): TextareaState {
    const ta = this.textarea;
    return { value: ta.value, start: ta.selectionStart, end: ta.selectionEnd };
  }

  write(state: TextareaState | null): void {
    if (!state) return;
    const ta = this.textarea;
    if (ta.value !== state.value) ta.value = state.value;
    if (ta.selectionStart !== state.start || ta.selectionEnd !== state.end)
      ta.setSelectionRange(state.start, state.end);
  }

  // Keeps the textarea at the caret, so the keyboard's candidate window opens there.
  place(x: number, y: number): void {
    this.textarea.style.left = `${Math.round(x)}px`;
    this.textarea.style.top = `${Math.round(y)}px`;
  }

  focus(): void {
    this.write(this.session.sync());
    this.textarea.focus({ preventScroll: true });
  }

  blur(): void {
    this.textarea.blur();
  }

  setSuggestions(suggestions: Suggestions): void {
    for (const [name, on, off] of SUGGESTION_ATTRIBUTES)
      this.textarea.setAttribute(name, suggestions === 'on' ? on : off);
  }

  // A read only textarea brings no keyboard on a phone, while selection still works.
  setReadOnly(readOnly: boolean): void {
    this.textarea.readOnly = readOnly;
  }

  destroy(): void {
    for (const [target, type, fn] of this.listeners) target.removeEventListener(type, fn);
    this.textarea.remove();
  }

  private on(target: EventTarget, type: string, fn: EventListener): void {
    target.addEventListener(type, fn);
    this.listeners.push([target, type, fn]);
  }
}
