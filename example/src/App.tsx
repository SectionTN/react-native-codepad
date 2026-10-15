import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { EditorApp } from './EditorApp';
import { NestedScreen } from './screens/NestedScreen';

type Screen = 'editor' | 'nested';

// The editor stays mounted behind the demo so its document and settings survive the visit.
export default function App() {
  const [screen, setScreen] = useState<Screen>('editor');
  return (
    <SafeAreaProvider>
      <KeyboardProvider>
        <View style={[styles.fill, screen !== 'editor' && styles.hidden]}>
          <EditorApp onNested={() => setScreen('nested')} />
        </View>
        {screen === 'nested' ? <NestedScreen onBack={() => setScreen('editor')} /> : null}
      </KeyboardProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  hidden: { display: 'none' },
});
