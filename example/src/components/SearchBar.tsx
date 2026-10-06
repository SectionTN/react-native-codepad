import { type RefObject, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { CodeEditorRef } from 'react-native-codepad';

type Props = {
  editor: RefObject<CodeEditorRef | null>;
  onStatus: (text: string) => void;
};

function Key({ label, value, onPress }: { label: string; value?: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.key, value && styles.keyOn]}>
      <Text style={styles.keyText}>{label}</Text>
    </Pressable>
  );
}

export function SearchBar({ editor, onStatus }: Props) {
  const [text, setText] = useState('');
  const [regex, setRegex] = useState(false);
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [replacement, setReplacement] = useState('');
  const [count, setCount] = useState(0);
  const [position, setPosition] = useState('0/0');

  // Every query or option change runs a search; the promise settles once the worker has fresh matches.
  useEffect(() => {
    let live = true;
    const run = async () => {
      if (!text) {
        await editor.current?.clearSearch();
        if (live) {
          setCount(0);
          setPosition('0/0');
        }
        return;
      }
      try {
        const result = await editor.current?.setSearch({ text, regex, caseSensitive, wholeWord });
        if (!live) return;
        const n = result?.count ?? 0;
        setCount(n);
        setPosition(`0/${n}`);
      } catch (e) {
        if (!live) return;
        setCount(0);
        setPosition('0/0');
        onStatus(`regex: ${e instanceof Error ? e.message : String(e)}`);
      }
    };
    void run();
    return () => {
      live = false;
    };
  }, [editor, text, regex, caseSensitive, wholeWord, onStatus]);

  const move = async (forward: boolean) => {
    const hit = await (forward ? editor.current?.findNext() : editor.current?.findPrevious());
    if (hit) {
      setCount(hit.total);
      setPosition(`${hit.index + 1}/${hit.total}`);
    } else {
      setPosition('0/0');
    }
  };

  const replaceOne = async () => {
    const replaced = await editor.current?.replaceCurrent(replacement);
    if (replaced) {
      const left = Math.max(0, count - 1);
      setCount(left);
      setPosition(`0/${left}`);
    }
    onStatus(replaced ? 'replaced one' : 'select a match first');
  };

  const replaceEverything = async () => {
    const n = (await editor.current?.replaceAll(replacement)) ?? 0;
    setCount(0);
    setPosition('0/0');
    onStatus(`replaced ${n}`);
  };

  return (
    <View style={styles.bar}>
      <View style={styles.row}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder="Find"
          placeholderTextColor="#8b949e"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Key label="Aa" value={caseSensitive} onPress={() => setCaseSensitive((v) => !v)} />
        <Key label=".*" value={regex} onPress={() => setRegex((v) => !v)} />
        <Key label="W" value={wholeWord} onPress={() => setWholeWord((v) => !v)} />
        <Text style={styles.position}>{position}</Text>
        <Key label="<" onPress={() => void move(false)} />
        <Key label=">" onPress={() => void move(true)} />
      </View>
      <View style={styles.row}>
        <TextInput
          style={styles.input}
          value={replacement}
          onChangeText={setReplacement}
          placeholder="Replace with"
          placeholderTextColor="#8b949e"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Key label="Replace" onPress={() => void replaceOne()} />
        <Key label="All" onPress={() => void replaceEverything()} />
        <Key label="Clear" onPress={() => setText('')} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { gap: 6, paddingHorizontal: 8, paddingBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  input: {
    flex: 1,
    color: '#e6edf3',
    backgroundColor: '#0d1117',
    borderColor: '#30363d',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 14,
  },
  key: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, backgroundColor: '#21262d' },
  keyOn: { backgroundColor: '#1f6feb' },
  keyText: { color: '#e6edf3' },
  position: { color: '#8b949e', fontSize: 12, minWidth: 36, textAlign: 'center' },
});
