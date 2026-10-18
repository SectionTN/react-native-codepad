import {
  AlertDialog,
  Host,
  OutlinedTextField,
  Text,
  TextButton,
  useNativeState,
} from '@expo/ui/jetpack-compose';
import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { parseLine } from './lineInput';
import type { GoToLineProps } from './types';

// A Material dialog with one outlined field and two text buttons.
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
            <Text>{`1 to ${lineCount}`}</Text>
          </AlertDialog.Text>
          <OutlinedTextField value={value} onValueChange={setText} autoFocus>
            <OutlinedTextField.Label>
              <Text>Line</Text>
            </OutlinedTextField.Label>
          </OutlinedTextField>
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
