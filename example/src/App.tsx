import { SafeAreaView, StyleSheet } from 'react-native';
import { CodeEditor } from 'react-native-codepad';

const sample = ['function greet(name) {', '  return "hi " + name;', '}', ''].join('\n');

export default function App() {
  return (
    <SafeAreaView style={styles.root}>
      <CodeEditor
        style={styles.editor}
        initialValue={sample}
        onReady={() => console.log('codepad ready')}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  editor: { flex: 1 },
});
