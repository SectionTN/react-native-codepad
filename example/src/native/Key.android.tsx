import { Button, Icon, OutlinedButton, Text } from '@expo/ui/jetpack-compose';
import type { KeyProps } from './types';

const PADDING = { start: 12, end: 12, top: 4, bottom: 4 };

export function Key({ label, icon, onPress, on, disabled }: KeyProps) {
  const Component = on ? Button : OutlinedButton;
  return (
    <Component onClick={onPress} enabled={!disabled} contentPadding={PADDING}>
      {icon ? (
        <Icon source={icon.android} size={20} contentDescription={label} />
      ) : (
        <Text>{label}</Text>
      )}
    </Component>
  );
}
