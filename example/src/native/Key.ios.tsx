import { Button } from '@expo/ui/swift-ui';
import {
  buttonStyle,
  controlSize,
  disabled as disabledModifier,
  labelStyle,
} from '@expo/ui/swift-ui/modifiers';
import type { KeyProps } from './types';

export function Key({ label, icon, onPress, on, disabled }: KeyProps) {
  const modifiers = [buttonStyle(on ? 'borderedProminent' : 'bordered'), controlSize('small')];
  if (icon) modifiers.push(labelStyle('iconOnly'));
  if (disabled) modifiers.push(disabledModifier(true));
  return <Button label={label} systemImage={icon?.ios} onPress={onPress} modifiers={modifiers} />;
}
