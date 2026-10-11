const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { spawnSync } = require('node:child_process');
const script = path.resolve(__dirname, '../../scripts/verify.cjs');

test('release runner discovers isolated Node tests once, preserving transform flags', () => {
  assert.ok(fs.existsSync(script), 'release verification runner must exist');
  const { discoverFrontendTests } = require(script);
  const commands = discoverFrontendTests({ scripts: {
    test: 'node --test tests/a.test.cjs && node tests/b.test.cjs',
    'test:extra': 'node --experimental-transform-types --test tests/a.test.cjs && node tests/c.test.cjs',
    'test:e2e': 'echo "No e2e tests yet"', build: 'node ignored.cjs'
  } });
  assert.deepEqual(commands.map(item => item.file), ['tests/a.test.cjs', 'tests/b.test.cjs', 'tests/c.test.cjs']);
  assert.ok(commands[0].flags.includes('--experimental-transform-types'));
  assert.ok(commands[0].flags.includes('--test'));
});

test('release runner rejects shell placeholders and missing test paths', () => {
  assert.ok(fs.existsSync(script), 'release verification runner must exist');
  const { discoverFrontendTests, validateTestFiles } = require(script);
  assert.throws(() => discoverFrontendTests({ scripts: { test: 'echo success' } }), /Unsupported/);
  assert.throws(() => validateTestFiles([{ file: 'tests/missing.test.cjs' }], __dirname), /Missing/);
});

test('browser acceptance has a bounded real smoke suite and refuses remote preview URLs', () => {
  assert.ok(fs.existsSync(script), 'release verification runner must exist');
  const { E2E_FILES, previewUrl } = require(script);
  assert.deepEqual(E2E_FILES, ['qq-playlist-recommendations.smoke.cjs', 'lyrics-qrc.smoke.cjs', 'lyrics-layout.smoke.cjs', 'qq-recent-report.smoke.cjs']);
  assert.equal(previewUrl('http://127.0.0.1:5174/').port, '5174');
  assert.throws(() => previewUrl('https://example.com/'), /loopback/);
});

test('browser acceptance exits unsuccessfully when Playwright is absent', () => {
  assert.ok(fs.existsSync(script), 'release verification runner must exist');
  const result = spawnSync(process.execPath, [script, 'e2e'], {
    env: { ...process.env, PLAYWRIGHT_MODULE: path.join(__dirname, 'missing-playwright-module.cjs') }, encoding: 'utf8'
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Playwright is required/);
});
