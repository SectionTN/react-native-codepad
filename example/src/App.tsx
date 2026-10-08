import { type ComponentType, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { BenchmarkScreen } from './screens/BenchmarkScreen';
import { EditorScreen } from './screens/EditorScreen';
import { NestedScreen } from './screens/NestedScreen';
import { ToolbarScreen } from './screens/ToolbarScreen';

type Tab = 'editor' | 'toolbar' | 'nested' | 'benchmark';

const TABS: { id: Tab; label: string }[] = [
  { id: 'editor', label: 'Editor' },
  { id: 'toolbar', label: 'Toolbar' },
  { id: 'nested', label: 'Nested' },
  { id: 'benchmark', label: 'Benchmark' },
];

const SCREENS: Record<Tab, ComponentType> = {
  editor: EditorScreen,
  toolbar: ToolbarScreen,
  nested: NestedScreen,
  benchmark: BenchmarkScreen,
};

export default function App() {
  return (
    <SafeAreaProvider>
      <KeyboardProvider>
        <Shell />
      </KeyboardProvider>
    </SafeAreaProvider>
  );
}

// The inset hook needs the provider above it, so the tabs live one level down from App.
function Shell() {
  const [tab, setTab] = useState<Tab>('editor');
  const insets = useSafeAreaInsets();
  const Screen = SCREENS[tab];
  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.tabs}>
        {TABS.map((t) => (
          <Pressable
            key={t.id}
            onPress={() => setTab(t.id)}
            style={[styles.tab, tab === t.id && styles.tabOn]}
          >
            <Text style={styles.tabText}>{t.label}</Text>
          </Pressable>
        ))}
      </View>
      <Screen />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0d1117' },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#30363d',
  },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center' },
  tabOn: { borderBottomWidth: 2, borderBottomColor: '#1f6feb' },
  tabText: { color: '#e6edf3', fontWeight: '600' },
});
