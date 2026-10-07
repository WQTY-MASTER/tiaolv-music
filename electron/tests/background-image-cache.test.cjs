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
