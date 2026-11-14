import { JetBrainsMono_400Regular, useFonts } from '@expo-google-fonts/jetbrains-mono';
import { EditorApp } from './EditorApp.web';

// The web build has none of the native chrome, so it skips the keyboard and safe area providers.
export default function App() {
  const [fontsLoaded, fontError] = useFonts({ JetBrainsMono_400Regular });
  if (!fontsLoaded && !fontError) return null;
  return <EditorApp />;
}
