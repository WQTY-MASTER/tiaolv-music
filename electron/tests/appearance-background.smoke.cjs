const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const http = require("node:http");
const { _electron } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const { dismissFirstRunOnboarding } = require("./helpers/onboarding-smoke.cjs");

const root = path.resolve(__dirname, "../out/renderer");
const artifacts = path.resolve(__dirname, "../.playwright-cli");
const server = http.createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
  const file = path.resolve(root, `.${pathname === "/" ? "/index.html" : pathname}`);
  if (!file.startsWith(`${root}${path.sep}`)) { res.writeHead(403).end(); return; }
  fs.readFile(file, (error, bytes) => {
    if (error) { res.writeHead(404).end(); return; }
    res.setHeader("Content-Type", ({ ".html": "text/html", ".js": "text/javascript", ".css": "text/css" })[path.extname(file)] || "application/octet-stream");
    res.end(bytes);
  });
});

async function check(mode) {
  const data = fs.mkdtempSync(path.join(os.tmpdir(), "tiaolv-background-"));
  const fixture = path.join(data, "背景 #1.png");
  const env = { ...process.env, SHORTCUT_SMOKE_DATA: data };
  delete env.ELECTRON_RUN_AS_NODE;
  if (mode === "http") env.ELECTRON_RENDERER_URL = `http://127.0.0.1:${server.address().port}`;
  else delete env.ELECTRON_RENDERER_URL;
  const instance = await _electron.launch({ executablePath: require("electron"), args: [path.join(__dirname, "helpers/shortcut-smoke-main.cjs")], env });
  try {
    const fixtureData = await instance.evaluate(({ nativeImage, dialog }, fixture) => {
      const bitmap = Buffer.alloc(64 * 64 * 4);
      for (let i = 0; i < bitmap.length; i += 4) {
        bitmap[i] = 80; bitmap[i + 1] = 180; bitmap[i + 2] = 20; bitmap[i + 3] = 255;
      }
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [fixture] });
      return nativeImage.createFromBitmap(bitmap, { width: 64, height: 64 }).toPNG().toString("base64");
    }, fixture);
    fs.writeFileSync(fixture, Buffer.concat([Buffer.from(fixtureData, "base64"), Buffer.alloc(21 * 1024 * 1024)]));
    const page = await instance.firstWindow();
    await dismissFirstRunOnboarding(page);
    page.setDefaultTimeout(10000);
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const openAppearance = async () => {
      await page.getByRole("button", { name: "设置", exact: true }).click();
      await page.getByRole("button", { name: "外观", exact: true }).click();
    };
    const checkImage = async () => {
      await page.waitForFunction(() => getComputedStyle(document.querySelector(".app-shell")).backgroundImage.includes("tiaolv-background://cache/"));
      assert.equal(await page.locator(".main-scroll").evaluate(el => getComputedStyle(el).backgroundColor), "rgba(0, 0, 0, 0)");
      assert.equal(await page.locator(".workspace").evaluate(el => getComputedStyle(el).backgroundColor), "rgba(0, 0, 0, 0)");
    };
    await openAppearance();
    await page.locator(".unified-background").getByRole("button", { name: "选择图片", exact: true }).click();
    await checkImage();
    const savedUrl = await page.evaluate(() => JSON.parse(localStorage.getItem("tiaolv-music-appearance-settings")).background.unified.imagePath);
    assert.match(savedUrl, /^tiaolv-background:\/\/cache\/[a-f0-9]{64}\.png$/);
    const stats = await page.evaluate(() => window.listenMusic.getBackgroundCacheStatistics());
    assert.equal(stats.entries, 1);
    assert.equal(stats.bytes, fs.statSync(fixture).size);
    // Imported backgrounds must survive moving the original file.
    fs.renameSync(fixture, `${fixture}.moved`);
    // A real screenshot pixel catches opaque layers that computed background-image alone misses.
    await page.evaluate(() => document.querySelector(".main-scroll").scrollTo(0, 0));
    const size = await page.evaluate(() => ({ width: innerWidth, height: innerHeight }));
    const pixel = await page.screenshot({ clip: { x: size.width - 15, y: 90, width: 1, height: 1 } });
    const rgba = await instance.evaluate(({ nativeImage }, bytes) => [...nativeImage.createFromBuffer(Buffer.from(bytes)).getBitmap().subarray(0, 4)], [...pixel]);
    assert.ok(rgba[1] > rgba[2] + 50, `Expected visible green background, got BGRA ${rgba}`);
    fs.mkdirSync(artifacts, { recursive: true });
    await page.screenshot({ path: path.join(artifacts, `background-${mode}.png`) });
    await page.reload();
    await openAppearance();
    await checkImage();
    await page.getByRole("button", { name: "缓存与数据", exact: true }).click();
    const clearBackground = page.getByRole("button", { name: "清理背景图片", exact: true });
    await page.waitForFunction(() => document.querySelector(".background-cache-clear button")?.disabled === false);
    await page.evaluate(() => { window.confirm = () => true; });
    await clearBackground.click();
    await page.waitForFunction(() => !document.querySelector(".app-shell").classList.contains("has-custom-background-image"));
    await page.waitForFunction(() => document.querySelector(".background-cache-clear button")?.disabled === true);
    assert.equal((await page.evaluate(() => window.listenMusic.getBackgroundCacheStatistics())).entries, 0);
    assert.ok(fs.statSync(`${fixture}.moved`).size > 20 * 1024 * 1024);
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("tiaolv-music-appearance-settings")).background.unified.mode), "solid");
    await page.screenshot({ path: path.join(artifacts, `background-cache-cleared-${mode}.png`) });
    await page.getByRole("button", { name: "返回", exact: true }).click();

    for (const width of [1440, 900]) {
      await instance.evaluate(({ BrowserWindow }, width) => {
        const win = BrowserWindow.getAllWindows()[0];
        win.setMinimumSize(600, 500);
        win.setSize(width, 800);
      }, width);
      for (const title of ["所有歌曲", "艺术家", "专辑", "歌单", "聚合歌单", "文件夹", "最近播放"]) {
        if (await page.locator(".app-shell").evaluate(el => el.classList.contains("is-sidebar-collapsed"))) {
          await page.getByRole("button", { name: "菜单", exact: true }).click();
        }
        await page.locator(".sidebar .nav-item").filter({ hasText: title }).filter({ hasNotText: title === "歌单" ? "聚合歌单" : "NOT_A_LABEL" }).click();
        await page.waitForTimeout(650);
        const heading = page.locator(".page-transition-frame h1:visible").first();
        const expandedBox = await heading.boundingBox();
        assert.ok(Math.abs(expandedBox.y - (width > 980 ? 106 : 132)) < 1, `${title} at ${width}px does not share the artist page top inset: ${expandedBox.y}`);
        const artistCover = page.locator(".local-artist-cover").first();
        const expandedCover = title === "艺术家" ? await artistCover.boundingBox() : null;
        await page.getByRole("button", { name: "菜单", exact: true }).click();
        if (expandedCover) {
          const sizes = await page.evaluate(async () => {
            const samples = [];
            const start = performance.now();
            while (performance.now() - start < 350) {
              await new Promise(requestAnimationFrame);
              const box = document.querySelector(".local-artist-cover").getBoundingClientRect();
              samples.push({ width: box.width, height: box.height });
            }
            return samples;
          });
          for (const size of sizes) {
            assert.ok(Math.abs(size.width - expandedCover.width) < 1 && Math.abs(size.height - expandedCover.height) < 1,
              `Artist cover resized during collapse at ${width}px: ${expandedCover.width}x${expandedCover.height} -> ${size.width}x${size.height}`);
          }
          await page.screenshot({ path: path.join(artifacts, `artist-fixed-cover-${mode}-${width}.png`) });
        }
        await page.waitForTimeout(650);
        const box = await heading.boundingBox();
        assert.ok(Math.abs(box.y - expandedBox.y) < 1, `${title} at ${width}px moved vertically on collapse: ${expandedBox.y} -> ${box.y}`);
        const controls = await page.locator(".shell-controls").boundingBox();
        if (!box || box.y <= controls.y + controls.height + 16) console.log(await page.locator(".main-scroll").evaluate(el => ({ className: el.className, padding: getComputedStyle(el).paddingTop, scroll: el.scrollTop, shell: document.querySelector(".app-shell").className })));
        assert.ok(box && box.y > controls.y + controls.height + 16, `${title} at ${width}px overlaps controls: ${JSON.stringify(box)}`);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
        if (title === "所有歌曲") await page.screenshot({ path: path.join(artifacts, `local-inset-${mode}-${width}.png`) });
        await page.getByRole("button", { name: "菜单", exact: true }).click();
        await page.waitForTimeout(350);
        const reopenedBox = await heading.boundingBox();
        assert.ok(Math.abs(reopenedBox.y - box.y) < 1, `${title} at ${width}px moved vertically on expand: ${box.y} -> ${reopenedBox.y}`);
        if (expandedCover) {
          const reopenedCover = await artistCover.boundingBox();
          assert.ok(Math.abs(reopenedCover.width - expandedCover.width) < 1 && Math.abs(reopenedCover.height - expandedCover.height) < 1,
            `Artist cover resized after reopening sidebar at ${width}px`);
        }
      }
    }
    assert.deepEqual(errors, []);
    console.log(`${mode}: >20 MB import, rendered pixel, persistence without original, safe cache clearing and seven local pages passed.`);
  } finally { await instance.close(); }
}

(async () => {
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  try { await check("file"); await check("http"); }
  finally { await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
