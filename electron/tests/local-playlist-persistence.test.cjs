const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { test } = require('node:test');

const source = path.resolve(__dirname, '../src/renderer/src/services/localPlaylistPersistence.ts');
const load = async () => {
  assert.ok(fs.existsSync(source), 'Playlist snapshot persistence must be extracted into a service');
  return import(pathToFileURL(source).href);
};
function storage(initial = {}, reject = () => false) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: key => values.get(key) ?? null,
    setItem(key, value) {
      if (reject(key, value)) throw new DOMException('Fixture storage quota exhausted', 'QuotaExceededError');
      values.set(key, String(value));
    },
    removeItem: key => values.delete(key),
    values
  };
}
const playlist = { id: 'local-user-fixture', title: 'Existing', userManaged: true, coverPath: 'managed:old' };
const track = { id: 'local:1', title: 'Song', audioUrl: 'file:///fixture.mp3', lyrics: 'Lyrics', coverUrl: 'managed:track' };
const snapshotTrack = value => ({ id: value.id, title: value.title, url: value.audioUrl, lyrics: value.lyrics, coverUrl: value.coverUrl });

test('local snapshots keep the existing entry and track formats without mutating input', async () => {
  const api = await load();
  const target = storage();
  const playlists = [playlist];
  const tracks = { [playlist.id]: [track] };
  api.saveLocalPlaylistSnapshot({ playlists, tracks }, snapshotTrack, target);
  assert.deepEqual(JSON.parse(target.getItem(api.LOCAL_PLAYLIST_STORAGE_KEY)), [{ playlist, tracks: [snapshotTrack(track)] }]);
  assert.deepEqual(playlists, [playlist]);
  assert.deepEqual(tracks, { [playlist.id]: [track] });
});

for (const operation of ['create', 'add', 'rename']) {
  test(`rejected local ${operation} preserves the stored snapshot and caller state`, async () => {
    const api = await load();
    const old = JSON.stringify([{ playlist, tracks: [snapshotTrack(track)] }]);
    const target = storage({ [api.LOCAL_PLAYLIST_STORAGE_KEY]: old }, key => key === api.LOCAL_PLAYLIST_STORAGE_KEY);
    const visible = { playlists: [playlist], tracks: { [playlist.id]: [track] } };
    const before = structuredClone(visible);
    const next = operation === 'create'
      ? { playlists: [...visible.playlists, { ...playlist, id: 'new' }], tracks: { ...visible.tracks, new: [] } }
      : operation === 'rename'
        ? { ...visible, playlists: [{ ...playlist, title: 'Changed' }] }
        : { ...visible, tracks: { [playlist.id]: [...visible.tracks[playlist.id], { ...track, id: 'local:2' }] } };
    assert.throws(() => api.saveLocalPlaylistSnapshot(next, snapshotTrack, target), /quota exhausted/);
    assert.equal(target.getItem(api.LOCAL_PLAYLIST_STORAGE_KEY), old);
    assert.deepEqual(visible, before);
  });
}

test('second-key failure rolls back creation and restores absent keys', async () => {
  const api = await load();
  const target = storage({}, key => key === api.PLAYLIST_OVERVIEW_ORDER_STORAGE_KEY);
  assert.throws(() => api.saveLocalPlaylistSnapshot({ playlists: [playlist], tracks: {}, overviewOrder: [playlist.id] }, snapshotTrack, target), /quota exhausted/);
  assert.equal(target.getItem(api.LOCAL_PLAYLIST_STORAGE_KEY), null);
  assert.equal(target.getItem(api.PLAYLIST_OVERVIEW_ORDER_STORAGE_KEY), null);
});

test('cover transaction failure restores every earlier key exactly', async () => {
  const api = await load();
  const initial = { [api.LOCAL_PLAYLIST_STORAGE_KEY]: 'old playlists', [api.PLAYLIST_COVER_PATH_STORAGE_KEY]: 'old covers' };
  const target = storage(initial, key => key === api.PLAYLIST_COVER_PATH_STORAGE_KEY);
  assert.throws(() => api.saveLocalPlaylistSnapshot({ playlists: [{ ...playlist, coverPath: 'new' }], tracks: {}, coverPaths: { [playlist.id]: 'new' } }, snapshotTrack, target), /quota exhausted/);
  assert.deepEqual(Object.fromEntries(target.values), initial);
});

test('rollback failure reports reload or recovery with the original storage cause', async () => {
  const api = await load();
  let changed = false;
  const target = storage({ first: 'old' }, (key, value) => key === 'second' || (key === 'first' && changed && value === 'old'));
  const originalSet = target.setItem;
  target.setItem = (key, value) => { originalSet(key, value); changed = true; };
  assert.throws(() => api.savePlaylistStorageChanges([{ key: 'first', value: 'new' }, { key: 'second', value: 'next' }], target), error => {
    assert.match(error.message, /quota exhausted/);
    assert.match(error.message, /重新加载|恢复/);
    return true;
  });
});

for (const field of ['trackOrder', 'overviewOrder']) {
  test(`rejected ${field} keeps the previously saved order`, async () => {
    const api = await load();
    const key = field === 'trackOrder' ? api.PLAYLIST_TRACK_ORDER_STORAGE_KEY : api.PLAYLIST_OVERVIEW_ORDER_STORAGE_KEY;
    const old = field === 'trackOrder' ? { [playlist.id]: ['a', 'b'] } : ['favorites', playlist.id];
    const target = storage({ [key]: JSON.stringify(old) }, candidate => candidate === key);
    assert.throws(() => api.savePlaylistStorageChanges([{ key, value: field === 'trackOrder' ? { [playlist.id]: ['b', 'a'] } : [playlist.id, 'favorites'] }], target));
    assert.deepEqual(JSON.parse(target.getItem(key)), old);
  });
}

test('favorites names reload from metadata without moving songs or the stable ID', async () => {
  const api = await load();
  const target = storage({ 'backend-favorites-fixture': '["local:1"]' });
  assert.deepEqual(api.readFavoritesPlaylistMetadata(target), {});
  api.savePlaylistStorageChanges([{ key: api.FAVORITES_PLAYLIST_METADATA_STORAGE_KEY, value: { title: 'My favorites' } }], target);
  assert.deepEqual(api.readFavoritesPlaylistMetadata(target), { title: 'My favorites' });
  assert.equal(target.getItem('backend-favorites-fixture'), '["local:1"]');
  const failing = storage(Object.fromEntries(target.values), key => key === api.FAVORITES_PLAYLIST_METADATA_STORAGE_KEY);
  assert.throws(() => api.savePlaylistStorageChanges([{ key: api.FAVORITES_PLAYLIST_METADATA_STORAGE_KEY, value: { title: 'Rejected' } }], failing));
  assert.deepEqual(api.readFavoritesPlaylistMetadata(failing), { title: 'My favorites' });
});

test('malformed favorites metadata falls back to the existing default', async () => {
  const api = await load();
  for (const raw of ['invalid', 'null', '[]', '{"title":3}', '{"title":"   "}']) {
    assert.deepEqual(api.readFavoritesPlaylistMetadata(storage({ [api.FAVORITES_PLAYLIST_METADATA_STORAGE_KEY]: raw })), {});
  }
});

test('migration marker failure rolls back aggregate playlists for a safe retry', async () => {
  const api = await load();
  const aggregate = await import(pathToFileURL(path.resolve(__dirname, '../src/renderer/src/services/aggregatePlaylists.ts')).href);
  const target = storage({ [aggregate.AGGREGATE_PLAYLIST_STORAGE_KEY]: '[]' }, key => key === aggregate.LEGACY_AGGREGATE_PLAYLIST_MIGRATION_KEY);
  assert.throws(() => api.savePlaylistStorageChanges([
    { key: aggregate.AGGREGATE_PLAYLIST_STORAGE_KEY, value: [{ id: 'legacy' }] },
    { key: aggregate.LEGACY_AGGREGATE_PLAYLIST_MIGRATION_KEY, value: '1', raw: true }
  ], target));
  assert.equal(target.getItem(aggregate.AGGREGATE_PLAYLIST_STORAGE_KEY), '[]');
  assert.equal(target.getItem(aggregate.LEGACY_AGGREGATE_PLAYLIST_MIGRATION_KEY), null);
});

test('non-JSON snapshots are rejected before any key is written', async () => {
  const api = await load();
  const cycle = {};
  cycle.self = cycle;
  for (const value of [undefined, () => {}, Symbol('invalid'), 1n, cycle]) {
    const target = storage({ first: 'old' });
    assert.throws(() => api.savePlaylistStorageChanges([{ key: 'first', value: 'new' }, { key: 'invalid', value }], target));
    assert.deepEqual(Object.fromEntries(target.values), { first: 'old' });
  }
});

test('mini creation saves the first track in the only playlist snapshot write', async () => {
  const api = await load();
  const target = storage();
  const writes = [];
  const write = target.setItem;
  target.setItem = (key, value) => { writes.push({ key, value }); write(key, value); };
  api.saveLocalPlaylistSnapshot({ playlists: [{ ...playlist, count: 1 }], tracks: { [playlist.id]: [track] }, overviewOrder: [playlist.id] }, snapshotTrack, target);
  const localWrites = writes.filter(item => item.key === api.LOCAL_PLAYLIST_STORAGE_KEY);
  assert.equal(localWrites.length, 1);
  assert.deepEqual(JSON.parse(localWrites[0].value)[0].tracks, [snapshotTrack(track)]);
  assert.deepEqual(JSON.parse(target.getItem(api.PLAYLIST_OVERVIEW_ORDER_STORAGE_KEY)), [playlist.id]);
});

for (const operation of ['create', 'add', 'reorder']) {
  test(`rejected aggregate ${operation} preserves both the saved and original collection`, async () => {
    const aggregate = await import(pathToFileURL(path.resolve(__dirname, '../src/renderer/src/services/aggregatePlaylists.ts')).href);
    const songs = [1, 2].map(id => ({ id: String(id), title: `Song ${id}`, artist: 'Artist', album: 'Album', duration: 180, source: 'local', sourceLabel: 'Local' }));
    const existing = { ...aggregate.createAggregatePlaylist('Existing', [], 1), tracks: songs };
    const visible = [existing];
    const previous = structuredClone(visible);
    const old = JSON.stringify(visible);
    const target = storage({ [aggregate.AGGREGATE_PLAYLIST_STORAGE_KEY]: old }, key => key === aggregate.AGGREGATE_PLAYLIST_STORAGE_KEY);
    const candidate = operation === 'create' ? [...visible, aggregate.createAggregatePlaylist('New', visible, 2)]
      : operation === 'add' ? [aggregate.addTrackToAggregatePlaylist(existing, { ...songs[0], id: '3', title: 'New' }).playlist]
        : [aggregate.reorderAggregateTrackGroups(existing, aggregate.mergeAggregateTracks(songs).map(group => group.id).reverse())];
    assert.throws(() => aggregate.writeAggregatePlaylists(candidate, target), /quota exhausted/);
    assert.deepEqual(visible, previous);
    assert.equal(target.getItem(aggregate.AGGREGATE_PLAYLIST_STORAGE_KEY), old);
  });
}

test('native mini playlist requests preserve only valid bounded correlation IDs', async () => {
  const mini = await import(pathToFileURL(path.resolve(__dirname, '../src/shared/miniPlayer.ts')).href);
  for (const action of [{ type: 'queue-create', key: 'track', name: 'New' }, { type: 'queue-add', key: 'track', playlistId: 'target' }]) {
    assert.deepEqual(mini.parseMiniPlayerAction({ ...action, requestId: 'fixture-request' }), { ...action, requestId: 'fixture-request' });
    assert.deepEqual(mini.parseMiniPlayerAction(action), action, 'Existing uncorrelated actions stay compatible');
    for (const requestId of ['', 'x'.repeat(129), 4, {}]) assert.equal(mini.parseMiniPlayerAction({ ...action, requestId }), null);
  }
});
