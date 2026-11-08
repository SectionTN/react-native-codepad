import {
  JetBrainsMono_400Regular,
  JetBrainsMono_500Medium,
  JetBrainsMono_600SemiBold,
  useFonts,
} from '@expo-google-fonts/jetbrains-mono';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { EditorApp } from './EditorApp';
import { NestedScreen } from './screens/NestedScreen';
import { DEFAULT_THEME_ID, themeById } from './themes';

type Screen = 'editor' | 'nested';

// The demo covers the editor instead of hiding it: Fabric unmounts a display none subtree, which
// would recreate the native editor and drop the document.
export default function App() {
  const [screen, setScreen] = useState<Screen>('editor');
  const [themeId, setThemeId] = useState(DEFAULT_THEME_ID);
  // The editor resolves fontFamily when the prop is set, so the faces load before it mounts.
  const [fontsLoaded, fontError] = useFonts({
    JetBrainsMono_400Regular,
    JetBrainsMono_500Medium,
    JetBrainsMono_600SemiBold,
  });
  if (!fontsLoaded && !fontError) return null;
  return (
    <SafeAreaProvider>
      <KeyboardProvider>
        <EditorApp themeId={themeId} onTheme={setThemeId} onNested={() => setScreen('nested')} />
        {screen === 'nested' ? (
          <View style={styles.overlay}>
            <NestedScreen theme={themeById(themeId)} onBack={() => setScreen('editor')} />
          </View>
        ) : null}
      </KeyboardProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  // Above the editor's floating chrome, which carries its own zIndex.
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 2 },
});
