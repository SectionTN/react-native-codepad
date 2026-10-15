import { Picker, Section, Text } from '@expo/ui/swift-ui';
import { fixedSize, foregroundStyle, pickerStyle, tag } from '@expo/ui/swift-ui/modifiers';
import type { FilePickerProps } from './types';

// A menu style picker shows the open file as its label and the groups as sections.
export function FilePicker({ groups, fileId, color, onFile }: FilePickerProps) {
  return (
    <Picker
      selection={fileId}
      onSelectionChange={onFile}
      modifiers={[pickerStyle('menu'), foregroundStyle(color), fixedSize({ horizontal: true })]}
    >
      {groups.map((group) => (
        <Section key={group.title} title={group.title}>
          {group.files.map((file) => (
            <Text key={file.id} modifiers={[tag(file.id)]}>
              {file.label}
            </Text>
          ))}
        </Section>
      ))}
    </Picker>
  );
}
