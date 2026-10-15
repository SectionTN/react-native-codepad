import { IconButton as ComposeIconButton, Icon } from '@expo/ui/jetpack-compose';
import type { IconButtonProps } from './types';

export function IconButton({ icon, label, onPress, disabled, color }: IconButtonProps) {
  return (
    <ComposeIconButton
      onClick={onPress}
      enabled={!disabled}
      colors={color ? { contentColor: color } : undefined}
    >
      <Icon source={icon.android} size={24} contentDescription={label} />
    </ComposeIconButton>
  );
}
