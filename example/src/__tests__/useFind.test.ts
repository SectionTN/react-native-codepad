import { expect, jest, test } from '@jest/globals';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useFind } from '../chrome/useFind';

const editor = () => ({
  setSearch: jest.fn(async () => ({ count: 3 })),
  findNext: jest.fn(async () => ({ index: 0, total: 3 })),
  findPrevious: jest.fn(async () => ({ index: 2, total: 3 })),
  clearSearch: jest.fn(async () => {}),
  replaceCurrent: jest.fn(async () => true),
  replaceAll: jest.fn(async () => 3),
});

test('a query runs the search and selects the first match', async () => {
  const api = editor();
  const ref = { current: api as never };
  const { result } = await renderHook(() => useFind(ref, jest.fn()));
  await act(() => {
    result.current.setQuery('read');
  });
  await waitFor(() => expect(result.current.match).toEqual({ index: 1, count: 3 }));
  expect(api.setSearch).toHaveBeenCalledWith({
    text: 'read',
    regex: false,
    caseSensitive: false,
    wholeWord: false,
  });
});

test('an invalid regex reports and keeps the query', async () => {
  const api = editor();
  const ref = { current: api as never };
  api.setSearch.mockRejectedValueOnce(new Error('bad'));
  const onStatus = jest.fn();
  const { result } = await renderHook(() => useFind(ref, onStatus));
  await act(() => {
    result.current.toggle('regex');
  });
  await act(() => {
    result.current.setQuery('(');
  });
  await waitFor(() => expect(onStatus).toHaveBeenCalledWith('invalid regex'));
  expect(result.current.match).toEqual({ index: 0, count: 0 });
});

// Case-insensitive import replaced by IMPORT: all 4 matches stay, so the count stays 4.
const stillMatching = () => {
  const api = {
    ...editor(),
    setSearch: jest.fn(async () => ({ count: 4 })),
    findNext: jest.fn(async () => ({ index: 0, total: 4 })),
    replaceAll: jest.fn(async () => 4),
    getSelection: jest.fn(() => ({ anchor: 20, head: 26 })),
    setSelection: jest.fn(async () => {}),
  };
  return api;
};

test('replacing one match with text that still matches keeps the count and moves to the next', async () => {
  const api = stillMatching();
  const ref = { current: api as never };
  const { result } = await renderHook(() => useFind(ref, jest.fn()));
  await act(() => {
    result.current.setQuery('import');
  });
  await waitFor(() => expect(result.current.match).toEqual({ index: 1, count: 4 }));
  api.findNext.mockResolvedValueOnce({ index: 1, total: 4 });
  await act(() => result.current.replaceOne());
  expect(result.current.match).toEqual({ index: 2, count: 4 });
  expect(api.setSelection).toHaveBeenCalledWith({ anchor: 20, head: 20 });
});

test('replace all keeps the count of matches the new text still has', async () => {
  const api = stillMatching();
  const ref = { current: api as never };
  const { result } = await renderHook(() => useFind(ref, jest.fn()));
  await act(() => {
    result.current.setQuery('import');
  });
  await waitFor(() => expect(result.current.match).toEqual({ index: 1, count: 4 }));
  await act(() => result.current.replaceAll());
  expect(result.current.match).toEqual({ index: 0, count: 4 });
});

// A file switch remounts the editor under an open bar; Done has to clear the instance mounted last.
test('unmounting clears the painted matches on the editor mounted last', async () => {
  const first = editor();
  const last = editor();
  const ref = { current: first as never };
  const { unmount } = await renderHook(() => useFind(ref, jest.fn()));
  ref.current = last as never;
  await unmount();
  expect(last.clearSearch).toHaveBeenCalled();
});
