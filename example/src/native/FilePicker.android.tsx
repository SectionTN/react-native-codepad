import {
  DropdownMenu,
  DropdownMenuItem,
  HorizontalDivider,
  Icon,
  Text,
  TextButton,
} from '@expo/ui/jetpack-compose';
import { Fragment, useState } from 'react';
import { ICONS } from '../chrome/icons';
import type { FilePickerProps } from './types';

export function FilePicker({ groups, fileId, color, onFile }: FilePickerProps) {
  const [open, setOpen] = useState(false);
  const current = groups.flatMap((g) => g.files).find((f) => f.id === fileId);
  return (
    <DropdownMenu expanded={open} onDismissRequest={() => setOpen(false)}>
      <DropdownMenu.Trigger>
        <TextButton onClick={() => setOpen(true)} colors={{ contentColor: color }}>
          <Text style={{ typography: 'titleMedium' }}>{current?.label ?? ''}</Text>
          <Icon source={ICONS.dropdown.android} size={20} />
        </TextButton>
      </DropdownMenu.Trigger>
      <DropdownMenu.Items>
        {groups.map((group, index) => (
          <Fragment key={group.title}>
            {index > 0 ? <HorizontalDivider /> : null}
            {group.files.map((file) => (
              <DropdownMenuItem
                key={file.id}
                onClick={() => {
                  setOpen(false);
                  onFile(file.id);
                }}
              >
                <DropdownMenuItem.Text>
                  <Text>{file.label}</Text>
                </DropdownMenuItem.Text>
                {file.id === fileId ? (
                  <DropdownMenuItem.TrailingIcon>
                    <Icon source={ICONS.check.android} size={20} />
                  </DropdownMenuItem.TrailingIcon>
                ) : null}
              </DropdownMenuItem>
            ))}
          </Fragment>
        ))}
      </DropdownMenu.Items>
    </DropdownMenu>
  );
}
