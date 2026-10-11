const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const ts = require('typescript');

const app = fs.readFileSync(path.resolve(__dirname, '../src/renderer/src/App.vue'), 'utf8').split('<script setup lang="ts">')[1].split('</script>')[0];
const tree = ts.createSourceFile('App.ts', app, ts.ScriptTarget.Latest, true);
function functions(names, context) {
  const source = tree.statements.filter(node => ts.isFunctionDeclaration(node) && names.includes(node.name?.text)).map(node => node.getText(tree)).join('\n');
  vm.runInContext(ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, context);
}
const ref = value => ({ value });
function fixture(source = 'qq') {
  const track = { id: `${source}:fixture`, source, duration: 60, audioUrl: '/audio', lyrics: '[00:10.00]Hello' };
  const requests = [], parsed = [], prepared = [];
  const context = vm.createContext({
    sessionRestored: false, volume: ref(65), playMode: ref('loop'), playModeOptions: [{ mode: 'loop' }],
    playbackQueue: ref([track]), favoriteTracks: ref([]), accountFavoriteTracks: ref([]), dailyRecommendationTracks: ref([]),
    historyTracks: ref([]), remoteTracks: ref([]), demoTracks: [], currentTrack: ref(track), syncFavoriteFlag() {},
    desktopIntegrationPreferences: ref({ rememberPlaybackPosition: true }), pendingSeekTime: undefined,
    currentTime: ref(0), lyricClockTime: 0, progress: ref(0), audioElement: ref({ volume: 0 }),
    trackAssetRequestId: 0, nextTick(fn) { fn(); }, prepareAudioSource(value) { prepared.push(value); },
    loadTrackLyrics(value) { parsed.push(value); }, normalizeLyricCredits: value => value,
    loadCatalogLyrics(id) { return new Promise((resolve, reject) => requests.push({ id, resolve, reject })); },
    loadCloudLyrics(id) { return new Promise((resolve, reject) => requests.push({ id, resolve, reject })); }
  });
  functions(['restorePersistedSession', 'hydrateRestoredTrackLyrics'], context);
  return { context, track, requests, parsed, prepared };
}
const reply = { lyrics: '[00:10.00]Hello', translation: '[00:10.00]Translation', format: 'LRC', source: 'qq' };
test('startup restores paused position and fetches bilingual lyrics without toggling or replaying', async () => {
  for (const source of ['qq', 'netease', 'cloud']) {
    const f = fixture(source);
    f.context.restorePersistedSession({ trackId: f.track.id, positionSeconds: 12, volume: 30, playMode: 'loop' });
    assert.equal(f.requests.length, 1, `${source}: startup must hydrate translations`);
    f.requests[0].resolve(reply); await new Promise(resolve => setImmediate(resolve));
    assert.equal(f.context.currentTrack.value.lyricsTranslation, reply.translation);
    assert.equal(f.parsed.at(-1).lyricsTranslation, reply.translation);
    assert.equal(f.context.currentTime.value, 12);
    assert.equal(f.context.pendingSeekTime, 12);
    assert.equal(f.context.volume.value, 30);
    assert.equal(f.prepared.length, 1, 'Lyrics completion must not reload audio');
  }
});
test('late startup lyrics cannot replace a newly selected track or a newer same-track request', async () => {
  for (const invalidation of ['track', 'request']) {
    const f = fixture();
    f.context.restorePersistedSession({ trackId: f.track.id, positionSeconds: 12 });
    assert.equal(f.requests.length, 1);
    if (invalidation === 'track') f.context.currentTrack.value = { ...f.track, id: 'qq:other' };
    else f.context.trackAssetRequestId++;
    f.requests[0].resolve(reply); await new Promise(resolve => setImmediate(resolve));
    assert.equal(f.context.currentTrack.value.lyricsTranslation, undefined);
    assert.equal(f.parsed.length, 1);
  }
});
test('offline startup retains stored lyrics and local files do not fetch platform lyrics', async () => {
  const f = fixture();
  f.context.restorePersistedSession({ trackId: f.track.id });
  assert.equal(f.requests.length, 1);
  f.requests[0].reject(new Error('offline')); await new Promise(resolve => setImmediate(resolve));
  assert.equal(f.context.currentTrack.value.lyrics, f.track.lyrics);
  const local = fixture('local');
  local.context.restorePersistedSession({ trackId: local.track.id });
  assert.equal(local.requests.length, 0);
});
test('native mini receives advancing media time between line changes, throttled independently of snapshots', () => {
  const sent = [], frames = []; let now = 1000;
  const audio = { paused: false, ended: false, currentTime: 1 };
  const context = vm.createContext({
    playbackFrameId: undefined, window: { requestAnimationFrame(fn) { frames.push(fn); return frames.length; }, cancelAnimationFrame() {},
      listenMusic: { updateMiniPlayerTime(time, progress) { sent.push([time, progress]); } } },
    nativeMiniMode: ref(true), lastMiniPlayerTimeSentAt: 0, performance: { now: () => now },
    audioElement: ref(audio), playbackClock: { read: value => value.currentTime }, lyricClockTime: 1,
    playbackDuration: ref(60), currentTime: ref(1), activeLyricIndex: ref(0), lyricLines: ref([{ time: 0, text: 'Hello' }]),
    findActiveLyricIndex: () => 0, updateLyricHighlightDom() {}, syncDesktopLyricsTime() {}
  });
  functions(['startPlaybackClock', 'stopPlaybackClock', 'syncMiniPlayerTime'], context);
  context.startPlaybackClock();
  for (let step = 0; step < 20; step++) { now += 20; audio.currentTime += 0.02; frames.shift()(); }
  assert.ok(sent.length >= 4 && sent.length <= 5, `Expected 100 ms clock updates, got ${sent.length}`);
  assert.ok(sent.at(-1)[0] > 1.3, 'Clock must advance even when the active line stays the same');
  assert.equal(context.currentTime.value, 1, 'Avoid full reactive rendering at animation-frame rate');
  assert.ok(Math.abs(sent.at(-1)[1] - sent.at(-1)[0] / 60 * 100) < 1e-6);
});
