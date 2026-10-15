import { useRef } from 'react';
import { CodeEditor, type CodeEditorRef } from 'react-native-codepad';

export function SearchExample() {
  const editor = useRef<CodeEditorRef>(null);

  async function renameTodos() {
    const ref = editor.current;
    if (!ref) return;
    const { count } = await ref.setSearch({ text: 'TODO', wholeWord: true });
    if (count > 0) await ref.replaceAll('DONE');
  }

  return <CodeEditor ref={editor} onReady={renameTodos} style={{ flex: 1 }} />;
}
