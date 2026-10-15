import type { AppIcon } from '../icons';

export type IconButtonProps = {
  icon: AppIcon;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  color?: string;
};

export type KeyProps = {
  label: string;
  icon?: AppIcon;
  onPress: () => void;
  on?: boolean;
  disabled?: boolean;
};

export type MenuItem = {
  id: string;
  label: string;
  icon: AppIcon;
  onPress: () => void;
  disabled?: boolean;
};

export type MenuChoice = { id: string; label: string };

export type OverflowMenuProps = {
  icon: AppIcon;
  label: string;
  items: MenuItem[];
  themes: MenuChoice[];
  theme: string;
  onTheme: (id: string) => void;
};

export type FileGroup = { title: string; files: MenuChoice[] };

export type FilePickerProps = {
  groups: FileGroup[];
  fileId: string;
  color: string;
  onFile: (id: string) => void;
};
