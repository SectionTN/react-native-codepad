import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FIGURES } from '../../website/src/data/figures.ts';

test('every landing figure names the platform and the build, never a device', () => {
  assert.equal(FIGURES.length, 3);
  for (const figure of FIGURES) {
    assert.match(figure.value, /^\d[\d,]* (ms|lines)$/, figure.value);
    assert.ok(figure.label.length > 0, figure.value);
    assert.match(figure.where, /^on (iOS|Android), debug build$/, figure.value);
  }
});
