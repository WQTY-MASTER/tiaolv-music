const assert = require('node:assert/strict');
const { test } = require('node:test');
const addTracks = require('../../music-api/api-enhanced/module/playlist_tracks.js');

test('the shipped ordinary playlist gateway uses add, pid and trackIds, not the type-3 endpoint', async () => {
  const calls = [];
  const result = await addTracks({ op: 'add', pid: '900', tracks: '123,456', cookie: 'MUSIC_U=fixture' }, async (url, data, options) => {
    calls.push({ url, data, cookie: options.cookie });
    return { status: 200, body: { code: 200 } };
  });
  assert.deepEqual(calls, [{
    url: '/api/playlist/manipulate/tracks',
    data: { op: 'add', pid: '900', trackIds: '["123","456"]', imme: 'true' },
    cookie: 'MUSIC_U=fixture'
  }]);
  assert.equal(result.body.body.code, 200);
});

test('the gateway returns upstream refusal without a fake success or a second write', async () => {
  let calls = 0;
  const result = await addTracks({ op: 'add', pid: '900', tracks: '123' }, async () => {
    calls += 1;
    throw { body: { code: 502 } };
  });
  assert.equal(result.body.code, 502);
  assert.equal(calls, 1);
});

test('ordinary song removal uses del with pid and JSON song IDs', async () => {
  let captured;
  await addTracks({ op: 'del', pid: '900', tracks: '123,456' }, async (url, data) => {
    captured = { url, data };
    return { status: 200, body: { code: 200 } };
  });
  assert.deepEqual(captured, { url: '/api/playlist/manipulate/tracks',
    data: { op: 'del', pid: '900', trackIds: '["123","456"]', imme: 'true' } });
});
