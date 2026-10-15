import { BottomSheet, Button, Column, Row, Text, TextInput } from '@expo/ui';
import { useState } from 'react';
import type { Chrome } from '../chrome';
import { fill, fullWidth, sheetScheme } from '../native/layout';

type Props = {
  chrome: Chrome;
  open: boolean;
  lineCount: number;
  onClose: () => void;
  onGo: (line: number) => void;
};

export function GoToLineSheet({ chrome, open, lineCount, onClose, onGo }: Props) {
  const [text, setText] = useState('');
  const go = () => {
    const line = Number.parseInt(text, 10);
    if (Number.isFinite(line) && line >= 1) onGo(Math.min(line, lineCount));
    onClose();
  };
  const title = { fontSize: 17, fontWeight: '600' as const, color: chrome.text };
  return (
    <BottomSheet
      isPresented={open}
      onDismiss={onClose}
      containerColor={chrome.surface}
      contentColor={chrome.text}
      modifiers={sheetScheme(chrome.scheme)}
    >
      <Column spacing={12} style={{ paddingBottom: 24 }} modifiers={fullWidth}>
        <Text textStyle={title}>{`Go to line, 1 to ${lineCount}`}</Text>
        <Row alignment="center" spacing={8} modifiers={fullWidth}>
          <TextInput
            placeholder="Line"
            placeholderTextColor={chrome.muted}
            keyboardType="number-pad"
            autoFocus
            onChangeText={setText}
            returnKeyType="go"
            onSubmitEditing={go}
            style={{
              paddingHorizontal: 8,
              paddingVertical: 6,
              borderRadius: 6,
              borderWidth: 1,
              borderColor: chrome.hairline,
              backgroundColor: chrome.background,
            }}
            textStyle={{ fontSize: 15, color: chrome.text }}
            modifiers={fill}
          />
          <Button label="Go" onPress={go} />
        </Row>
      </Column>
    </BottomSheet>
  );
}
