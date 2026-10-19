const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { test } = require("node:test");
const { reactive } = require("vue");

const source = path.resolve(__dirname, "../src/renderer/src/services/playbackQueuePersistence.ts");
async function load() {
  assert.ok(fs.existsSync(source), "Playback queue persistence must be extracted into a service");
  return import(pathToFileURL(source).href);
}

function deferred() {
  let resolve;
  const promise = new Promise(yes => { resolve = yes; });
  return { promise, resolve };
}

const track = {
  id: "local:1", queueKey: "queue:1", title: "Song", artist: "Artist", album: "Album",
  duration: 242, source: "local", filePath: "fixture.mp3", url: "file:///fixture.mp3",
  coverUrl: "fixture-cover", lyrics: "Lyrics", lyricsPhonetic: "Phonetic",
  lyricsSource: "embedded", lyricsFormat: "lrc", metaSource: "embedded"
};

test("writes every enqueue in order using independent snapshots captured at enqueue", async () => {
  const { createPlaybackQueuePersistence } = await load();
  const firstStarted = deferred();
  const releaseFirst = deferred();
  const writes = [];
  let active = 0;
  let maxActive = 0;
  const persistence = createPlaybackQueuePersistence(async snapshot => {
    active++;
    maxActive = Math.max(maxActive, active);
    writes.push(snapshot);
    if (writes.length === 1) {
      firstStarted.resolve();
      await releaseFirst.promise;
    }
    active--;
    return { ok: true };
  }, () => assert.fail("Successful writes must not report an error"));
  const queue = [{ ...track }];
  const first = persistence.enqueue(queue);
  for (const key of Object.keys(queue[0])) queue[0][key] = key === "duration" ? 999 : `changed-${key}`;
  queue.push({ ...track, id: "local:2", queueKey: "queue:2" });
  const secondExpected = queue.map(item => ({ ...item }));
  const second = persistence.enqueue(queue);
  const third = persistence.enqueue([]);
  queue.reverse();
  queue[0].title = "Changed after enqueue";
  queue.length = 0;

  await firstStarted.promise;
  assert.deepEqual(writes, [[track]]);
  releaseFirst.resolve();
  assert.deepEqual(await Promise.all([first, second, third]), [undefined, undefined, undefined]);
  assert.deepEqual(writes, [[track], secondExpected, []]);
  assert.equal(maxActive, 1);
});

test("a rejected write reports once and does not block queued or subsequent saves", async () => {
  const { createPlaybackQueuePersistence } = await load();
  const firstStarted = deferred();
  const releaseFirst = deferred();
  const writes = [];
  let errors = 0;
  const persistence = createPlaybackQueuePersistence(async snapshot => {
    writes.push(snapshot);
    if (writes.length === 1) {
      firstStarted.resolve();
      await releaseFirst.promise;
      throw new Error("Fixture backend offline");
    }
    return { ok: true };
  }, () => { errors++; });
  const first = persistence.enqueue([track]);
  const second = persistence.enqueue([{ ...track, queueKey: "queue:2" }]);
  await firstStarted.promise;
  assert.equal(writes.length, 1);
  releaseFirst.resolve();
  assert.deepEqual(await Promise.all([first, second]), [undefined, undefined]);
  assert.equal(await persistence.enqueue([]), undefined);
  assert.deepEqual(writes.map(items => items.map(item => item.queueKey)), [["queue:1"], ["queue:2"], []]);
  assert.equal(errors, 1);
});

test("duplicate identities and reactive caller objects remain unchanged by persistence", async () => {
  const { createPlaybackQueuePersistence } = await load();
  const queue = reactive([{ ...track }, { ...track, queueKey: "queue:2" }]);
  queue.push(queue[0]);
  const originalItems = [...queue];
  const expected = queue.map(item => ({ ...item }));
  const writes = [];
  const persistence = createPlaybackQueuePersistence(async snapshot => { writes.push(snapshot); }, () => assert.fail("Unexpected write error"));

  await persistence.enqueue(queue);
  assert.deepEqual(writes, [expected]);
  assert.notEqual(writes[0], queue);
  for (let index = 0; index < queue.length; index++) {
    assert.equal(queue[index], originalItems[index]);
    assert.notEqual(writes[0][index], queue[index]);
  }
  assert.deepEqual(queue, expected);
  assert.deepEqual(writes[0].map(item => item.id), ["local:1", "local:1", "local:1"]);
  assert.deepEqual(writes[0].map(item => item.queueKey), ["queue:1", "queue:2", "queue:1"]);
});

test("a synchronous writer failure also resolves and leaves the chain usable", async () => {
  const { createPlaybackQueuePersistence } = await load();
  let attempts = 0;
  let errors = 0;
  const persistence = createPlaybackQueuePersistence(() => {
    if (++attempts === 1) throw new Error("Fixture synchronous failure");
    return Promise.resolve({ ok: true });
  }, () => { errors++; });

  assert.equal(await persistence.enqueue([track]), undefined);
  assert.equal(await persistence.enqueue([]), undefined);
  assert.equal(attempts, 2);
  assert.equal(errors, 1);
});
