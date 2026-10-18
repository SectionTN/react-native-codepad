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

test('unmounting clears the painted matches', async () => {
  const api = editor();
  const ref = { current: api as never };
  const { unmount } = await renderHook(() => useFind(ref, jest.fn()));
  await unmount();
  expect(api.clearSearch).toHaveBeenCalled();
});
