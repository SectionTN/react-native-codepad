import { Button, Divider, Menu, Picker, Text } from '@expo/ui/swift-ui';
import {
  disabled as disabledModifier,
  labelStyle,
  pickerStyle,
  tag,
} from '@expo/ui/swift-ui/modifiers';
import type { OverflowMenuProps } from './types';

export function OverflowMenu({ icon, label, items, themes, theme, onTheme }: OverflowMenuProps) {
  return (
    <Menu label={label} systemImage={icon.ios} modifiers={[labelStyle('iconOnly')]}>
      {items.map((item) => (
        <Button
          key={item.id}
          label={item.label}
          systemImage={item.icon.ios}
          onPress={item.onPress}
          modifiers={item.disabled ? [disabledModifier(true)] : undefined}
        />
      ))}
      <Divider />
      <Picker
        label="Theme"
        systemImage="paintpalette"
        selection={theme}
        onSelectionChange={onTheme}
        modifiers={[pickerStyle('menu')]}
      >
        {themes.map((choice) => (
          <Text key={choice.id} modifiers={[tag(choice.id)]}>
            {choice.label}
          </Text>
        ))}
      </Picker>
    </Menu>
  );
}
