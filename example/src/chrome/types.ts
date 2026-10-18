import type { RefObject } from 'react';
import type { CodeEditorRef } from 'react-native-codepad';
import type { Settings } from '../settings';
import type { AppIcon } from './icons';
import type { Scheme } from './theme';

export type MenuChoice = { id: string; label: string };

export type FileGroup = { title: string; files: MenuChoice[] };

export type MenuItem = {
  id: string;
  label: string;
  icon: AppIcon;
  onPress: () => void;
  disabled?: boolean;
};

export type TopBarProps = {
  scheme: Scheme;
  /** The document background, the color the top edge fades from. */
  background: string;
  topInset: number;
  groups: FileGroup[];
  fileId: string;
  onFile: (id: string) => void;
  findOpen: boolean;
  onFind: () => void;
  items: MenuItem[];
  themes: MenuChoice[];
  themeId: string;
  onTheme: (id: string) => void;
};

export type FindBarProps = {
  scheme: Scheme;
  editor: RefObject<CodeEditorRef | null>;
  onStatus: (text: string) => void;
  onClose: () => void;
};

export type StatusLineProps = {
  scheme: Scheme;
  position: string;
  language: string;
  timing: string;
  onPosition: () => void;
};

export type KeyRowProps = {
  scheme: Scheme;
  editor: RefObject<CodeEditorRef | null>;
  selectMode: boolean;
  onToggleSelect: () => void;
  canUndo: boolean;
  canRedo: boolean;
};

export type SettingsSheetProps = {
  scheme: Scheme;
  open: boolean;
  onClose: () => void;
  settings: Settings;
  onChange: (patch: Partial<Settings>) => void;
};

export type GoToLineProps = {
  scheme: Scheme;
  open: boolean;
  lineCount: number;
  onClose: () => void;
  onGo: (line: number) => void;
};

export type NestedBarProps = {
  scheme: Scheme;
  title: string;
  onBack: () => void;
};
