import { CodeEditor, githubDark, type Theme } from 'react-native-codepad';

const theme: Theme = {
  ...githubDark,
  tokens: { ...githubDark.tokens, keyword: { color: '#ff7b72', bold: true } },
};

export function ThemedEditor() {
  return <CodeEditor theme={theme} fontSize={14} lineHeight={22} style={{ flex: 1 }} />;
}
