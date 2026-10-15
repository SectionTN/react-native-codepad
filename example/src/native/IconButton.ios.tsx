import { Button } from '@expo/ui/swift-ui';
import {
  buttonStyle,
  disabled as disabledModifier,
  foregroundStyle,
  imageScale,
  labelStyle,
} from '@expo/ui/swift-ui/modifiers';
import type { IconButtonProps } from './types';

export function IconButton({ icon, label, onPress, disabled, color }: IconButtonProps) {
  const modifiers = [buttonStyle('plain'), imageScale('large'), labelStyle('iconOnly')];
  if (color) modifiers.push(foregroundStyle(color));
  if (disabled) modifiers.push(disabledModifier(true));
  return <Button label={label} systemImage={icon.ios} onPress={onPress} modifiers={modifiers} />;
}
