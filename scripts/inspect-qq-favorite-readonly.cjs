const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');
const { pathToFileURL } = require('node:url');

const root = path.resolve(__dirname, '..');
const mid = '0034QXzv2ptMdw';
async function main() {
  const args = process.argv.slice(2);
  if (args.length > 1 || args.some(arg => !['--official-web', '--ag1', '--official-add-once', '--confirm-relogin', '--inspect-recent'].includes(arg))) throw new Error('Unsupported inspection mode');
  const officialAdd = args.includes('--official-add-once');
  const home = path.join(os.homedir(), '.tiaolv-music');
  const db = new DatabaseSync(path.join(home, 'listenmusic.db'), { readOnly: true });
  let account;
  try {
    account = db.prepare("SELECT provider_user_id, credential_reference FROM provider_accounts WHERE provider='qq' AND active=1 ORDER BY updated_at DESC LIMIT 1").get();
  } finally { db.close(); }
  if (!account || !/^qq-[a-z0-9-]+$/.test(account.credential_reference)) throw new Error('No active QQ credential');
  const dir = path.join(home, 'credentials');
  const key = Buffer.from(fs.readFileSync(path.join(dir, 'credential.key'), 'utf8').trim(), 'base64');
  const bytes = fs.readFileSync(path.join(dir, `${account.credential_reference}.bin`));
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, bytes.subarray(1, 13));
  decipher.setAuthTag(bytes.subarray(-16));
  const cookie = Buffer.concat([decipher.update(bytes.subarray(13, -16)), decipher.final()]).toString('utf8');
  key.fill(0);
  process.env.QQ_MUSIC_API_CONFIG_DIR = path.join(root, '.test-tmp/qq-favorite-readonly/config');
  const values = new Map(cookie.split(';').map(part => {
    const i = part.indexOf('='); return [part.slice(0, i).trim(), part.slice(i + 1).trim()];
  }));
  const gtk = text => [...text].reduce((hash, c) => (hash * 33 + c.charCodeAt(0)) | 0, 5381) & 0x7fffffff;
  const uin = String(account.provider_user_id).replace(/^o/, '').replace(/^0+/, '');
  console.log(JSON.stringify({ writes: 0, cookieFields: [...values.keys()], accountMatchesCookie: uin === (values.get('uin') || '').replace(/^o/, '').replace(/^0+/, '') }));
  const { default: axios } = await import(pathToFileURL(path.join(root, 'music-api/qq-music-api/node_modules/axios/index.js')).href);
  const { decodeAG1Request, decodeAG1Response } = await import(pathToFileURL(path.join(root, 'music-api/qq-music-api/node_modules/@jixun/qmweb-sign/dist/node.mjs')).href);
  const adapter = axios.getAdapter(axios.defaults.adapter);
  let effectiveCookie = cookie;
  axios.defaults.adapter = async config => {
    const encrypted = config.params?.encoding === 'ag-1';
    const payload = typeof config.data === 'string' ? JSON.parse(encrypted ? await decodeAG1Request(config.data) : config.data) : config.data;
    const operation = payload?.req_1;
    if ((args.includes('--confirm-relogin') || args.includes('--inspect-recent')) && operation?.module?.includes('Write')) throw new Error('Account write blocked during read-back');
    if (operation && operation.method !== 'Login') effectiveCookie = config.headers.Cookie || cookie;
    const response = await adapter(config);
    const data = encrypted ? JSON.parse(decodeAG1Response(new Uint8Array(response.data))) : typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
    if (operation) console.log(JSON.stringify({ kind: 'api-auth-chain', method: operation.method,
      ct: payload.comm?.ct, requestCookieUpdated: config.headers.Cookie !== cookie,
      code: data?.req_1?.code }));
    return response;
  };
  const api = await import(pathToFileURL(path.join(root, 'music-api/qq-music-api/dist/services.js')).href);
  if (args.includes('--inspect-recent')) {
    const result = await api.getRecentPlay({ cookie });
    const response = result.body.response;
    const rows = response?.req_1?.data?.data?.songList;
    if (result.status !== 200 || response?.code !== 0 || response.req_1?.code !== 0 || !Array.isArray(rows)) {
      throw new Error('Incomplete QQ recent playback snapshot');
    }
    const db = new DatabaseSync(path.join(home, 'listenmusic.db'), { readOnly: true });
    let local;
    try {
      local = db.prepare(`SELECT count(DISTINCT track_id) AS tracks,
        coalesce(sum(play_count), 0) AS plays, coalesce(sum(listened_seconds), 0) AS seconds
        FROM qq_listening_day_stats WHERE account_id=?`).get(account.provider_user_id);
    } finally { db.close(); }
    console.log(JSON.stringify({ kind: 'recent-readback', writes: 0, cloudCount: rows.length,
      cloudTracks: rows.map(row => ({ title: row.track?.title || row.track?.name || '', mid: row.track?.mid || '' })),
      localStats: local }));
    return;
  }
  const liked = await api.getUserLikedSongs({ cookie, uin, offset: 0, limit: 100 });
  const data = liked.body.response?.req_1?.data;
  console.log(JSON.stringify({ kind: 'favorite-list', code: liked.body.response?.req_1?.code, count: data?.songlist?.length,
    types: [...new Set((data?.songlist || []).map(song => song.type ?? song.songtype))],
    targetPresent: (data?.songlist || []).some(song => (song.mid || song.songmid) === mid) }));
  const recent = await api.getRecentPlay({ cookie });
  console.log(JSON.stringify({ kind: 'private-read', status: recent.status, code: recent.body.response?.req_1?.code }));
  if (args.includes('--confirm-relogin')) {
    const songs = [];
    let complete = false;
    for (let offset = 0; offset < 10000; offset += 100) {
      const result = await api.getUserLikedSongs({ cookie, uin, offset, limit: 100 });
      const response = result.body.response;
      const data = response?.req_1?.data;
      if (result.status !== 200 || response?.code !== 0 || response.req_1?.code !== 0 || !Array.isArray(data?.songlist)) throw new Error('Incomplete favorites snapshot');
      songs.push(...data.songlist, ...(Array.isArray(data.filtered_song) ? data.filtered_song : []));
      if (data.hasmore === 0 || data.hasmore === false) { complete = true; break; }
      if (data.hasmore !== 1 && data.hasmore !== true) throw new Error('Incomplete favorites pagination');
    }
    if (!complete) throw new Error('Incomplete favorites snapshot');
    const matches = songs.filter(song => String(song.title || song.name || song.songname || '').includes('远航'));
    const confirmed = { kind: 'relogin-readback', writes: 0, complete, count: songs.length,
      officialAddedSongPresent: songs.some(song => (song.mid || song.songmid) === mid),
      newlyAddedSongs: matches.map(song => ({ title: song.title || song.name || song.songname, mid: song.mid || song.songmid })) };
    console.log(JSON.stringify(confirmed));
    if (!matches.length) process.exitCode = 1;
    if (confirmed.officialAddedSongPresent) {
      const result = await api.setSongFavorite({ songMid: mid, liked: true, cookie });
      const noopConfirmed = result.status === 200 && result.body.response?.code === 0 && result.body.response?.req_1?.code === 0;
      console.log(JSON.stringify({ kind: 'original-web-session-noop', writes: 0, confirmed: noopConfirmed }));
      if (!noopConfirmed) process.exitCode = 1;
    }
    return;
  }
  const current = new Map(effectiveCookie.split(';').map(part => {
    const i = part.indexOf('='); return [part.slice(0, i).trim(), part.slice(i + 1).trim()];
  }));
  const webKey = current.get('qqmusic_key') || '';
  const musicKey = current.get('qm_keyst') || webKey;
  if (process.argv.includes('--official-web') || officialAdd) {
    const { decodeAG1Request } = await import(pathToFileURL(path.join(root, 'music-api/qq-music-api/node_modules/@jixun/qmweb-sign/dist/node.mjs')).href);
    let target;
    let before = [];
    async function readAllFavorites() {
      const songs = [];
      for (let offset = 0; offset < 10000; offset += 100) {
        const result = await api.getUserLikedSongs({ cookie, uin, offset, limit: 100 });
        const response = result.body.response;
        const data = response?.req_1?.data;
        if (result.status !== 200 || response?.code !== 0 || response.req_1?.code !== 0 || !Array.isArray(data?.songlist)) throw new Error('Incomplete favorites snapshot');
        songs.push(...data.songlist, ...(data.filtered_song || []));
        if (data.hasmore === 0 || data.hasmore === false) return songs;
        if (data.hasmore !== 1 && data.hasmore !== true) throw new Error('Incomplete favorites pagination');
      }
      throw new Error('Too many favorites');
    }
    const isTarget = song => (song.mid || song.songmid) === mid;
    if (officialAdd) {
      before = await readAllFavorites();
      if (before.some(isTarget)) { console.log(JSON.stringify({ writes: 0, skippedAlreadyFavorite: true })); return; }
      const reply = await (await fetch('https://u.y.qq.com/cgi-bin/musicu.fcg', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comm: { uin: 0, ct: 24, cv: 0 }, req_1: { module: 'music.pf_song_detail_svr', method: 'get_song_detail_yqq', param: { song_mid: mid, song_type: 0, song_id: 0 } } }), signal: AbortSignal.timeout(15000) })).json();
      target = reply.req_1?.data?.track_info;
      if (reply.code !== 0 || reply.req_1?.code !== 0 || target?.mid !== mid || !Number.isSafeInteger(target.id) || !Number.isInteger(target.type)) throw new Error('Target identity not confirmed');
    }
    const marker = path.join(root, '.test-tmp/qq-favorite-once/result-official-sdk.json');
    if (officialAdd && fs.existsSync(marker)) throw new Error('Official SDK write was already attempted');
    const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/WQTY/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    try {
      const context = await browser.newContext();
      let authenticatedRead = false;
      let requests = 0;
      let writes = 0;
      let allowWrite = false;
      await context.route('**/*', async route => {
        const url = new URL(route.request().url());
        if (authenticatedRead) {
          if (url.hostname === 'u6.y.qq.com' && url.pathname === '/cgi-bin/musics.fcg') {
            let body;
            const raw = route.request().postDataBuffer();
            const text = raw?.toString('utf8') || '';
            try { body = JSON.parse(await decodeAG1Request(text)); } catch {
              console.log(JSON.stringify({ kind: 'blocked-undecoded-official-request', byteLength: raw?.length, looksBase64: /^[A-Za-z0-9+/]+=*$/.test(text), contentType: route.request().headers()['content-type'] }));
              return route.abort();
            }
            if (Object.keys(body).some(key => !['comm', 'req_1'].includes(key))) return route.abort();
            const operation = body.req_1;
            const read = operation?.module === 'music.musicasset.SongFavRead' && operation.method === 'IsSongFanByMid'
              && JSON.stringify(operation.param) === JSON.stringify({ v_songMid: [mid] });
            const add = officialAdd && allowWrite && writes === 0 && operation?.module === 'music.musicasset.PlaylistDetailWrite'
              && operation.method === 'AddSonglist'
              && JSON.stringify(operation.param) === JSON.stringify({ dirId: 201, v_songInfo: [{ songType: target.type, songId: target.id }] });
            if ((!read && !add) || (read && requests > 0)) return route.abort();
            if (add) writes++;
            requests++;
            console.log(JSON.stringify({ kind: 'official-transport', method: operation.method, encoding: url.searchParams.get('encoding'), contentType: route.request().headers()['content-type'] }));
            return route.continue();
          }
          console.log(JSON.stringify({ kind: 'blocked-sdk-request', host: url.hostname, path: url.pathname }));
          return route.abort();
        }
        if (/music[us]\.fcg$/.test(url.pathname)) return route.fulfill({ json: { code: 0, req_1: { code: 0, data: {} } } });
        return route.continue();
      });
      const page = await context.newPage();
      await page.goto('https://y.qq.com/n/ryqq/player', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForFunction(() => window.webpackJsonp && window.webpackJsonp.length > 0, { timeout: 30000 });
      await page.evaluate(() => window.webpackJsonp.push([[99991], {
        99991: function(module, exports, require) { window.__QQSdk = require(8); },
      }, [[99991]]]));
      await page.waitForFunction(() => window.__QQSdk && typeof window.__QQSdk.j === 'function');
      await context.addCookies([...current].map(([name, value]) => ({ name, value, domain: '.qq.com', path: '/', secure: true })));
      authenticatedRead = true;
      const result = await page.evaluate(async target => {
        try {
          window.__QQFavoriteSdk = new window.__QQSdk.a({ retry: false, reportCode: false });
          const [reply] = await window.__QQFavoriteSdk.request([{ module: 'music.musicasset.SongFavRead', method: 'IsSongFanByMid', param: { v_songMid: [target] } }]);
          return { code: reply.code, targetFavorite: reply.data?.m_fan?.[target] };
        } catch (error) {
          return { failed: true, errorType: typeof error, errorName: error?.name,
            errorCode: error?.code, keys: error && typeof error === 'object' ? Object.keys(error) : [],
            reason: error?.message && !/[=]|https?:|cookie|token|uin/i.test(error.message) ? error.message.slice(0, 160) : undefined };
        }
      }, mid);
      console.log(JSON.stringify({ kind: 'official-favorite-status', writes: 0, requests, ...result }));
      if (officialAdd) {
        if (result.code !== 0 || typeof result.targetFavorite !== 'boolean') throw new Error('Official private authentication failed');
        if (result.targetFavorite) { console.log(JSON.stringify({ writes: 0, skippedAlreadyFavorite: true })); return; }
        fs.mkdirSync(path.dirname(marker), { recursive: true });
        fs.writeFileSync(marker, JSON.stringify({ state: 'started', at: new Date().toISOString() }), { flag: 'wx' });
        allowWrite = true;
        const write = await page.evaluate(async song => {
          try {
            const [reply] = await window.__QQFavoriteSdk.request([{ module: 'music.musicasset.PlaylistDetailWrite', method: 'AddSonglist',
              param: { dirId: 201, v_songInfo: [{ songType: song.type, songId: song.id }] } }]);
            return { requestCode: reply.code, retCode: reply.data?.retCode };
          } catch { return { failed: true }; }
        }, { id: target.id, type: target.type });
        allowWrite = false;
        const after = await readAllFavorites();
        const songKey = song => `${song.id ?? song.songid}:${song.type ?? song.songtype ?? 0}`;
        const afterKeys = new Set(after.map(songKey));
        const verified = { kind: 'official-sdk-add', writes, ...write, beforeCount: before.length, afterCount: after.length,
          presentAfter: after.some(isTarget), existingFavoritesPreserved: before.every(song => afterKeys.has(songKey(song))), at: new Date().toISOString() };
        fs.writeFileSync(marker, JSON.stringify(verified, null, 2));
        console.log(JSON.stringify(verified));
        if (!verified.presentAfter || !verified.existingFavoritesPreserved || verified.requestCode !== 0) process.exitCode = 1;
      }
    } finally { await browser.close(); }
    return;
  }
  const headers = { Cookie: effectiveCookie, Referer: 'https://y.qq.com/', 'Content-Type': 'application/json',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' };
  const base = { cv: 4747474, format: 'json', inCharset: 'utf-8', outCharset: 'utf-8', needNewCode: 1, platform: 'yqq.json', uin: uin.length < 14 ? Number(uin) : uin };
  if (process.argv.includes('--ag1')) {
    const { encodeAG1Request, decodeAG1Response, zzcSign } = await import(pathToFileURL(path.join(root, 'music-api/qq-music-api/node_modules/@jixun/qmweb-sign/dist/node.mjs')).href);
    const text = JSON.stringify({ comm: { ...base, ct: 24, g_tk: gtk(current.get('skey') || webKey), g_tk_new_20200303: gtk(webKey || current.get('p_skey') || '') },
      req_1: { module: 'music.musicasset.SongFavRead', method: 'IsSongFanByMid', param: { v_songMid: [mid] } } });
    const response = await fetch(`https://u6.y.qq.com/cgi-bin/musics.fcg?encoding=ag-1&sign=${zzcSign(text)}`, {
      method: 'POST', headers: { ...headers, 'Content-Type': 'text/plain' }, body: await encodeAG1Request(text), signal: AbortSignal.timeout(15000),
    });
    const result = JSON.parse(decodeAG1Response(await response.arrayBuffer()));
    console.log(JSON.stringify({ kind: 'ag1-favorite-status', writes: 0, status: response.status, code: result.code, requestCode: result.req_1?.code, targetFavorite: result.req_1?.data?.m_fan?.[mid] }));
    return;
  }
  for (const comm of [
    { ...base, ct: 24, g_tk: gtk(current.get('skey') || webKey), g_tk_new_20200303: gtk(webKey || current.get('p_skey') || '') },
    { ...base, ct: 19, cv: 0, authst: musicKey, tmeLoginType: Number(current.get('tmeLoginType') || 2) },
    { ...base, ct: 20, authst: musicKey, g_tk: gtk(musicKey) },
  ]) {
    const response = await fetch('https://u.y.qq.com/cgi-bin/musicu.fcg', { method: 'POST', headers,
      body: JSON.stringify({ comm, req_1: { module: 'music.musicasset.SongFavRead', method: 'IsSongFanByMid', param: { v_songMid: [mid] } } }),
      signal: AbortSignal.timeout(15000) });
    const reply = await response.json();
    console.log(JSON.stringify({ kind: 'favorite-status', ct: comm.ct, code: reply.code, requestCode: reply.req_1?.code, targetFavorite: reply.req_1?.data?.m_fan?.[mid] }));
  }
}
main().catch(() => { console.error('QQ inspection could not complete. No automatic account-write retry was performed.'); process.exitCode = 1; });
