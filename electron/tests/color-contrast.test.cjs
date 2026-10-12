const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { test } = require('node:test');

test('selected text reaches 4.5:1 for defaults, presets and arbitrary valid theme colors', async () => {
  const { contrastRatio, readableAccentText } = await import(pathToFileURL(path.resolve(__dirname, '../src/renderer/src/services/colorContrast.ts')));
  for (const background of ['#16b88a', '#2dd4a7', '#8357f6', '#2868ed', '#e91e4d', '#f59b0b', '#344156', '#000000', '#ffffff', '#777777']) {
    assert.ok(contrastRatio(background, readableAccentText(background)) >= 4.5, background);
  }
  assert.equal(readableAccentText('#2dd4a7'), '#000000');
  assert.equal(readableAccentText('invalid'), '#000000');
  assert.equal(contrastRatio('#000000', '#ffffff'), 21);
});

test('dark mode cannot override selected text with the ordinary gray label color', () => {
  const source = require('node:fs').readFileSync(path.resolve(__dirname, '../src/renderer/src/components/FirstRunOnboarding.vue'), 'utf8');
  assert.match(source, /"--onboarding-accent-text":\s*readableAccentText\(activeAccent\.value\)/);
  assert.match(source, /\.dark \.onboarding-quality-options button\.active[\s\S]*?color:\s*var\(--onboarding-accent-text\)/);
});
