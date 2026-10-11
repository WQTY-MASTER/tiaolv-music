const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');
const { pathToFileURL } = require('node:url');
const { performance } = require('node:perf_hooks');

async function main() {
  if (process.argv.slice(2).join(' ') !== '--play-once') throw new Error('Explicit real-play verification mode is required');
  const root = path.resolve(__dirname, '..');
  const output = path.join(root, '.test-tmp/qq-recent-live');
  const marker = path.join(output, 'attempt.json');
  if (fs.existsSync(marker)) throw new Error('A cloud-write attempt already exists; automatic repeat is blocked');
  fs.mkdirSync(output, { recursive: true });
  const home = path.join(os.homedir(), '.tiaolv-music');
  const db = new DatabaseSync(path.join(home, 'listenmusic.db'), { readOnly: true });
  let account;
  try {
    account = db.prepare("SELECT provider_user_id, credential_reference FROM provider_accounts WHERE provider='qq' AND active=1 ORDER BY updated_at DESC LIMIT 1").get();
  } finally { db.close(); }
  if (!account || !/^qq-[a-z0-9-]+$/.test(account.credential_reference)) throw new Error('No active QQ credential');
  const directory = path.join(home, 'credentials');
  const key = Buffer.from(fs.readFileSync(path.join(directory, 'credential.key'), 'utf8').trim(), 'base64');
  const bytes = fs.readFileSync(path.join(directory, `${account.credential_reference}.bin`));
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, bytes.subarray(1, 13));
  decipher.setAuthTag(bytes.subarray(-16));
  const cookie = Buffer.concat([decipher.update(bytes.subarray(13, -16)), decipher.final()]).toString('utf8');
  key.fill(0);
  const uin = /(?:^|;\s*)uin=([^;]+)/.exec(cookie)?.[1].replace(/^o?0*/, '');
  if (uin !== String(account.provider_user_id).replace(/^o?0*/, '')) throw new Error('Account and credential mismatch');
  process.env.QQ_MUSIC_API_CONFIG_DIR = path.join(output, 'config');
  const { default: axios } = await import(pathToFileURL(path.join(root, 'music-api/qq-music-api/node_modules/axios/index.js')).href);
  const adapter = axios.getAdapter(axios.defaults.adapter);
  let qualified = false;
  let writes = 0;
  axios.defaults.adapter = async config => {
    const payload = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
    for (const rpc of Object.values(payload || {})) {
      if (!rpc?.module?.includes('Write')) continue;
      if (!qualified || rpc.module !== 'music.musicasset.PlayRecentlyWrite'
        || rpc.method !== 'ReportPlayRecentlyInfo' || writes !== 0) throw new Error('Unexpected account write blocked');
      writes++;
    }
    const response = await adapter(config);
    const data = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
    if (payload?.req_1) console.log(JSON.stringify({ method: payload.req_1.method, code: data?.req_1?.code,
      dataKeys: Object.keys(data?.req_1?.data || {}), ret: data?.req_1?.data?.ret }));
    return response;
  };
  const api = await import(pathToFileURL(path.join(root, 'music-api/qq-music-api/dist/services.js')).href);
  const timing = await import(pathToFileURL(path.join(root, 'electron/src/renderer/src/services/qqListeningSession.ts')).href);
  const mid = '0034QXzv2ptMdw';
  const playback = await api.getMusicPlay({ params: { songmid: mid, quality: '128' }, option: { headers: { Cookie: cookie } } });
  const url = playback.body.data?.playUrl?.[mid]?.url;
  if (!url || !/^https?:\/\//.test(url)) throw new Error('No real QQ audio URL; no report attempted');
  const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
  const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
  let session = timing.createQqListeningSession(uin, { id: `qq:${mid}`, title: '愿戴荣光坠入天渊', source: 'qq', duration: 232 });
  try {
    const page = await browser.newPage();
    await page.exposeFunction('observePlayback', (mediaTime, playing, duration) => {
      if (!playing) { session = timing.pauseQqListeningSession(session); return; }
      if (Number.isFinite(duration) && duration > 0) session.track.duration = duration;
      session = timing.sampleQqListeningPlayback(session, mediaTime, performance.now());
    });
    await page.goto('about:blank');
    await page.evaluate(async url => {
      const audio = document.createElement('audio'); audio.src = url; audio.volume = 0.15;
      document.body.append(audio);
      for (const event of ['play', 'pause', 'seeking', 'waiting', 'ended']) audio.addEventListener(event, () => {
        window.observePlayback(audio.currentTime, event === 'play', audio.duration);
      });
      setInterval(() => window.observePlayback(audio.currentTime, !audio.paused && !audio.seeking && audio.readyState >= 3, audio.duration), 250);
      await audio.play();
    }, url);
    const started = performance.now();
    while (session.totalListenedSeconds < 31 && performance.now() - started < 90_000) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    await page.evaluate(() => document.querySelector('audio').pause());
    const prepared = timing.beginQqRecentPlayReport(session);
    if (!prepared.payload) throw new Error('Real playback did not reach 30 seconds; no report attempted');
    qualified = true;
    const proof = { mid, sessionId: prepared.payload.sessionId, listenedSeconds: prepared.payload.listenedSeconds,
      totalSeconds: prepared.payload.totalSeconds, elapsedWallSeconds: (performance.now() - started) / 1000, writes: 0, time: new Date().toISOString() };
    fs.writeFileSync(marker, JSON.stringify(proof, null, 2), { flag: 'wx' });
    console.log(JSON.stringify({ kind: 'real-playback-proof', ...proof }));
    const result = await api.reportRecentPlay({ songMid: mid, sessionId: proof.sessionId,
      listenedSeconds: proof.listenedSeconds, totalSeconds: proof.totalSeconds, cookie });
    const response = result.body.response;
    const evidence = { ...proof, writes, status: result.status, confirmed: response?.confirmed === true,
      cloudCount: Array.isArray(response?.songList) ? response.songList.length : undefined,
      cloudMids: response?.songList?.map(row => row.track?.mid), error: result.body.error,
      requestCode: response?.req_1?.code };
    fs.writeFileSync(path.join(output, 'result.json'), JSON.stringify(evidence, null, 2));
    console.log(JSON.stringify({ kind: 'cloud-readback', ...evidence }));
    if (!evidence.confirmed || writes !== 1) throw new Error('QQ did not confirm this single report');
  } finally { await browser.close(); }
}
main().catch(() => { console.error('QQ recent verification did not complete; no automatic account-write retry will occur.'); process.exitCode = 1; });
