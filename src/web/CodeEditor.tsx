/// <reference lib="dom" />
import {
  type ComponentRef,
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { View } from 'react-native';
import { githubLight } from '../themes/githubLight';
import type { CodeEditorProps, CodeEditorRef, ContentInsets } from '../types';
import { EditorView, type ViewOptions } from './EditorView';
import { loadCore } from './loader';

const NO_INSETS: ContentInsets = {};
// The editor on react-native-web: a View whose node holds lines drawn from the WASM core, outside React's render.
export const CodeEditor = forwardRef<CodeEditorRef, CodeEditorProps>(function CodeEditor(
  {
    initialValue = '',
    language = '',
    theme = githubLight,
    fontFamily = '',
    fontSize = 14,
    lineHeight = 1.4,
    lineNumbers = true,
    softWrap = false,
    readOnly = false,
    highlightActiveLine = true,
    matchBrackets = true,
    placeholder = '',
    scrollEnabled = true,
    contentInsets = NO_INSETS,
    textPadding = 8,
    avoidKeyboard = false,
    tabSize = 4,
    insertSpaces = true,
    autoIndent = true,
    autoCloseBrackets = true,
    suggestions = 'off',
    autoFocus = false,
    onReady,
    onScroll,
    onSelectionChange,
    onChange,
    onChangeText,
    onFocus,
    onBlur,
    onContentSizeChange,
    decorations,
    decorationsRevision,
    onGapLayout,
    ...viewProps
  },
  ref,
) {
  const node = useRef<ComponentRef<typeof View>>(null);
  const [view, setView] = useState<EditorView | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  // Writes made before the core loads, run in order once the view exists, or settled unapplied when none comes.
  const queued = useRef<{ edit: (v: EditorView) => void; done: () => void }[]>([]);
  const gone = useRef(false);
  const handlers = useRef({
    onReady,
    onScroll,
    onSelectionChange,
    onChange,
    onChangeText,
    onContentSizeChange,
    onFocus,
    onBlur,
    onGapLayout,
  });
  handlers.current = {
    onReady,
    onScroll,
    onSelectionChange,
    onChange,
    onChangeText,
    onContentSizeChange,
    onFocus,
    onBlur,
    onGapLayout,
  };
  const initial = useRef(initialValue);

  // The callbacks read the latest handlers and the view through refs, so the object only follows the props.
  const options = useMemo<Partial<ViewOptions>>(
    () => ({
      theme,
      fontFamily,
      fontSize,
      lineHeight,
      lineNumbers,
      softWrap,
      highlightActiveLine,
      matchBrackets,
      textPadding,
      contentInsets,
      scrollEnabled,
      placeholder,
      readOnly,
      tabSize,
      insertSpaces,
      autoIndent,
      autoCloseBrackets,
      suggestions,
      autoFocus,
      avoidKeyboard,
      onFocus: () => handlers.current.onFocus?.(),
      onBlur: () => handlers.current.onBlur?.(),
      onContentSize: (width, height) => handlers.current.onContentSizeChange?.({ width, height }),
      onScroll: (x, y, contentWidth, contentHeight) =>
        handlers.current.onScroll?.({ x, y, contentWidth, contentHeight }),
      onFirstDraw: () => handlers.current.onReady?.(),
      onGapLayout: (gaps) => handlers.current.onGapLayout?.({ gaps }),
      onChange: (c) => {
        const h = handlers.current;
        h.onChange?.({
          start: c.start,
          end: c.start + c.removedLength,
          text: c.inserted,
          origin: c.origin,
          revision: c.revision,
        });
        if (h.onChangeText && viewRef.current) h.onChangeText(viewRef.current.core.text());
      },
      onSelection: (anchor, head, revision) =>
        handlers.current.onSelectionChange?.({ anchor, head, revision }),
    }),
    [
      theme,
      fontFamily,
      fontSize,
      lineHeight,
      lineNumbers,
      softWrap,
      highlightActiveLine,
      matchBrackets,
      textPadding,
      contentInsets,
      scrollEnabled,
      placeholder,
      readOnly,
      tabSize,
      insertSpaces,
      autoIndent,
      autoCloseBrackets,
      suggestions,
      autoFocus,
      avoidKeyboard,
    ],
  );
  const latest = useRef({ options, language, decorations, decorationsRevision });
  // Written on commit, so the props of a render React drops never reach the view.
  useLayoutEffect(() => {
    latest.current = { options, language, decorations, decorationsRevision };
  });
  // The decorations last sent, so the view gets them before its first draw and a repeat is not mapped twice.
  const sent = useRef<{ items?: typeof decorations; revision?: number }>({});
  const sendDecorations = useCallback((v: EditorView) => {
    const { decorations: items, decorationsRevision: revision } = latest.current;
    const last = sent.current;
    if (items === last.items && revision === last.revision) return;
    sent.current = { items, revision };
    // A prop that goes away clears for the current text, and one that never came sends nothing.
    if (items || last.items) v.setDecorations(items ?? [], items ? (revision ?? -1) : -1);
  }, []);

  // Options, language and decorations reach the view before its first draw, which the pump runs before React commits.
  useEffect(() => {
    let alive = true;
    let created: EditorView | null = null;
    gone.current = false;
    const drop = () => {
      for (const write of queued.current.splice(0)) write.done();
    };
    loadCore().then(
      (m) => {
        const host = node.current as unknown as HTMLElement | null;
        if (!alive || !host) return;
        const v = new EditorView(host, m, initial.current);
        created = v;
        v.setOptions(latest.current.options);
        v.setLanguage(latest.current.language);
        sent.current = {};
        sendDecorations(v);
        viewRef.current = v;
        for (const write of queued.current.splice(0)) {
          write.edit(v);
          write.done();
        }
        setView(v);
      },
      (e: Error) => {
        console.warn(e.message);
        // No view comes for this editor, so later writes settle at once.
        gone.current = true;
        drop();
      },
    );
    return () => {
      alive = false;
      gone.current = true;
      viewRef.current = null;
      created?.destroy();
      // A StrictMode remount runs the effect again before this fires and keeps the waiting writes.
      setTimeout(() => gone.current && drop(), 0);
    };
  }, [sendDecorations]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: sendDecorations reads the props through latest.
  useEffect(() => {
    if (view) sendDecorations(view);
  }, [view, decorations, decorationsRevision]);

  useEffect(() => {
    view?.setOptions(options);
  }, [view, options]);

  useEffect(() => {
    view?.setLanguage(language);
  }, [view, language]);

  // Reads see an empty document until the core loads and after unmount. Writes made before the load wait for it.
  useImperativeHandle(ref, () => {
    const core = () => viewRef.current?.core;
    // Runs on the view now, or once the core loads when the call comes before it.
    const run = (call: (v: EditorView) => void): Promise<void> => {
      const v = viewRef.current;
      if (v) call(v);
      else if (!gone.current)
        return new Promise((done) => queued.current.push({ edit: call, done }));
      return Promise.resolve();
    };
    const write = (edit: (v: EditorView) => void) => run((v) => v.apply(() => edit(v)));
    // A call with a result: on the view now, once it loads, or the fallback when no view comes.
    const ask = <T,>(call: (v: EditorView) => Promise<T>, fallback: T): Promise<T> => {
      const v = viewRef.current;
      if (v) return call(v);
      if (gone.current) return Promise.resolve(fallback);
      return new Promise<T>((resolve, reject) => {
        let started = false;
        queued.current.push({
          edit: (view) => {
            started = true;
            call(view).then(resolve, reject);
          },
          done: () => {
            if (!started) resolve(fallback);
          },
        });
      });
    };
    return {
      getText: () => core()?.text() ?? '',
      getTextInRange: (range) => core()?.text(range.start, range.end) ?? '',
      getLength: () => core()?.length ?? 0,
      getLineCount: () => core()?.lineCount ?? 1,
      getLine: (index) => core()?.line(index) ?? '',
      getSelection: () => core()?.selection ?? { anchor: 0, head: 0 },
      getRevision: () => core()?.revision ?? 0,
      offsetToPosition: (offset) => core()?.offsetToPosition(offset) ?? { line: 0, column: 0 },
      positionToOffset: (pos) => core()?.positionToOffset(pos.line, pos.column) ?? 0,
      getCursorRect: () => {
        const v = viewRef.current;
        return v ? v.caretRect(v.core.selection.head) : null;
      },
      getGapRect: (line) => viewRef.current?.gapRect(line) ?? null,
      getVisibleLines: () => viewRef.current?.visibleLines() ?? { first: 0, last: 0 },
      canUndo: () => core()?.canUndo ?? false,
      canRedo: () => core()?.canRedo ?? false,
      isFocused: () => viewRef.current?.focused ?? false,
      setText: (text, opts) => run((v) => v.setText(text, opts?.keepHistory ?? false)),
      setSelection: (sel) => write((v) => v.core.setSelection(sel.anchor, sel.head)),
      selectAll: () => write((v) => v.core.selectAll()),
      scrollToLine: (line, opts) => {
        viewRef.current?.scrollToLine(line, opts?.animated ?? false);
        return Promise.resolve();
      },
      revealSelection: () => {
        viewRef.current?.revealSelection();
        return Promise.resolve();
      },
      replaceRange: (range, text) => write((v) => v.core.replace(range.start, range.end, text)),
      insertText: (text) => write((v) => v.core.insertText(text)),
      undo: () => write((v) => v.core.undo()),
      redo: () => write((v) => v.core.redo()),
      indent: () => write((v) => v.core.indent()),
      outdent: () => write((v) => v.core.outdent()),
      cut: () => ask((v) => v.cutSelection(), undefined),
      copy: () => ask((v) => v.copySelection(), undefined),
      paste: () => ask((v) => v.pasteClipboard(), undefined),
      focus: () => run((v) => v.focus()),
      blur: () => run((v) => v.blur()),
      setSearch: (query) => ask((v) => v.setSearch(query), { count: 0, limited: false }),
      findNext: () => ask((v) => v.findNext(), null),
      findPrevious: () => ask((v) => v.findPrevious(), null),
      replaceCurrent: (text) => ask((v) => v.replaceCurrent(text), false),
      replaceAll: (text) => ask((v) => v.replaceAll(text), 0),
      clearSearch: () => ask((v) => v.clearSearch(), undefined),
      moveCaret: (direction, opts) => run((v) => v.moveCaret(direction, opts?.select ?? false)),
      typeText: (text) => run((v) => v.typeText(text)),
      deleteBackward: () => run((v) => v.deleteBackward()),
      deleteForward: () => run((v) => v.deleteForward()),
    };
  }, []);

  return <View {...viewProps} ref={node} />;
});
