import { expect, jest, test } from '@jest/globals';
import { render } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { BottomBar } from '../chrome/BottomBar';

jest.mock('react-native-keyboard-controller', () => ({
  KeyboardStickyView: ({ children }: { children: ReactNode }) => children,
}));
jest.mock('../chrome/KeyRow', () => ({ KeyRow: jest.fn(() => null) }));
jest.mock('../chrome/StatusLine', () => ({ StatusLine: jest.fn(() => null) }));

const KeyRow = jest.requireMock<{ KeyRow: jest.Mock }>('../chrome/KeyRow').KeyRow;
const StatusLine = jest.requireMock<{ StatusLine: jest.Mock }>('../chrome/StatusLine').StatusLine;

const props = {
  scheme: 'dark' as const,
  editor: { current: null },
  selectMode: false,
  onToggleSelect() {},
  canUndo: false,
  canRedo: false,
  position: 'Ln 1, Col 1',
  language: 'JavaScript',
  timing: '',
  onPosition() {},
  bottomInset: 34,
  onHeight() {},
};

test('the keyboard brings the key row and hides the status line', async () => {
  KeyRow.mockClear();
  StatusLine.mockClear();
  await render(<BottomBar {...props} keyboardVisible readOnly={false} />);
  expect(KeyRow).toHaveBeenCalled();
  expect(StatusLine).not.toHaveBeenCalled();
});

test('read only with the keyboard up shows neither', async () => {
  KeyRow.mockClear();
  StatusLine.mockClear();
  await render(<BottomBar {...props} keyboardVisible readOnly />);
  expect(KeyRow).not.toHaveBeenCalled();
  expect(StatusLine).not.toHaveBeenCalled();
});

test('a closed keyboard shows the status line', async () => {
  KeyRow.mockClear();
  StatusLine.mockClear();
  await render(<BottomBar {...props} keyboardVisible={false} readOnly={false} />);
  expect(StatusLine).toHaveBeenCalled();
  expect(KeyRow).not.toHaveBeenCalled();
});
