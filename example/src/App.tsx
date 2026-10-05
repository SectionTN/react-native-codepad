import { useState } from 'react';
import { Pressable, StatusBar, StyleSheet, Text, View } from 'react-native';
import { BenchmarkScreen } from './screens/BenchmarkScreen';
import { EditorScreen } from './screens/EditorScreen';

type Tab = 'editor' | 'benchmark';

export default function App() {
  const [tab, setTab] = useState<Tab>('editor');
  return (
    <View style={styles.root}>
      <View style={styles.tabs}>
        {(['editor', 'benchmark'] as const).map((t) => (
          <Pressable
            key={t}
            onPress={() => setTab(t)}
            style={[styles.tab, tab === t && styles.tabOn]}
          >
            <Text style={styles.tabText}>{t === 'editor' ? 'Editor' : 'Benchmark'}</Text>
          </Pressable>
        ))}
      </View>
      {tab === 'editor' ? <EditorScreen /> : <BenchmarkScreen />}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0d1117', paddingTop: StatusBar.currentHeight ?? 0 },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#30363d',
  },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center' },
  tabOn: { borderBottomWidth: 2, borderBottomColor: '#1f6feb' },
  tabText: { color: '#e6edf3', fontWeight: '600' },
});
