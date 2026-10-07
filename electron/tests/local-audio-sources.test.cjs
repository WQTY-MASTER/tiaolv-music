const assert = require("node:assert/strict");
const { test } = require("node:test");
const { pathToFileURL } = require("node:url");
const path = require("node:path");
const moduleUrl = pathToFileURL(path.resolve(__dirname, "../src/renderer/src/services/localAudioSources.ts"));
const local = { id: "local:1", title: "Example Song", artist: "Alice / Bob", album: "Album", duration: 242 };
const candidate = { ...local, id: "qq:123", source: "qq" };

test("matches title, artist and duration, preferring the same album", async () => {
  const { matchLocalAudioSource } = await import(moduleUrl);
  assert.equal(matchLocalAudioSource(local, [{ ...candidate, album: "Compilation" }, candidate], "qq"), candidate);
  assert.equal(matchLocalAudioSource(local, [{ ...candidate, artist: "Bob" }], "qq").id, candidate.id);
});

test("rejects live/remix, covers, missing metadata, wrong providers and large duration differences", async () => {
  const { matchLocalAudioSource } = await import(moduleUrl);
  for (const change of [{ title: "Example Song (Live)" }, { title: "Example Song Remix" }, { artist: "Carol" }, { artist: "" }, { artist: "未知歌手" }, { duration: 0 }, { duration: 300 }, { source: "netease" }]) {
    assert.equal(matchLocalAudioSource(local, [{ ...candidate, ...change }], "qq"), null);
  }
  assert.equal(matchLocalAudioSource({ ...local, artist: "" }, [candidate], "qq"), null);
});

test("does not guess when equally good matches identify different versions", async () => {
  const { matchLocalAudioSource } = await import(moduleUrl);
  assert.equal(matchLocalAudioSource(local, [{ ...candidate, album: "First" }, { ...candidate, id: "qq:456", album: "Second" }], "qq"), null);
});
