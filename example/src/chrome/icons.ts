import type { ImageSourcePropType } from 'react-native';
import type { SFSymbol } from 'sf-symbols-typescript';

export type AppIcon = { ios: SFSymbol; android: ImageSourcePropType };

// SF Symbols on iOS, Material Symbols on Android. The require form needs no Babel plugin.
export const ICONS = {
  search: { ios: 'magnifyingglass', android: require('@expo/material-symbols/search.xml') },
  more: { ios: 'ellipsis.circle', android: require('@expo/material-symbols/more_vert.xml') },
  undo: { ios: 'arrow.uturn.backward', android: require('@expo/material-symbols/undo.xml') },
  redo: { ios: 'arrow.uturn.forward', android: require('@expo/material-symbols/redo.xml') },
  selectAll: {
    ios: 'selection.pin.in.out',
    android: require('@expo/material-symbols/select_all.xml'),
  },
  goToLine: { ios: 'number', android: require('@expo/material-symbols/tag.xml') },
  timer: { ios: 'stopwatch', android: require('@expo/material-symbols/timer.xml') },
  nested: { ios: 'rectangle.stack', android: require('@expo/material-symbols/view_agenda.xml') },
  settings: { ios: 'gearshape', android: require('@expo/material-symbols/settings.xml') },
  theme: { ios: 'paintpalette', android: require('@expo/material-symbols/palette.xml') },
  check: { ios: 'checkmark', android: require('@expo/material-symbols/check.xml') },
  dropdown: { ios: 'chevron.down', android: require('@expo/material-symbols/arrow_drop_down.xml') },
  previous: { ios: 'chevron.up', android: require('@expo/material-symbols/keyboard_arrow_up.xml') },
  next: { ios: 'chevron.down', android: require('@expo/material-symbols/keyboard_arrow_down.xml') },
  back: { ios: 'chevron.left', android: require('@expo/material-symbols/arrow_back.xml') },
  left: { ios: 'arrow.left', android: require('@expo/material-symbols/arrow_back.xml') },
  right: { ios: 'arrow.right', android: require('@expo/material-symbols/arrow_forward.xml') },
  up: { ios: 'arrow.up', android: require('@expo/material-symbols/arrow_upward.xml') },
  down: { ios: 'arrow.down', android: require('@expo/material-symbols/arrow_downward.xml') },
  tab: { ios: 'arrow.right.to.line', android: require('@expo/material-symbols/keyboard_tab.xml') },
  untab: {
    ios: 'arrow.left.to.line',
    android: require('@expo/material-symbols/format_indent_decrease.xml'),
  },
  enter: { ios: 'return', android: require('@expo/material-symbols/keyboard_return.xml') },
  backspace: { ios: 'delete.left', android: require('@expo/material-symbols/backspace.xml') },
  hideKeyboard: {
    ios: 'keyboard.chevron.compact.down',
    android: require('@expo/material-symbols/keyboard_hide.xml'),
  },
} satisfies Record<string, AppIcon>;
