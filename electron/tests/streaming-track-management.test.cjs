const assert = require('node:assert/strict');
const { test } = require('node:test');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const modulePromise = import(pathToFileURL(path.resolve(__dirname, '../src/renderer/src/services/streamingTrackManagement.ts')).href);
test('batch execution deduplicates, continues after errors and keeps exact failed IDs', async () => {
  const { runTrackBatch } = await modulePromise;
  const calls = [];
  const result = await runTrackBatch(['a','b','a','c'], async id => { calls.push(id); if(id === 'b') throw Error('失败'); });
  assert.deepEqual(calls, ['a','b','c']);
  assert.deepEqual(result.succeeded, ['a','c']);
  assert.deepEqual(result.failed, ['b']);
});
test('account change prevents remaining writes', async () => {
  const { runTrackBatch } = await modulePromise;
  let current = true;
  const result = await runTrackBatch(['a','b','c'], async () => { current = false; }, () => current);
  assert.deepEqual(result.succeeded, ['a']);
  assert.deepEqual(result.failed, ['b','c']);
});
test('only visible selections are submitted after searching', async () => {
  const { selectedVisibleIds } = await modulePromise;
  assert.deepEqual(selectedVisibleIds(['a','b'], [{id:'b'},{id:'c'}]), ['b']);
});
test('long press requires time and cancels when moving early', async () => {
  const { canActivateTrackHold } = await modulePromise;
  assert.equal(canActivateTrackHold(449, 0, 0), false);
  assert.equal(canActivateTrackHold(450, 0, 0), true);
  assert.equal(canActivateTrackHold(460, 9, 0), false);
});
