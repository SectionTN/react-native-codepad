import { BottomSheet, Column, Picker, Row, Slider, Spacer, Switch, Text } from '@expo/ui';
import type { Suggestions } from 'react-native-codepad';
import type { Chrome } from '../chrome';
import { fullWidth, sheetScheme } from '../native/layout';
import type { Settings } from '../settings';

type Props = {
  chrome: Chrome;
  open: boolean;
  onClose: () => void;
  settings: Settings;
  onChange: (patch: Partial<Settings>) => void;
};

const SWITCHES: [keyof Settings, string][] = [
  ['softWrap', 'Soft wrap'],
  ['lineNumbers', 'Line numbers'],
  ['activeLine', 'Active line'],
  ['matchBrackets', 'Match brackets'],
  ['autoClose', 'Auto close brackets'],
  ['highlight', 'Syntax highlighting'],
  ['readOnly', 'Read only'],
];

export function SettingsSheet({ chrome, open, onClose, settings, onChange }: Props) {
  const title = { fontSize: 17, fontWeight: '600' as const, color: chrome.text };
  const label = { fontSize: 15, color: chrome.text };
  const value = { fontSize: 15, color: chrome.muted };
  return (
    <BottomSheet
      isPresented={open}
      onDismiss={onClose}
      snapPoints={['half', 'full']}
      containerColor={chrome.surface}
      contentColor={chrome.text}
      modifiers={sheetScheme(chrome.scheme)}
    >
      <Column spacing={14} style={{ paddingBottom: 24 }} modifiers={fullWidth}>
        <Text textStyle={title}>Settings</Text>
        {SWITCHES.map(([key, name]) => (
          <Switch
            key={key}
            label={name}
            value={settings[key] as boolean}
            onValueChange={(on) => onChange({ [key]: on })}
          />
        ))}
        <Row alignment="center" spacing={8} modifiers={fullWidth}>
          <Text textStyle={label}>Suggestions</Text>
          <Spacer flexible />
          <Picker
            selectedValue={settings.suggestions}
            onValueChange={(next) => onChange({ suggestions: next as Suggestions })}
            appearance="menu"
          >
            <Picker.Item label="Off" value="off" />
            <Picker.Item label="Force off" value="forceOff" />
            <Picker.Item label="On" value="on" />
          </Picker>
        </Row>
        <Row alignment="center" spacing={8} modifiers={fullWidth}>
          <Text textStyle={label}>Font size</Text>
          <Spacer flexible />
          <Text textStyle={value}>{`${settings.fontSize}`}</Text>
        </Row>
        <Slider
          value={settings.fontSize}
          min={12}
          max={22}
          step={1}
          onValueChange={(size) => onChange({ fontSize: Math.round(size) })}
        />
      </Column>
    </BottomSheet>
  );
}
