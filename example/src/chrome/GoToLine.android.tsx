import {
  AlertDialog,
  Column,
  Host,
  OutlinedTextField,
  Text,
  TextButton,
  useNativeState,
} from '@expo/ui/jetpack-compose';
import { fillMaxWidth } from '@expo/ui/jetpack-compose/modifiers';
import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { parseLine } from './lineInput';
import type { GoToLineProps } from './types';

// A Material dialog with one outlined field and two text buttons. The dialog composes only its
// slots, so the field lives in the text slot under the range.
export function GoToLine({ scheme, open, lineCount, onClose, onGo }: GoToLineProps) {
  const [text, setText] = useState('');
  const value = useNativeState('');
  const go = () => {
    const line = parseLine(text, lineCount);
    onClose();
    if (line !== null) onGo(line);
  };
  return (
    <Host style={styles.anchor} colorScheme={scheme}>
      {open ? (
        <AlertDialog onDismissRequest={onClose}>
          <AlertDialog.Title>
            <Text>Go to line</Text>
          </AlertDialog.Title>
          <AlertDialog.Text>
            <Column verticalArrangement={{ spacedBy: 16 }}>
              <Text>{`1 to ${lineCount}`}</Text>
              <OutlinedTextField
                value={value}
                onValueChange={setText}
                autoFocus
                modifiers={[fillMaxWidth()]}
              >
                <OutlinedTextField.Label>
                  <Text>Line</Text>
                </OutlinedTextField.Label>
              </OutlinedTextField>
            </Column>
          </AlertDialog.Text>
          <AlertDialog.ConfirmButton>
            <TextButton onClick={go}>
              <Text>Go</Text>
            </TextButton>
          </AlertDialog.ConfirmButton>
          <AlertDialog.DismissButton>
            <TextButton onClick={onClose}>
              <Text>Cancel</Text>
            </TextButton>
          </AlertDialog.DismissButton>
        </AlertDialog>
      ) : null}
    </Host>
  );
}

const styles = StyleSheet.create({
  anchor: { position: 'absolute', width: 0, height: 0 },
});
