const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '../..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const identityEntry = /cloud-server|tiaolv-cloud-identity|\/identity\/(?:register|login|me|logout)/;

test('the removed independent identity service has no source or build artifacts', () => {
  assert.equal(fs.existsSync(path.join(root, 'cloud-server')), false,
    'The unused identity module and its generated jar must be removed');
});

test('current runtime and public instructions do not require the removed identity service', () => {
  for (const file of ['README.md', '.gitignore', 'package.json', 'electron/package.json',
    'scripts/dev.cjs', 'scripts/start-services.cjs', 'scripts/stage-runtime.cjs',
    'electron/scripts/before-pack.cjs']) {
    assert.doesNotMatch(read(file), identityEntry, `Stale identity entry in ${file}`);
  }
});

test('first-run onboarding remains local and has no activation gate', () => {
  const app = read('electron/src/renderer/src/App.vue');
  assert.match(app, /ref\(!hasCompletedOnboarding\(window\.localStorage\)\)/);
  assert.match(app, /<FirstRunOnboarding\s+v-if="showFirstRunOnboarding && !nativeMiniMode"/);
  for (const file of ['electron/src/renderer/src/App.vue',
    'electron/src/renderer/src/components/FirstRunOnboarding.vue',
    'electron/src/renderer/src/services/onboarding.ts',
    'electron/src/renderer/src/services/api.ts', 'electron/src/shared/backendRoutes.ts']) {
    assert.doesNotMatch(read(file), /\/identity\/(?:register|login)|invitation|activationRequired|inviteRequired|邀请码/,
      `App activation must not gate ${file}`);
  }
});
