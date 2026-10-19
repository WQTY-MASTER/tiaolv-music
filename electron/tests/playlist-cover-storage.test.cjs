const assert = require('node:assert/strict');
const { test } = require('node:test');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const moduleUrl = pathToFileURL(path.resolve(__dirname, '../src/renderer/src/services/playlistCoverStorage.ts'));
const url = letter => `tiaolv-cover://cache/${letter.repeat(64)}.png`;
const storage = entries => ({ length: Object.keys(entries).length, key: i => Object.keys(entries)[i] ?? null, getItem: key => entries[key] ?? null });

test('collects persisted local, favorite, copied, aggregate, legacy and unknown JSON references plus active objects', async () => {
  const { collectPlaylistCoverReferences } = await import(moduleUrl);
  const entries = {
    'tiaolv-music-local-playlists': JSON.stringify([{ playlist: { id: 'local', title: 'Local', imageUrl: url('a') }, tracks: [{ id: 'track', coverUrl: url('b') }] }]),
    'tiaolv-music-playlist-cover-paths': JSON.stringify({ favorites: url('c'), copied: url('d') }),
    'tiaolv-music-favorites-playlist-metadata': JSON.stringify({ title: 'Favorite', coverUrl: url('e') }),
    'tiaolv-music-aggregate-playlists': JSON.stringify([{ id: 'agg', name: 'A', identifier: 'agg1', tracks: [{ id: 't', title: 'T', artist: 'A', source: 'qq', sourceLabel: 'QQ', coverUrl: url('f') }], createdAt: '2026', coverUrl: url('a') }]),
    'listen-music-aggregate-playlists': JSON.stringify([{ id: 'old', name: 'Old', identifier: 'agg2', tracks: [], coverUrl: url('b') }]),
    'tiaolv-music-aggregate-playlists-legacy-migrated-v1': '1',
    'unknown-view': JSON.stringify({ nested: [url('1').replace('tiaolv-cover:', 'TIAOLV-COVER:')] }),
    'plain-setting': 'dark'
  };
  const cycle = { coverUrl: url('2') }; cycle.self = cycle;
  assert.deepEqual(collectPlaylistCoverReferences(storage(entries), [cycle, { currentLibrary: [{ coverUrl: url('3') }] }], true), {
    complete: true, urls: ['a', 'b', 'c', 'd', 'e', 'f', '1', '2', '3'].map(url)
  });
});

test('refuses invalid known structures, malformed managed JSON, enumeration failure and incomplete legacy migration', async () => {
  const { collectPlaylistCoverReferences } = await import(moduleUrl);
  for (const entries of [
    { 'tiaolv-music-local-playlists': 'broken' },
    { 'tiaolv-music-local-playlists': '[{}]' },
    { 'tiaolv-music-playlist-cover-paths': '[]' },
    { 'tiaolv-music-playlist-cover-paths': '{"x":1}' },
    { 'tiaolv-music-favorites-playlist-metadata': '{"title":1}' },
    { 'tiaolv-music-aggregate-playlists': '[{"id":"a","tracks":null}]' },
    { 'listen-music-aggregate-playlists': '{}' },
    { unknown: `broken ${url('a')}` },
    { unknown: JSON.stringify({ coverUrl: 'tiaolv-cover://cache/../secret.png' }) }
  ]) assert.throws(() => collectPlaylistCoverReferences(storage(entries), []), /封面|引用|歌单|存储/);
  assert.throws(() => collectPlaylistCoverReferences(storage({}), [], true), /迁移/);
  assert.throws(() => collectPlaylistCoverReferences({ length: 1, key() { throw new Error('unreadable'); }, getItem() { return null; } }, []), /unreadable|存储/);
  assert.throws(() => collectPlaylistCoverReferences({ length: 1, key() { return null; }, getItem() { return null; } }, []), /存储/);
});

test('missing files remain protected by basename and malformed active references cannot authorize cleanup', async () => {
  const { collectPlaylistCoverReferences } = await import(moduleUrl);
  assert.deepEqual(collectPlaylistCoverReferences(storage({}), [url('a')]), { complete: true, urls: [url('a')] });
  for (const value of [`tiaolv-cover://cache/${'a'.repeat(64)}.png?x=1`, `tiaolv-cover://u@cache/${'a'.repeat(64)}.png`, `tiaolv-cover://cache/x/../${'a'.repeat(64)}.png`]) {
    assert.throws(() => collectPlaylistCoverReferences(storage({}), [value]), /封面|引用/);
  }
});

test('unknown valid JSON protects managed URIs even when JSON escapes their scheme', async () => {
  const { collectPlaylistCoverReferences } = await import(moduleUrl);
  const raw = JSON.stringify({ hidden: url('a') }).replace('tiaolv-cover', 'tiaolv\\u002dcover');
  assert.deepEqual(collectPlaylistCoverReferences(storage({ unknown: raw }), []), { complete: true, urls: [url('a')] });
});

test('unknown malformed JSON-looking values refuse cleanup even with only an escaped managed scheme', async () => {
  const { collectPlaylistCoverReferences } = await import(moduleUrl);
  const escaped = url('a').replace('tiaolv-cover', 'tiaolv\\u002dcover');
  for (const raw of [`{"coverUrl":"${escaped}"`, `["${escaped}"`, `"${escaped}`]) {
    assert.throws(() => collectPlaylistCoverReferences(storage({ unknown: raw, 'tiaolv-music-startup-home': 'local' }), []), /存储损坏/);
  }
});
