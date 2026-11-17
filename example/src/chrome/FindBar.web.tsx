import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { FindBarProps } from './types';
import { useFind } from './useFind';

// The find bar on the web: query, the three options, previous and next, replacement, replace and replace all.
export function FindBar({ scheme, editor, onStatus, onClose }: FindBarProps) {
  const find = useFind(editor, onStatus);
  const color = scheme === 'dark' ? '#e6edf3' : '#1f2328';
  const field = [styles.field, { color }];
  const button = (label: string, onPress: () => void, on = false) => (
    <Pressable onPress={onPress} style={[styles.button, on && styles.on]}>
      <Text style={[styles.label, { color: on ? '#fff' : color }]}>{label}</Text>
    </Pressable>
  );
  const { index, count } = find.match;
  return (
    <View style={styles.bar}>
      <TextInput placeholder="Find" style={field} onChangeText={find.setQuery} autoFocus />
      <Text style={[styles.label, { color }]}>
        {count ? `${index || '-'} of ${count}` : 'no results'}
      </Text>
      {button('.*', () => find.toggle('regex'), find.options.regex)}
      {button('Aa', () => find.toggle('caseSensitive'), find.options.caseSensitive)}
      {button('W', () => find.toggle('wholeWord'), find.options.wholeWord)}
      {button('prev', find.previous)}
      {button('next', find.next)}
      <TextInput placeholder="Replace" style={field} onChangeText={find.setReplacement} />
      {button('replace', find.replaceOne)}
      {button('all', find.replaceAll)}
      {button('close', onClose)}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, padding: 8, alignItems: 'center' },
  field: {
    minWidth: 120,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#8886',
    borderRadius: 6,
  },
  button: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: '#8883' },
  on: { backgroundColor: '#0969da' },
  label: { fontSize: 13 },
});
