import { Button, Column, Host, Row, Text, TextInput, type TextInputRef } from '@expo/ui';
import { type RefObject, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { CodeEditorRef } from 'react-native-codepad';
import type { Chrome } from '../chrome';
import { ICONS } from '../icons';
import { IconButton } from '../native/IconButton';
import { fill, fullWidth } from '../native/layout';

type Props = {
  chrome: Chrome;
  editor: RefObject<CodeEditorRef | null>;
  onStatus: (text: string) => void;
  onClose: () => void;
};

const NO_MATCH = { index: 0, count: 0 };

export function FindBar({ chrome, editor, onStatus, onClose }: Props) {
  const findField = useRef<TextInputRef>(null);
  const [query, setQuery] = useState('');
  const [replacement, setReplacement] = useState('');
  const [regex, setRegex] = useState(false);
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  // index is the 1 based position of the selected match, 0 when none is selected.
  const [match, setMatch] = useState(NO_MATCH);

  // Every query or option change runs a search; the promise settles once the worker has fresh matches.
  useEffect(() => {
    let live = true;
    const run = async () => {
      if (!query) {
        await editor.current?.clearSearch();
        if (live) setMatch(NO_MATCH);
        return;
      }
      try {
        const result = await editor.current?.setSearch({
          text: query,
          regex,
          caseSensitive,
          wholeWord,
        });
        if (!live) return;
        const count = result?.count ?? 0;
        if (count === 0) {
          setMatch(NO_MATCH);
          return;
        }
        const hit = await editor.current?.findNext();
        if (!live) return;
        setMatch(hit ? { index: hit.index + 1, count: hit.total } : { index: 0, count });
      } catch {
        if (!live) return;
        setMatch(NO_MATCH);
        onStatus('invalid regex');
      }
    };
    void run();
    return () => {
      live = false;
    };
  }, [editor, query, regex, caseSensitive, wholeWord, onStatus]);

  // Leaving the bar clears the painted matches.
  useEffect(() => {
    const api = editor.current;
    return () => void api?.clearSearch();
  }, [editor]);

  const move = async (forward: boolean) => {
    const hit = await (forward ? editor.current?.findNext() : editor.current?.findPrevious());
    setMatch(hit ? { index: hit.index + 1, count: hit.total } : NO_MATCH);
  };

  // replaceCurrent selects the next match, which takes over the replaced index unless it was the last one.
  const replaceOne = async () => {
    const replaced = await editor.current?.replaceCurrent(replacement);
    if (replaced) {
      const left = Math.max(0, match.count - 1);
      setMatch({ index: left === 0 ? 0 : match.index > left ? 1 : match.index, count: left });
    }
    onStatus(replaced ? 'replaced one' : 'select a match first');
  };

  const replaceEverything = async () => {
    const n = (await editor.current?.replaceAll(replacement)) ?? 0;
    setMatch(NO_MATCH);
    onStatus(`replaced ${n}`);
  };

  const field = {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: chrome.hairline,
    backgroundColor: chrome.background,
  };
  const fieldText = { fontSize: 14, color: chrome.text };
  const count = { fontSize: 12, color: chrome.muted };

  return (
    <View
      style={[styles.bar, { backgroundColor: chrome.surface, borderBottomColor: chrome.hairline }]}
    >
      <Host matchContents={{ vertical: true }} style={styles.host} colorScheme={chrome.scheme}>
        <Column spacing={6} style={styles.column} modifiers={fullWidth}>
          <Row alignment="center" spacing={6} modifiers={fullWidth}>
            <TextInput
              ref={findField}
              placeholder="Find"
              placeholderTextColor={chrome.muted}
              onChangeText={setQuery}
              autoFocus
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              onSubmitEditing={() => void move(true)}
              style={field}
              textStyle={fieldText}
              modifiers={fill}
            />
            <Button
              variant={caseSensitive ? 'filled' : 'outlined'}
              label="Aa"
              onPress={() => setCaseSensitive((v) => !v)}
            />
            <Button
              variant={regex ? 'filled' : 'outlined'}
              label=".*"
              onPress={() => setRegex((v) => !v)}
            />
            <Button
              variant={wholeWord ? 'filled' : 'outlined'}
              label="W"
              onPress={() => setWholeWord((v) => !v)}
            />
            <Text textStyle={count}>{`${match.index} of ${match.count}`}</Text>
            <IconButton
              icon={ICONS.previous}
              label="Previous match"
              onPress={() => void move(false)}
              color={chrome.text}
            />
            <IconButton
              icon={ICONS.next}
              label="Next match"
              onPress={() => void move(true)}
              color={chrome.text}
            />
          </Row>
          <Row alignment="center" spacing={6} modifiers={fullWidth}>
            <TextInput
              placeholder="Replace"
              placeholderTextColor={chrome.muted}
              onChangeText={setReplacement}
              autoCapitalize="none"
              autoCorrect={false}
              style={field}
              textStyle={fieldText}
              modifiers={fill}
            />
            <Button variant="outlined" label="Replace" onPress={() => void replaceOne()} />
            <Button variant="outlined" label="All" onPress={() => void replaceEverything()} />
            <Button variant="text" label="Done" onPress={onClose} />
          </Row>
        </Column>
      </Host>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { borderBottomWidth: StyleSheet.hairlineWidth },
  host: { alignSelf: 'stretch' },
  column: { paddingHorizontal: 8, paddingVertical: 8 },
});
