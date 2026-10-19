const assert = require('node:assert/strict');
const { test } = require('node:test');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const fs = require('node:fs');
const filename = path.resolve(__dirname, '../src/renderer/src/services/accountPlaylistActions.ts');
async function actions() {
  assert.ok(fs.existsSync(filename), 'Account playlist routing must exist');
  return import(pathToFileURL(filename).href);
}
test('online track targets follow their own provider, local tracks keep local targets', async () => {
  const { trackPlaylistProvider } = await actions();
  assert.equal(trackPlaylistProvider({ id: 'qq:mid1', source: 'qq' }), 'qq');
  assert.equal(trackPlaylistProvider({ id: 'netease:123', source: 'netease' }), 'netease');
  assert.equal(trackPlaylistProvider({ id: 'qq:mid1' }), 'qq');
  assert.equal(trackPlaylistProvider({ id: 'local:1', source: 'local' }), null);
});
test('only editable ordinary playlists of the target provider can receive tracks', async () => {
  const { canEditAccountPlaylist } = await actions();
  const ordinary = { source: 'qq', createdByAccount: true, deletable: true, favorite: false };
  assert.equal(canEditAccountPlaylist(ordinary, 'qq'), true);
  assert.equal(canEditAccountPlaylist(ordinary, 'netease'), false);
  assert.equal(canEditAccountPlaylist({ ...ordinary, favorite: true }, 'qq'), false);
  assert.equal(canEditAccountPlaylist({ ...ordinary, createdByAccount: false }, 'qq'), false);
  assert.equal(canEditAccountPlaylist({ ...ordinary, deletable: false }, 'qq'), false);
});
test('late responses are rejected after changing account or re-login of the same account', async () => {
  const { isPlaylistAccountCurrent } = await actions();
  const context = { provider: 'qq', userId: 'A', revision: 1 };
  assert.equal(isPlaylistAccountCurrent(context, [{ provider: 'qq', userId: 'A' }], 1), true);
  assert.equal(isPlaylistAccountCurrent(context, [{ provider: 'qq', userId: 'B' }], 1), false);
  assert.equal(isPlaylistAccountCurrent(context, [{ provider: 'qq', userId: 'A' }], 2), false);
  assert.equal(isPlaylistAccountCurrent(context, [], 1), false);
});

for (const provider of ['qq', 'netease']) {
  for (const count of [101, 205]) test(`${provider} additions use deduplicated chunks of at most 100 with progress (${count})`, async () => {
    const { runAccountPlaylistChunks } = await actions();
    assert.equal(typeof runAccountPlaylistChunks, 'function', 'A guarded chunk executor must exist');
    const ids = Array.from({ length: count }, (_, i) => `${provider}:${i + 1}`);
    const requests = [], progress = [];
    const result = await runAccountPlaylistChunks([...ids, ids[0]], async chunk => { requests.push(chunk); }, {
      onProgress: value => progress.push([value.processed, value.total])
    });
    assert.deepEqual(requests.map(chunk => chunk.length), count === 101 ? [100, 1] : [100, 100, 5]);
    assert.deepEqual(result.succeeded, ids);
    assert.deepEqual(result.failed, []);
    assert.deepEqual(progress.at(-1), [count, count]);
  });
  test(`${provider} partial additions retry only failed IDs and preserve the actual error`, async () => {
    const { runAccountPlaylistChunks } = await actions();
    assert.equal(typeof runAccountPlaylistChunks, 'function');
    const ids = Array.from({ length: 205 }, (_, i) => `${provider}:${i + 1}`);
    const requests = [];
    const result = await runAccountPlaylistChunks(ids, async chunk => {
      requests.push(chunk); if (requests.length === 2) throw new Error('Platform code 80105');
    });
    assert.deepEqual(result.succeeded, [...ids.slice(0, 100), ...ids.slice(200)]);
    assert.deepEqual(result.failed, ids.slice(100, 200));
    assert.match(result.message, /80105/);
    const retry = [];
    await runAccountPlaylistChunks(result.failed, async chunk => { retry.push(...chunk); });
    assert.deepEqual(retry, result.failed);
    assert.equal(requests.length, 3, 'Ambiguous writes are never retried automatically');
  });
  for (const change of ['account', 'page']) test(`${provider} ${change} change stops new chunks and late progress`, async () => {
    const { runAccountPlaylistChunks } = await actions();
    assert.equal(typeof runAccountPlaylistChunks, 'function');
    let current = true;
    const requests = [], progress = [];
    const ids = Array.from({ length: 205 }, (_, i) => `${provider}:${i + 1}`);
    const result = await runAccountPlaylistChunks(ids, async chunk => { requests.push(chunk); current = false; }, {
      isCurrent: () => current, onProgress: value => progress.push(value.processed)
    });
    assert.equal(requests.length, 1);
    assert.deepEqual(result.failed, ids.slice(100));
    assert.deepEqual(progress, [0], 'No late progress is published into a new scope');
  });
}

test('explicit verified removal results retain unconfirmed IDs and safe reasons', async () => {
  const { runAccountPlaylistChunks } = await actions();
  assert.equal(typeof runAccountPlaylistChunks, 'function');
  const result = await runAccountPlaylistChunks(['a', 'b', 'c'], async () => ({
    succeeded: ['a', 'unknown'], failed: ['b'], errors: { b: 'Still present' }
  }));
  assert.deepEqual(result.succeeded, ['a']);
  assert.deepEqual(result.failed, ['b', 'c']);
  assert.equal(result.errors.b, 'Still present');
});
