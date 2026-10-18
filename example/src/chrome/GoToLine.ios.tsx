import { Alert, Button, Host, Spacer, Text, TextField } from '@expo/ui/swift-ui';
import { frame, keyboardType } from '@expo/ui/swift-ui/modifiers';
import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { parseLine } from './lineInput';
import type { GoToLineProps } from './types';

// A system alert with one field; Go is a no-op until the number is inside the document.
// The alert presents from its trigger view, so an unseen zero-size one stands in for a button.
export function GoToLine({ scheme, open, lineCount, onClose, onGo }: GoToLineProps) {
  const [text, setText] = useState('');
  const go = () => {
    const line = parseLine(text, lineCount);
    onClose();
    if (line !== null) onGo(line);
  };
  return (
    <Host style={styles.anchor} colorScheme={scheme}>
      <Alert
        title="Go to line"
        isPresented={open}
        onIsPresentedChange={(presented) => {
          if (!presented) onClose();
        }}
      >
        <Alert.Trigger>
          <Spacer modifiers={[frame({ width: 0, height: 0 })]} />
        </Alert.Trigger>
        <Alert.Message>
          <Text>{`1 to ${lineCount}`}</Text>
        </Alert.Message>
        <Alert.Actions>
          <TextField
            placeholder="Line"
            onTextChange={setText}
            modifiers={[keyboardType('numeric')]}
          />
          {/* biome-ignore lint/a11y/useValidAriaRole: a SwiftUI button role, not an ARIA role */}
          <Button label="Cancel" role="cancel" onPress={onClose} />
          <Button label="Go" onPress={go} />
        </Alert.Actions>
      </Alert>
    </Host>
  );
}

const styles = StyleSheet.create({
  anchor: { position: 'absolute', width: 0, height: 0 },
});
