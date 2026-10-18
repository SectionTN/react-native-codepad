import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { EditorApp } from './EditorApp';
import { NestedScreen } from './screens/NestedScreen';
import { DEFAULT_THEME_ID, themeById } from './themes';

type Screen = 'editor' | 'nested';

// The editor stays mounted behind the demo so its document and settings survive the visit.
export default function App() {
  const [screen, setScreen] = useState<Screen>('editor');
  const [themeId, setThemeId] = useState(DEFAULT_THEME_ID);
  return (
    <SafeAreaProvider>
      <KeyboardProvider>
        <View style={[styles.fill, screen !== 'editor' && styles.hidden]}>
          <EditorApp themeId={themeId} onTheme={setThemeId} onNested={() => setScreen('nested')} />
        </View>
        {screen === 'nested' ? (
          <NestedScreen theme={themeById(themeId)} onBack={() => setScreen('editor')} />
        ) : null}
      </KeyboardProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  hidden: { display: 'none' },
});
