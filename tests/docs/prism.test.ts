import assert from 'node:assert/strict';
import { test } from 'node:test';
import { githubDark } from '../../src/themes/githubDark.ts';
import { githubLight } from '../../src/themes/githubLight.ts';
import { PRISM_CAPTURES, prismThemeFrom } from '../../website/src/prism/fromEditorTheme.ts';

test('the Prism theme carries the editor theme', () => {
  const dark = prismThemeFrom(githubDark);
  assert.deepEqual(dark.plain, { color: '#e6edf3', backgroundColor: '#0d1117' });
  const keyword = dark.styles.find((s) => s.types.includes('keyword'));
  assert.equal(keyword?.style.color, '#ff7b72');
  const comment = dark.styles.find((s) => s.types.includes('comment'));
  assert.equal(comment?.style.fontStyle, 'italic');
});

test('every mapped capture exists in both bundled themes', () => {
  for (const capture of Object.keys(PRISM_CAPTURES)) {
    assert.ok(capture in githubDark.tokens, capture);
    assert.ok(capture in githubLight.tokens, capture);
  }
});
