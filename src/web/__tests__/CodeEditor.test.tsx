import { expect, jest, test } from '@jest/globals';
import { render } from '@testing-library/react-native';
import type { ViewOptions } from '../EditorView';

// A view that draws in the microtask after its construction, as the page pump draws before React commits.
const mockViews: MockView[] = [];
class MockView {
  options: Partial<ViewOptions> = {};
  language = '';
  constructor() {
    mockViews.push(this);
    queueMicrotask(() => this.options.onFirstDraw?.());
  }
  setOptions(next: Partial<ViewOptions>) {
    this.options = { ...this.options, ...next };
  }
  setLanguage(id: string) {
    this.language = id;
  }
  destroy() {}
}

jest.mock('../EditorView', () => ({ EditorView: MockView }));
jest.mock('../loader', () => ({ loadCore: () => Promise.resolve({}) }));

const { CodeEditor } = require('../CodeEditor') as typeof import('../CodeEditor');

test('fires onReady when the first draw comes before React commits the view', async () => {
  const onReady = jest.fn();
  await render(<CodeEditor language="python" onReady={onReady} />);
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(mockViews).toHaveLength(1);
  expect(mockViews[0]?.language).toBe('python');
  expect(onReady).toHaveBeenCalledTimes(1);
});
