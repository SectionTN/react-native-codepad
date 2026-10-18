import {
  DropdownMenu,
  DropdownMenuItem,
  HorizontalDivider,
  Icon,
  IconButton,
  Text,
} from '@expo/ui/jetpack-compose';
import { useState } from 'react';
import { ICONS } from '../chrome/icons';
import type { OverflowMenuProps } from './types';

export function OverflowMenu({ icon, label, items, themes, theme, onTheme }: OverflowMenuProps) {
  const [open, setOpen] = useState(false);
  const run = (action: () => void) => {
    setOpen(false);
    action();
  };
  return (
    <DropdownMenu expanded={open} onDismissRequest={() => setOpen(false)}>
      <DropdownMenu.Trigger>
        <IconButton onClick={() => setOpen(true)}>
          <Icon source={icon.android} size={24} contentDescription={label} />
        </IconButton>
      </DropdownMenu.Trigger>
      <DropdownMenu.Items>
        {items.map((item) => (
          <DropdownMenuItem
            key={item.id}
            enabled={!item.disabled}
            onClick={() => run(item.onPress)}
          >
            <DropdownMenuItem.LeadingIcon>
              <Icon source={item.icon.android} size={20} />
            </DropdownMenuItem.LeadingIcon>
            <DropdownMenuItem.Text>
              <Text>{item.label}</Text>
            </DropdownMenuItem.Text>
          </DropdownMenuItem>
        ))}
        <HorizontalDivider />
        {themes.map((choice) => (
          <DropdownMenuItem key={choice.id} onClick={() => run(() => onTheme(choice.id))}>
            <DropdownMenuItem.LeadingIcon>
              <Icon source={ICONS.theme.android} size={20} />
            </DropdownMenuItem.LeadingIcon>
            <DropdownMenuItem.Text>
              <Text>{choice.label}</Text>
            </DropdownMenuItem.Text>
            {choice.id === theme ? (
              <DropdownMenuItem.TrailingIcon>
                <Icon source={ICONS.check.android} size={20} />
              </DropdownMenuItem.TrailingIcon>
            ) : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenu.Items>
    </DropdownMenu>
  );
}
