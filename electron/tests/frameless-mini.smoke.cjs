const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { _electron } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { dismissFirstRunOnboarding } = require('./helpers/onboarding-smoke.cjs');

async function main() {
  const data = fs.mkdtempSync(path.join(os.tmpdir(), 'tiaolv-mini-smoke-'));
  const token = path.join(data, 'local-access.token');
  fs.writeFileSync(token, 'a'.repeat(64));
  fs.writeFileSync(path.join(data, 'shortcuts.json'), JSON.stringify({ enabled: false }));
  const env = { ...process.env, SHORTCUT_SMOKE_DATA: data, LISTENMUSIC_LOCAL_ACCESS_TOKEN_FILE: token, LOCALAPPDATA: data, APPDATA: data, HOME: data, USERPROFILE: data };
  delete env.ELECTRON_RUN_AS_NODE; delete env.ELECTRON_RENDERER_URL;
  let instance;
  const errors = [];
  try {
    instance = await _electron.launch({ executablePath: require('electron'), args: [path.join(__dirname, 'helpers/shortcut-smoke-main.cjs')], env, timeout: 20000 });
    const page = await instance.firstWindow();
    page.on('pageerror', error => errors.push(error.message));
    await dismissFirstRunOnboarding(page);
    const mainId = await instance.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].id);
    const native = (id, expression, value) => instance.evaluate(({ BrowserWindow }, { id, expression, value }) => {
      const win = BrowserWindow.fromId(id);
      if (expression === 'bounds') return win.getBounds();
      if (expression === 'resize') { win.setBounds(value); return win.getBounds(); }
      if (expression === 'restore') { win.restore(); win.show(); win.focus(); return true; }
      if (expression === 'handle') return win.getNativeWindowHandle().readBigUInt64LE().toString();
      if (expression === 'state') return { visible: win.isVisible(), minimized: win.isMinimized(), top: win.isAlwaysOnTop(), background: win.getBackgroundColor(), throttled: win.webContents.getBackgroundThrottling() };
    }, { id, expression, value });
    const before = await native(mainId, 'bounds');
    async function openMini() {
      const ready = instance.waitForEvent('window');
      await instance.evaluate(({ BrowserWindow }, id) => BrowserWindow.fromId(id).webContents.send('tray-media-action', 'mini-player'), mainId);
      const mini = await ready;
      mini.on('pageerror', error => errors.push(error.message));
      await mini.locator('.mini-player').waitFor();
      return mini;
    }
    const mini = await openMini();
    const miniId = await instance.evaluate(({ BrowserWindow }, mainId) => BrowserWindow.getAllWindows().find(win => win.id !== mainId).id, mainId);
    async function nativeRegion() {
      if (process.platform !== 'win32') return null;
      const handle = await native(miniId, 'handle');
      const region = JSON.parse(execFileSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(__dirname, 'helpers/mini-native-region.ps1'), '-WindowHandle', handle], { encoding: 'utf8', windowsHide: true }));
      assert.ok(region.kind > 0, 'Native window must have a region, not only transparent renderer corners');
      assert.equal(region.thickFrame, false);
      assert.equal(region.corner, false);
      assert.equal(region.bottomCorner, false);
      assert.equal(region.center, true);
      assert.equal(region.top, true);
      assert.equal(region.right, true, 'Edge grips must remain inside the native region');
      return region;
    }
    await nativeRegion();
    assert.deepEqual(await native(mainId, 'bounds'), before);
    assert.equal((await native(mainId, 'state')).visible, false);
    assert.equal((await native(mainId, 'state')).throttled, false);
    assert.ok(['#00000000', '#000000'].includes((await native(miniId, 'state')).background));
    assert.equal(await mini.evaluate(() => navigator.windowControlsOverlay?.visible ?? false), false);
    assert.equal(await mini.locator('audio').count(), 0);
    assert.equal(await page.locator('audio').count(), 1);
    assert.equal(await mini.evaluate(() => typeof window.listenMusic.getLibrary), 'undefined');
    await mini.locator('.mini-player').hover();
    await mini.waitForTimeout(350);
    assert.equal(await mini.locator('.mini-window-toolbar button').count(), 5);
    assert.equal(await mini.locator('.mini-close-button').count(), 0);
    const artifacts = path.resolve(__dirname, '../.playwright-cli');
    fs.mkdirSync(artifacts, { recursive: true });
    const corner = await mini.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: 1, height: 1 } });
    const pixel = await instance.evaluate(({ nativeImage }, bytes) => [...nativeImage.createFromBuffer(Buffer.from(bytes)).getBitmap().subarray(0, 4)], [...corner]);
    assert.equal(pixel[3], 0, `Corner must be fully transparent, got BGRA ${pixel}`);
    // Let the main renderer finish guide/palette initialization before injecting fixture metadata.
    await page.waitForTimeout(1000);
    const initial = await mini.evaluate(() => window.listenMusic.getMiniPlayerSnapshot());
    const lyrics = Array.from({ length: 9 }, (_, index) => {
      const text = index === 4 ? 'Moonlight' : `Lyric line ${index + 1}`;
      return { time: index * 4, duration: 4, text,
        characters: Array.from(text).map((text, offset) => ({ text, start: index * 4 + offset * 4 / 9, duration: 4 / 9 })) };
    });
    async function present(extra) {
      await page.evaluate(snapshot => window.listenMusic.updateMiniPlayerSnapshot(snapshot), {
        ...initial.playback, isPlaying: true, currentTime: 18, lyricLines: lyrics,
        coverUrl: `data:image/png;base64,${fs.readFileSync(path.join(__dirname, '../resources/app-icon.png')).toString('base64')}`,
        source: 'qq', lyricsFormat: 'QRC', ...extra
      });
      await mini.waitForTimeout(150);
    }
    await present({});
    await nativeRegion();
    await mini.waitForFunction(() => document.querySelector('.mini-lyrics')?.dataset.highlightMode === 'word');
    const fill = await mini.locator('.is-current .mini-lyric-character').first().evaluate(el => Number.parseFloat(el.style.getPropertyValue('--mini-character-fill')));
    assert.equal(fill, 100, 'QQ elapsed characters must be colored');
    assert.equal(await mini.locator('.is-current .mini-lyric-character').last().evaluate(el => Number.parseFloat(el.style.getPropertyValue('--mini-character-fill'))), 0);
    await page.evaluate(() => window.listenMusic.updateMiniPlayerTime(18.3, 30));
    const betweenSamples = await mini.evaluate(async () => {
      const samples = [];
      for (let frame = 0; frame < 5; frame++) {
        await new Promise(resolve => requestAnimationFrame(resolve));
        const character = document.querySelectorAll('.is-current .mini-lyric-character')[5];
        samples.push(parseFloat(character.style.getPropertyValue('--mini-character-fill')));
      }
      return samples;
    });
    assert.ok(new Set(betweenSamples.map(fill => Math.round(fill * 10))).size >= 4,
      `Word fill must advance on frames between IPC messages: ${betweenSamples}`);
    assert.ok(betweenSamples.every((fill, index) => index === 0 || fill >= betweenSamples[index - 1]), 'Ordinary word fill never rewinds');
    await present({ isPlaying: false, currentTime: 18.3 });
    const pausedFill = await mini.locator('.is-current .mini-lyric-character').nth(5).evaluate(el => el.style.getPropertyValue('--mini-character-fill'));
    await mini.waitForTimeout(180);
    assert.equal(await mini.locator('.is-current .mini-lyric-character').nth(5).evaluate(el => el.style.getPropertyValue('--mini-character-fill')), pausedFill, 'Pause freezes the local clock');
    await present({});
    const shortTransform = await mini.locator('.is-current .mini-lyric-flow').evaluate(el => getComputedStyle(el).transform);
    await mini.waitForTimeout(250);
    assert.equal(await mini.locator('.is-current .mini-lyric-flow').evaluate(el => getComputedStyle(el).transform), shortTransform, 'Short lyrics must remain stationary');
    await page.evaluate(() => window.listenMusic.updateMiniPlayerTime(22, 40));
    await mini.waitForFunction(() => document.querySelector('.is-current')?.textContent.includes('Lyric line 6'));
    await page.evaluate(() => window.listenMusic.updateMiniPlayerTime(18, 30));
    await mini.waitForFunction(() => document.querySelector('.is-current')?.textContent.includes('Moonlight'));
    for (const [height, count] of [[168, '1'], [220, '3'], [320, '5']]) {
      await native(miniId, 'resize', { width: 512, height });
      await mini.waitForFunction(count => document.querySelector('.mini-lyrics')?.dataset.lineCount === count, count);
      const slots = await mini.locator('.mini-lyric-slot[data-visible="true"]').all();
      assert.equal(slots.length, Number(count));
      assert.equal(await slots[Math.floor(Number(count) / 2)].evaluate(el => el.classList.contains('is-current')), true);
      await mini.screenshot({ path: path.join(artifacts, `mini-lyrics-${count}-lines.png`), omitBackground: true });
    }
    await present({ source: 'netease', lyricsFormat: 'YRC' });
    assert.equal(await mini.locator('.mini-lyrics').getAttribute('data-highlight-mode'), 'line');
    assert.equal(await mini.locator('.mini-lyric-character').count(), 0, 'NetEase must highlight whole line, not words');
    assert.equal(await mini.locator('.is-current .mini-lyric').evaluate(el => {
      const probe = document.createElement('span'); probe.style.color = 'var(--mini-accent)'; el.append(probe);
      const accent = getComputedStyle(probe).color; probe.remove(); return getComputedStyle(el).color === accent;
    }), true, 'NetEase current line must use the mini accent');
    await mini.screenshot({ path: path.join(artifacts, 'mini-lyrics-netease-line.png'), omitBackground: true });
    await page.evaluate(() => window.listenMusic.updateMiniPlayerTime(19.95, 40));
    await mini.waitForFunction(() => document.querySelector('.mini-lyrics')?.dataset.motion === 'snap');
    const nextLine = mini.locator('.mini-lyric-slot[data-index="5"]');
    const startY = await nextLine.evaluate(el => new DOMMatrix(getComputedStyle(el).transform).m42);
    await page.evaluate(() => window.listenMusic.updateMiniPlayerTime(20.05, 41));
    await mini.waitForFunction(() => document.querySelector('.mini-lyrics')?.dataset.motion === 'smooth');
    await mini.waitForFunction(start => {
      const row = document.querySelector('.mini-lyric-slot[data-index="5"]');
      const y = new DOMMatrix(getComputedStyle(row).transform).m42;
      return y < start && y > -17.5;
    }, startY, { polling: 'raf' });
    const inFlightY = await nextLine.evaluate(el => new DOMMatrix(getComputedStyle(el).transform).m42);
    const targetY = await nextLine.evaluate(el => Number.parseFloat(el.style.transform.match(/-?[\d.]+/)[0]));
    assert.ok(inFlightY < startY && inFlightY > targetY + 0.5, `Normal lyric change must move smoothly through intermediate positions: ${startY}, ${inFlightY}, ${targetY}`);
    await mini.waitForTimeout(320);
    assert.equal(await nextLine.evaluate(el => new DOMMatrix(getComputedStyle(el).transform).m42), targetY);
    await page.evaluate(() => window.listenMusic.updateMiniPlayerTime(19.95, 40));
    await mini.waitForFunction(() => document.querySelector('.mini-lyrics')?.dataset.motion === 'snap');
    assert.equal(await mini.locator('.is-current').evaluate(el => new DOMMatrix(getComputedStyle(el).transform).m42), -18, 'Backward seek must immediately center the active line');
    await present({ source: 'local', lyricsSource: 'online-netease', lyricsFormat: 'YRC' });
    assert.equal(await mini.locator('.mini-lyrics').getAttribute('data-highlight-mode'), 'line', 'Backend-matched NetEase lyrics retain whole-line highlighting');
    const longLyrics = lyrics.map((line, index) => index === 4 ? { time: 16, duration: 4, text: 'Long lyric overflowing the available width. '.repeat(6) } : line);
    await present({ source: 'netease', lyricsFormat: 'LRC', lyricLines: longLyrics });
    assert.ok(await mini.locator('.is-current .mini-lyric-flow').evaluate(el => new DOMMatrix(getComputedStyle(el).transform).m41 < -10));
    await present({ source: 'netease', lyricsFormat: 'LRC', lyricLines: longLyrics, currentTime: 16, isPlaying: false });
    assert.equal(await mini.locator('.is-current .mini-lyric-flow').evaluate(el => new DOMMatrix(getComputedStyle(el).transform).m41), 0, 'Seek must reset scrolling');
    await mini.waitForTimeout(200);
    assert.equal(await mini.locator('.is-current .mini-lyric-flow').evaluate(el => new DOMMatrix(getComputedStyle(el).transform).m41), 0, 'Paused lyrics must not drift');
    await present({});
    const responsive = [];
    for (const [width, height] of [[340, 168], [412, 168], [680, 260], [720, 320]]) {
      await native(miniId, 'resize', { width, height });
      await mini.locator('.mini-player').hover();
      await mini.waitForTimeout(100);
      const geometry = await mini.evaluate(() => {
        const rect = selector => { const r = document.querySelector(selector).getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom }; };
        const main = getComputedStyle(document.querySelector('.mini-main'));
        const cover = document.querySelector('.mini-cover-button').getBoundingClientRect();
        const image = document.querySelector('.mini-cover img');
        return { card: rect('.mini-player'), tools: rect('.mini-window-toolbar'), copy: rect('.mini-copy'), controls: rect('.mini-controls'), cover: { left: cover.left, right: cover.right, width: cover.width, height: cover.height, imageWidth: image.getBoundingClientRect().width, loaded: image.complete && image.naturalWidth > 0 }, fontSize: parseFloat(getComputedStyle(document.querySelector('.is-current .mini-lyric')).fontSize), main: { height: main.height, padding: main.padding, boxSizing: main.boxSizing, minHeight: main.minHeight }, overflow: document.documentElement.scrollWidth > innerWidth };
      });
      assert.equal(geometry.overflow, false);
      assert.ok(geometry.tools.right <= geometry.card.right);
      assert.ok(geometry.tools.bottom <= geometry.copy.top, `Toolbar overlaps text at ${width}: ${JSON.stringify(geometry)}`);
      await mini.screenshot({ path: path.join(artifacts, `mini-frameless-${width}.png`), omitBackground: true });
      assert.ok(geometry.copy.bottom <= geometry.controls.top + 1, `Text overlaps playback buttons at ${width}: ${JSON.stringify(geometry)}`);
      assert.equal(geometry.cover.width, geometry.cover.height);
      assert.ok(geometry.cover.width >= 72 && geometry.cover.width <= 180);
      assert.equal(geometry.cover.loaded, true, 'Album image must actually render');
      assert.ok(geometry.cover.imageWidth >= 56 && geometry.cover.imageWidth <= 180);
      assert.ok(geometry.cover.right < geometry.copy.left, 'Cover and lyrics must not overlap');
      responsive.push(geometry);
    }
    assert.ok(responsive.at(-1).cover.width > responsive[0].cover.width);
    assert.ok(responsive.at(-1).cover.imageWidth > responsive[0].cover.imageWidth + 40, 'The actual album image must grow, not just its surrounding column');
    assert.ok(responsive.at(-1).copy.left > responsive[0].copy.left + 70, 'Wide layout must shift lyrics to the right');
    assert.ok(responsive.at(-1).fontSize > responsive[0].fontSize);
    assert.equal(responsive.at(-1).cover.width, 180, 'Maximum window must show the enlarged cover');
    assert.ok(responsive.at(-1).cover.imageWidth >= 164, 'Actual album image must grow with its ring');
    const translatedLyrics = lyrics.map((line, index) => ({ ...line, translation: index === 4 ? '月光照亮这片天空' : `这是第 ${index + 1} 句译文` }));
    await present({ lyricLines: translatedLyrics });
    await mini.waitForFunction(() => document.querySelector('.mini-lyrics')?.dataset.lineCount === '3');
    assert.equal(await mini.locator('.mini-lyric-slot[data-visible="true"] .mini-lyric-translation').count(), 3);
    assert.equal(await mini.locator('.is-current .mini-lyric-translation').innerText(), translatedLyrics[4].translation);
    assert.equal(await mini.locator('.mini-lyrics').getAttribute('data-highlight-mode'), 'word', 'Translations must not change QQ word timing');
    const grouped = await mini.evaluate(() => [...document.querySelectorAll('.mini-lyric-slot[data-visible="true"]')].map(el => {
      const box = el.getBoundingClientRect(), original = el.querySelector('.mini-lyric').getBoundingClientRect(), translation = el.querySelector('.mini-lyric-translation').getBoundingClientRect();
      return { top: box.top, bottom: box.bottom, originalBottom: original.bottom, translationTop: translation.top, translationBottom: translation.bottom };
    }));
    for (const group of grouped) {
      assert.ok(group.translationTop >= group.originalBottom, 'Translation must not overlap original');
      assert.ok(group.translationBottom <= group.bottom + 1, 'Translation must fit its group');
    }
    await mini.screenshot({ path: path.join(artifacts, 'mini-cover-translation-720.png'), omitBackground: true });
    if (process.platform === 'win32') {
      await instance.evaluate(({ BrowserWindow }, id) => { const win = BrowserWindow.fromId(id); win.setPosition(100, 100); win.focus(); win.moveTop(); }, miniId);
      await mini.waitForTimeout(200);
      execFileSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(__dirname, 'helpers/mini-native-region.ps1'), '-WindowHandle', await native(miniId, 'handle'), '-CapturePath', path.join(artifacts, 'mini-desktop-cover-translation.png')], { windowsHide: true });
    }
    await native(miniId, 'resize', { width: 412, height: 168 });
    await mini.waitForFunction(() => document.querySelector('.mini-lyrics')?.dataset.lineCount === '1');
    assert.equal(await mini.locator('.mini-lyric-slot[data-visible="true"] .mini-lyric-translation').count(), 1);
    await mini.screenshot({ path: path.join(artifacts, 'mini-cover-translation-412.png'), omitBackground: true });
    await present({ source: 'netease', lyricsFormat: 'YRC', lyricLines: translatedLyrics });
    assert.equal(await mini.locator('.mini-lyric-character').count(), 0);
    assert.equal(await mini.locator('.is-current .mini-lyric-translation').innerText(), translatedLyrics[4].translation);
    const quotedLyrics = translatedLyrics.map((line, index) => index === 4
      ? { ...line, text: '“Moonlight', translation: '“月光照亮天空' } : line);
    await present({ source: 'netease', lyricsFormat: 'LRC', lyricLines: quotedLyrics });
    const quoted = await mini.locator('.is-current').evaluate(el => {
      const flow = el.querySelector('.mini-lyric-flow'), translation = el.querySelector('.mini-translation-content');
      const range = document.createRange();
      range.selectNodeContents([...flow.childNodes].find(node => node.nodeType === Node.TEXT_NODE && node.textContent.trim()));
      const mark = flow.querySelector('.is-leading-quote').getBoundingClientRect();
      const translatedMark = el.querySelector('.mini-lyric-translation .is-leading-quote').getBoundingClientRect();
      const stage = el.closest('.mini-lyric-stage').getBoundingClientRect();
      return { original: flow.textContent, translation: el.querySelector('.mini-lyric-translation').textContent,
        originalLeft: range.getBoundingClientRect().left, translationLeft: translation.getBoundingClientRect().left,
        markLeft: mark.left, markRight: mark.right, translatedMarkLeft: translatedMark.left, stageLeft: stage.left };
    });
    assert.equal(quoted.original, '“Moonlight');
    assert.equal(quoted.translation, '“月光照亮天空');
    assert.ok(Math.abs(quoted.originalLeft - quoted.translationLeft) < 1, 'Bilingual bodies align without a quote indent');
    assert.ok(quoted.markRight <= quoted.originalLeft + 1 && quoted.markLeft >= quoted.stageLeft
      && quoted.translatedMarkLeft >= quoted.stageLeft, `Hanging quotes remain visible inside the lyric viewport: ${JSON.stringify(quoted)}`);
    await present({ source: 'netease', lyricsFormat: 'LRC', lyricLines: translatedLyrics.map(line => ({ ...line, translation: '很长的译文应当保持在原文下面而不挤压播放按钮。'.repeat(12) })) });
    const longTranslation = await mini.locator('.is-current').evaluate(el => {
      const group = el.getBoundingClientRect(), original = el.querySelector('.mini-lyric').getBoundingClientRect(), translation = el.querySelector('.mini-lyric-translation').getBoundingClientRect();
      return { top: group.top, bottom: group.bottom, originalTop: original.top, originalBottom: original.bottom, translationTop: translation.top, translationBottom: translation.bottom, translationHeight: translation.height };
    });
    assert.ok(longTranslation.originalTop >= longTranslation.top - 1);
    assert.ok(longTranslation.translationTop >= longTranslation.originalBottom);
    assert.ok(longTranslation.translationBottom <= longTranslation.bottom + 1);
    assert.equal(longTranslation.translationHeight, 28, 'Small window must display at most two complete translation lines');
    const partialLyrics = translatedLyrics.map((line, index) => index === 4 ? { ...line, translation: ' ' } : line);
    await present({ lyricLines: partialLyrics });
    assert.equal(await mini.locator('.is-current .mini-lyric-translation').count(), 0, 'Missing translation must not render an empty label');
    await native(miniId, 'resize', { width: 720, height: 320 });
    await mini.waitForFunction(() => document.querySelector('.mini-lyrics')?.dataset.lineCount === '3');
    await present({});
    await mini.waitForFunction(() => document.querySelector('.mini-lyrics')?.dataset.lineCount === '5');
    assert.equal(await mini.locator('.mini-lyric-translation').count(), 0);
    await nativeRegion();
    await mini.locator('.mini-player').hover();
    await mini.waitForTimeout(350);
    await mini.getByRole('button', { name: '锁定窗口位置', exact: true }).click();
    await mini.getByRole('button', { name: '解锁窗口位置', exact: true }).waitFor();
    assert.equal(await mini.locator('.mini-resize-grip').count(), 0);
    assert.equal(await mini.evaluate(() => window.listenMusic.startMiniResize('se')), false);
    assert.equal(await mini.locator('.mini-player').evaluate(el => getComputedStyle(el).getPropertyValue('-webkit-app-region')), 'no-drag');
    await mini.getByRole('button', { name: '解锁窗口位置', exact: true }).click();
    await mini.locator('.edge-se').waitFor();
    const pinName = (await native(miniId, 'state')).top ? '取消窗口置顶' : '保持窗口置顶';
    await mini.getByRole('button', { name: pinName, exact: true }).click();
    await mini.waitForTimeout(150);
    assert.equal((await native(miniId, 'state')).top, pinName !== '取消窗口置顶');
    await nativeRegion();
    const editorReady = instance.waitForEvent('window');
    await mini.getByRole('button', { name: '自定义迷你播放器', exact: true }).click();
    const editor = await editorReady;
    editor.on('pageerror', error => errors.push(error.message));
    await editor.getByRole('button', { name: '外观', exact: true }).click();
    if (process.platform === 'win32') {
      await editor.locator('label').filter({ hasText: '窗口圆角' }).locator('input').fill('8');
      await mini.waitForFunction(() => getComputedStyle(document.querySelector('.mini-player')).getPropertyValue('--mini-radius').trim() === '8px');
      const shallow = await nativeRegion();
      await editor.locator('label').filter({ hasText: '窗口圆角' }).locator('input').fill('32');
      await mini.waitForFunction(() => getComputedStyle(document.querySelector('.mini-player')).getPropertyValue('--mini-radius').trim() === '32px');
      const rounded = await nativeRegion();
      assert.ok(rounded.topInset > shallow.topInset, 'Windows region must track the appearance radius');
    }
    await editor.locator('input[type=range]').first().fill('70');
    await mini.waitForFunction(() => getComputedStyle(document.querySelector('.mini-player')).getPropertyValue('--mini-surface-opacity').trim() === '70%');
    await editor.getByRole('button', { name: '主题', exact: true }).click();
    await editor.getByRole('button', { name: '暮光玻璃', exact: false }).click();
    await mini.waitForFunction(() => getComputedStyle(document.querySelector('.mini-player')).getPropertyValue('--mini-text').trim() === '#f4f6ff');
    assert.equal(await editor.locator('audio').count(), 0);
    assert.equal(await editor.evaluate(() => window.listenMusic.readAppearanceBackground('C:/Windows/win.ini').then(() => false, () => true)), true);
    await editor.screenshot({ path: path.join(artifacts, 'mini-appearance-editor.png') });
    await editor.getByRole('button', { name: '关闭设置', exact: true }).click();
    await mini.locator('.mini-player').hover();
    const collapsed = await native(miniId, 'bounds');
    await mini.getByRole('button', { name: '播放列表', exact: true }).click();
    await mini.locator('.mini-queue-panel').waitFor();
    assert.equal((await native(miniId, 'bounds')).height, collapsed.height + 208);
    assert.equal((await native(miniId, 'bounds')).width, collapsed.width);
    await nativeRegion();
    await mini.getByRole('button', { name: '播放列表', exact: true }).click();
    await mini.waitForTimeout(300);
    assert.equal((await native(miniId, 'bounds')).height, collapsed.height);
    await mini.getByRole('button', { name: '最小化迷你播放器', exact: true }).click();
    assert.equal((await native(miniId, 'state')).minimized, true);
    assert.equal((await native(mainId, 'state')).visible, false);
    await native(miniId, 'restore');
    await mini.locator('.mini-player').hover();
    await mini.getByRole('button', { name: '返回完整播放器', exact: true }).click();
    await page.waitForFunction(() => getComputedStyle(document.querySelector('.app-shell')).display !== 'none');
    assert.deepEqual(await native(mainId, 'bounds'), before);
    assert.equal((await native(mainId, 'state')).visible, true);
    await page.getByRole('button', { name: '设置', exact: true }).click();
    await page.getByRole('button', { name: '外观', exact: true }).click();
    await page.getByRole('button', { name: '展开迷你播放器设置', exact: true }).click();
    assert.equal(await page.getByRole('button', { name: '暮光玻璃', exact: false }).evaluate(el => el.classList.contains('active')), true);
    const second = await openMini();
    assert.equal(await second.evaluate(() => innerWidth), collapsed.width);
    await second.locator('.mini-player').hover();
    await second.getByRole('button', { name: '返回完整播放器', exact: true }).click();
    assert.deepEqual(errors, []);
    console.log('Frameless mini smoke passed: native rounded region/frame, transparent pixels, 180 px cover, 1/3 translated groups and bounded long translations, adaptive 1/3/5 lyrics, smooth intermediate frames/immediate seeks, QQ words/NetEase line fill, five tools, appearance sync, lock/pin/minimize, queue and return');
  } finally {
    if (instance) await instance.close();
    const resolved = fs.realpathSync(data);
    assert.equal(path.dirname(resolved), fs.realpathSync(os.tmpdir()));
    assert.ok(path.basename(resolved).startsWith('tiaolv-mini-smoke-'));
    fs.rmSync(resolved, { recursive: true, force: true });
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
