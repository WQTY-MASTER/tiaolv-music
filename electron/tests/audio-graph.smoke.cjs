const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const ts = require("typescript");
const { chromium, _electron } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

function wave() {
  const samples = 48000 * 3;
  const data = Buffer.alloc(44 + samples * 2);
  data.write("RIFF"); data.writeUInt32LE(data.length - 8, 4); data.write("WAVEfmt ", 8);
  data.writeUInt32LE(16, 16); data.writeUInt16LE(1, 20); data.writeUInt16LE(1, 22);
  data.writeUInt32LE(48000, 24); data.writeUInt32LE(96000, 28);
  data.writeUInt16LE(2, 32); data.writeUInt16LE(16, 34); data.write("data", 36);
  data.writeUInt32LE(samples * 2, 40);
  for (let i = 0; i < samples; i++) data.writeInt16LE(Math.round(8000 * Math.sin(i * 440 * 2 * Math.PI / 48000)), 44 + i * 2);
  return data;
}

async function withTimeout(task, milliseconds = 15000) {
  let timer;
  try {
    return await Promise.race([task, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error("Audio smoke timed out")), milliseconds);
    })]);
  } finally { clearTimeout(timer); }
}

async function main() {
  const source = fs.readFileSync(path.join(__dirname, "../src/renderer/src/services/audioOutput.ts"), "utf8");
  const moduleJs = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
  const app = fs.readFileSync(path.join(__dirname, "../src/renderer/src/App.vue"), "utf8");
  const cors = app.match(/<audio\s[^>]*crossorigin="([^"]+)"/)?.[1] ?? null;
  const media = http.createServer((_req, res) => {
    res.writeHead(200, { "Access-Control-Allow-Origin": "*", "Content-Type": "audio/wav" });
    res.end(wave());
  });
  const site = http.createServer((req, res) => {
    res.setHeader("Content-Type", req.url === "/audio.js" ? "text/javascript" : "text/html");
    res.end(req.url === "/audio.js" ? moduleJs : "<!doctype html><title>Isolated audio graph test</title>");
  });
  await new Promise(resolve => media.listen(0, "127.0.0.1", resolve));
  await new Promise(resolve => site.listen(0, "127.0.0.1", resolve));
  let browser;
  try {
    let page;
    if (process.env.AUDIO_TEST_ELECTRON) {
      const env = { ...process.env, AUDIO_TEST_DATA: fs.mkdtempSync(path.join(require("node:os").tmpdir(), "tiaolv-audio-test-")) };
      delete env.ELECTRON_RUN_AS_NODE;
      browser = await _electron.launch({ executablePath: require("electron"), args: [path.join(__dirname, "helpers/audio-graph-main.cjs")], env, timeout: 15000 });
      page = await browser.firstWindow({ timeout: 15000 });
    } else {
      browser = await chromium.launch({ channel: "msedge", headless: true, args: ["--autoplay-policy=no-user-gesture-required"] });
      page = await browser.newPage();
    }
    await page.goto(`http://127.0.0.1:${site.address().port}`, { timeout: 15000 });
    const results = await withTimeout(page.evaluate(async ({ url, cors }) => {
      const { AudioOutputController } = await import("/audio.js");
      async function sample(crossOrigin) {
        const audio = new Audio();
        if (crossOrigin) audio.crossOrigin = crossOrigin;
        audio.src = url;
        const controller = new AudioOutputController(audio);
        await controller.setLoudnessMatching(true);
        // Measure upstream of a silent destination so this test never emits a tone.
        const silent = controller.context.createGain();
        silent.gain.value = 0;
        controller.gain.disconnect();
        controller.gain.connect(silent).connect(controller.context.destination);
        await audio.play();
        await new Promise(resolve => setTimeout(resolve, 450));
        const values = new Float32Array(2048);
        controller.analyser.getFloatTimeDomainData(values);
        const rms = Math.sqrt(values.reduce((sum, value) => sum + value * value, 0) / values.length);
        const progressed = audio.currentTime > 0;
        await controller.context.suspend();
        await controller.setLoudnessMatching(false);
        const resumed = controller.context.state === "running";
        await controller.setDevice("default");
        const sink = controller.context.sinkId;
        audio.pause(); controller.dispose(); await controller.context.close();
        return { rms, progressed, resumed, sink };
      }
      return { baseline: await sample(null), configured: await sample(cors) };
    }, { url: `http://127.0.0.1:${media.address().port}/tone.wav`, cors }));
    console.log(JSON.stringify(results));
    assert.equal(results.baseline.progressed, true);
    assert.equal(results.baseline.rms, 0, "reproduce progressing but silent cross-origin playback");
    assert.ok(results.configured.rms > 0.05, "the actual app audio configuration must deliver samples");
    assert.equal(results.configured.resumed, true);
    assert.equal(results.configured.sink, "");
  } finally {
    if (browser) {
      try { await withTimeout(browser.close(), 5000); }
      catch (error) { browser.process?.().kill(); throw error; }
    }
    await new Promise(resolve => site.close(resolve));
    await new Promise(resolve => media.close(resolve));
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
