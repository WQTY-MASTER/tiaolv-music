const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const moduleUrl = pathToFileURL(path.resolve(__dirname, "../src/main/backgroundImageCache.ts"));

test("large background imports preserve bytes, deduplicate and clear only managed copies", async () => {
  const { BackgroundImageCache } = await import(moduleUrl);
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "background-cache-test-"));
  const original = path.join(root, "original #1.png");
  const directory = path.join(root, "cache");
  // A PNG signature and trailing payload exercise the import path without a 20 MB cutoff.
  const bytes = Buffer.alloc(21 * 1024 * 1024, 17);
  Buffer.from("89504e470d0a1a0a", "hex").copy(bytes);
  await fs.writeFile(original, bytes);
  const cache = new BackgroundImageCache(directory);
  const url = await cache.importImage(original);
  assert.match(url, /^tiaolv-background:\/\/cache\/[a-f0-9]{64}\.png$/);
  assert.equal(await cache.importImage(original), url);
  assert.deepEqual(await fs.readFile(await cache.resolve(url)), bytes);
  assert.deepEqual(await cache.statistics(), { directory, bytes: bytes.length, entries: 1 });
  await fs.writeFile(path.join(directory, "keep.txt"), "not a background");
  await cache.clear();
  assert.equal((await cache.statistics()).entries, 0);
  assert.deepEqual(await fs.readFile(original), bytes);
  assert.equal(await fs.readFile(path.join(directory, "keep.txt"), "utf8"), "not a background");
  await assert.rejects(cache.resolve(url));
});

test("cache URLs cannot escape the managed directory and invalid image types are rejected", async () => {
  const { BackgroundImageCache } = await import(moduleUrl);
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "background-cache-security-"));
  const cache = new BackgroundImageCache(path.join(root, "cache"));
  for (const url of ["file:///secret.png", "tiaolv-background://other/a.png", "tiaolv-background://cache/../secret.png", "tiaolv-background://cache/%2fsecret.png"]) {
    await assert.rejects(cache.resolve(url));
  }
  const fakeImage = path.join(root, "fake.png");
  await fs.writeFile(fakeImage, "not an image");
  await assert.rejects(cache.importImage(fakeImage));
  assert.equal((await cache.statistics()).entries, 0);
});

test("playlist covers use an independent original-byte store and survive moving the source", async () => {
  const { BackgroundImageCache } = await import(moduleUrl);
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "playlist-cover-cache-"));
  const original = path.join(root, "original.png");
  const bytes = Buffer.alloc(21 * 1024 * 1024, 23);
  Buffer.from("89504e470d0a1a0a", "hex").copy(bytes);
  await fs.writeFile(original, bytes);
  const covers = new BackgroundImageCache(path.join(root, "covers"), "tiaolv-cover");
  const backgrounds = new BackgroundImageCache(path.join(root, "backgrounds"));
  const url = await covers.importImage(original);
  assert.match(url, /^tiaolv-cover:\/\/cache\/[a-f0-9]{64}\.png$/);
  await fs.rename(original, path.join(root, "moved.png"));
  await backgrounds.clear();
  assert.deepEqual(await fs.readFile(await covers.resolve(url)), bytes, "No resize, recompression or background-cache deletion");
  await assert.rejects(covers.resolve(url.replace("tiaolv-cover:", "tiaolv-background:")));
});

const references = urls => ({ complete: true, urls });
test("original cover pruning protects references, recent/future imports and hard links, preserving exact bytes", async t => {
  const { BackgroundImageCache } = await import(moduleUrl);
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "cover-prune-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const directory = path.join(root, "covers");
  const cache = new BackgroundImageCache(directory, "tiaolv-cover");
  assert.equal(typeof cache.originalStatistics, "function", "Independent original statistics are required");
  await fs.mkdir(directory);
  const bytes = Buffer.from("89504e470d0a1a0a12345678", "hex");
  const names = ["a", "b", "c", "d", "e"].map(letter => `${letter.repeat(64)}.png`);
  const old = new Date(Date.now() - 48 * 3600000);
  for (const name of names) { await fs.writeFile(path.join(directory, name), bytes); await fs.utimes(path.join(directory, name), old, old); }
  await fs.utimes(path.join(directory, names[2]), new Date(), new Date());
  await fs.utimes(path.join(directory, names[3]), new Date(Date.now() + 3600000), new Date(Date.now() + 3600000));
  await fs.link(path.join(directory, names[4]), path.join(root, "outside.png"));
  await fs.writeFile(path.join(directory, "user.png"), bytes);
  const refs = references([`TIAOLV-COVER://cache/${names[0]}`, `tiaolv-cover://cache/${"f".repeat(64)}.png`]);
  assert.deepEqual(await cache.originalStatistics(refs), { directory, entries: 5, bytes: bytes.length * 5, reclaimableEntries: 1, reclaimableBytes: bytes.length });
  const result = await cache.pruneOriginals(refs);
  assert.equal(result.removedEntries, 1);
  assert.equal(result.removedBytes, bytes.length);
  assert.equal(result.entries, 4);
  await assert.rejects(fs.access(path.join(directory, names[1])));
  for (const name of [names[0], ...names.slice(2), "user.png"]) assert.deepEqual(await fs.readFile(path.join(directory, name)), bytes);
  assert.deepEqual(await fs.readFile(path.join(root, "outside.png")), bytes);
});

test("missing, malformed and excessive reference payloads fail closed before deletion", async t => {
  const { BackgroundImageCache } = await import(moduleUrl);
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "cover-invalid-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const cache = new BackgroundImageCache(path.join(root, "covers"), "tiaolv-cover");
  assert.equal(typeof cache.pruneOriginals, "function");
  for (const payload of [undefined, {}, { complete: false, urls: [] }, { complete: true, urls: [], path: root }, references(["file:///outside.png"]), references([`tiaolv-cover://user@cache/${"a".repeat(64)}.png`]), references([`tiaolv-cover://cache/x/../${"a".repeat(64)}.png`]), references(Array(100001).fill(`tiaolv-cover://cache/${"a".repeat(64)}.png`))]) {
    await assert.rejects(cache.pruneOriginals(payload), /reference/i);
  }
  await assert.rejects(fs.access(path.join(root, "covers")), "Invalid requests cannot create directories");
});

test("imports and original statistics/pruning share one queue with a full recent import grace period", async t => {
  const { BackgroundImageCache } = await import(moduleUrl);
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "cover-queue-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const source = path.join(root, "source.png");
  const bytes = Buffer.alloc(2 * 1024 * 1024, 42); Buffer.from("89504e470d0a1a0a", "hex").copy(bytes);
  await fs.writeFile(source, bytes);
  const cache = new BackgroundImageCache(path.join(root, "covers"), "tiaolv-cover");
  assert.equal(typeof cache.pruneOriginals, "function");
  const imported = cache.importImage(source);
  const cleanup = cache.pruneOriginals(references([]));
  const stats = cache.originalStatistics(references([]));
  const url = await imported;
  assert.equal((await cleanup).removedEntries, 0);
  assert.equal((await stats).reclaimableEntries, 0);
  assert.deepEqual(await fs.readFile(await cache.resolve(url)), bytes);
});

test("linked directory ancestors are rejected before mkdir, resolution, statistics or pruning", async t => {
  const { BackgroundImageCache } = await import(moduleUrl);
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "cover-junction-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const outside = path.join(root, "outside"); await fs.mkdir(outside);
  const linked = path.join(root, "linked"); await fs.symlink(outside, linked, process.platform === "win32" ? "junction" : "dir");
  const cache = new BackgroundImageCache(path.join(linked, "nested", "covers"), "tiaolv-cover");
  await assert.rejects(cache.statistics(), /directory/i);
  await assert.rejects(cache.resolve(`tiaolv-cover://cache/${"a".repeat(64)}.png`), /directory/i);
  if (cache.pruneOriginals) await assert.rejects(cache.pruneOriginals(references([])), /directory/i);
  await assert.rejects(fs.access(path.join(outside, "nested")), "No directory may be created through the linked ancestor");
});

test("concurrent cache instances validate the same newly created directory", async t => {
  const { BackgroundImageCache } = await import(moduleUrl);
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "cover-concurrent-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const directory = path.join(root, "new", "covers");
  const first = new BackgroundImageCache(directory, "tiaolv-cover");
  const second = new BackgroundImageCache(directory, "tiaolv-cover");
  assert.deepEqual(await Promise.all([first.originalStatistics(references([])), second.originalStatistics(references([]))]), Array(2).fill({ directory, bytes: 0, entries: 0, reclaimableBytes: 0, reclaimableEntries: 0 }));
});

test("a hash-named file symlink is never counted or pruned", async t => {
  const { BackgroundImageCache } = await import(moduleUrl);
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "cover-file-link-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const directory = path.join(root, "covers"); await fs.mkdir(directory);
  const source = path.join(root, "original.png"); await fs.writeFile(source, "original bytes");
  const linked = path.join(directory, `${"a".repeat(64)}.png`);
  try { await fs.symlink(source, linked, "file"); } catch (error) {
    if (error.code !== "EPERM") throw error;
    t.skip("Windows file symlink privilege unavailable; directory junction and file hardlink protections are tested separately"); return;
  }
  const cache = new BackgroundImageCache(directory, "tiaolv-cover");
  assert.equal((await cache.originalStatistics(references([]))).entries, 0);
  assert.equal((await cache.pruneOriginals(references([]))).removedEntries, 0);
  assert.equal((await fs.lstat(linked)).isSymbolicLink(), true);
  assert.equal(await fs.readFile(source, "utf8"), "original bytes");
});
