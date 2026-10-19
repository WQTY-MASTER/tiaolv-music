const assert = require('node:assert/strict');
const { test } = require('node:test');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
test('batch removal deletes complete selected groups without touching unselected songs or the original', async () => {
  const domain = await import(pathToFileURL(path.resolve(__dirname, '../src/renderer/src/services/aggregatePlaylists.ts')).href);
  assert.equal(typeof domain.removeAggregateTrackGroups, 'function');
  const tracks = [
    { id: 'a', title: 'First', artist: 'Artist', source: 'local' },
    { id: 'b', title: 'First', artist: 'Artist', source: 'qq' },
    { id: 'c', title: 'Second', artist: 'Artist', source: 'netease' },
    { id: 'd', title: 'Keep', artist: 'Artist', source: 'local' }
  ];
  const original = { id: 'agg1', tracks };
  const groups = domain.mergeAggregateTracks(tracks);
  const next = domain.removeAggregateTrackGroups(original, [groups[0].id, groups[1].id, groups[0].id]);
  assert.deepEqual(next.tracks.map(track => track.id), ['d']);
  assert.equal(original.tracks.length, 4);
});
