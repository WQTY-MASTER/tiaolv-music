const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { pathToFileURL } = require('node:url');
const { DatabaseSync } = require('node:sqlite');

const root = path.resolve(__dirname, '..');
const mid = '0034QXzv2ptMdw';
const output = path.join(root, '.test-tmp/qq-favorite-once');
const args = process.argv.slice(2);
if (args.length > 1 || args.some(arg => !['--inspect-auth', '--verify-session-fix', '--verify-ag1-fix'].includes(arg))) throw new Error('Unsupported verification mode');
const marker = path.join(output, args.includes('--verify-ag1-fix') ? 'result-ag1-fix.json' : args.includes('--verify-session-fix') ? 'result-session-fix.json' : 'result.json');

async function main() {
  fs.mkdirSync(output, { recursive: true });
  process.env.QQ_MUSIC_API_CONFIG_DIR = path.join(output, 'isolated-config');
  const home = path.join(os.homedir(), '.tiaolv-music');
  const db = new DatabaseSync(path.join(home, 'listenmusic.db'), { readOnly: true });
  let account;
  try {
    account = db.prepare("SELECT provider_user_id, credential_reference FROM provider_accounts WHERE provider='qq' AND active=1 ORDER BY updated_at DESC LIMIT 1").get();
  } finally {
    db.close();
  }
  if (!account || !/^qq-[a-z0-9-]+$/.test(account.credential_reference)) throw new Error('Active QQ credential not found');
  const directory = path.join(home, 'credentials');
  const key = Buffer.from(fs.readFileSync(path.join(directory, 'credential.key'), 'utf8').trim(), 'base64');
  const encrypted = fs.readFileSync(path.join(directory, `${account.credential_reference}.bin`));
  if (encrypted[0] !== 1 || encrypted.length < 30) throw new Error('Unsupported credential format');
  const cipher = crypto.createDecipheriv('aes-256-gcm', key, encrypted.subarray(1, 13));
  cipher.setAuthTag(encrypted.subarray(-16));
  const cookie = Buffer.concat([cipher.update(encrypted.subarray(13, -16)), cipher.final()]).toString('utf8');
  key.fill(0);
  if (args.includes('--inspect-auth')) {
    const values = new Map(cookie.split(';').map(part => {
      const separator = part.indexOf('=');
      return [part.slice(0, separator).trim(), part.slice(separator + 1).trim()];
    }));
    const value = name => values.get(name) || '';
    const oldKey = value('qm_keyst') || value('qqmusic_key') || value('p_skey');
    const legacyKey = value('skey') || value('qqmusic_key');
    const modernKey = value('qqmusic_key') || value('p_skey') || value('skey') || value('p_lskey') || value('lskey');
    console.log(JSON.stringify({ writes: 0, networkRequests: 0,
      presentKeys: ['skey', 'p_skey', 'qqmusic_key', 'qm_keyst', 'p_lskey', 'lskey'].filter(name => value(name)),
      legacyTicketChanged: oldKey !== legacyKey, modernTicketChanged: oldKey !== modernKey }));
    return;
  }
  const { default: axios } = await import(pathToFileURL(path.join(root, 'music-api/qq-music-api/node_modules/axios/index.js')).href);
  const adapter = axios.getAdapter(axios.defaults.adapter);
  const { decodeAG1Request, decodeAG1Response } = await import(pathToFileURL(path.join(root, 'music-api/qq-music-api/node_modules/@jixun/qmweb-sign/dist/node.mjs')).href);
  let writes = 0;
  const chain = [];
  axios.defaults.adapter = async config => {
    const encrypted = config.params?.encoding === 'ag-1';
    const payload = typeof config.data === 'string' ? JSON.parse(encrypted ? await decodeAG1Request(config.data) : config.data) : config.data;
    const operation = payload?.req_1;
    if (operation?.module === 'music.musicasset.PlaylistDetailWrite') {
      if (operation.method !== 'AddSonglist' || writes !== 0) throw new Error('Unexpected account write blocked');
      writes++;
    }
    const result = await adapter(config);
    if (operation) {
      const response = encrypted ? JSON.parse(decodeAG1Response(new Uint8Array(result.data))) : typeof result.data === 'string' ? JSON.parse(result.data) : result.data;
      chain.push({ method: operation.method, encrypted, code: response?.req_1?.code });
    }
    return result;
  };
  const api = await import(pathToFileURL(path.join(root, 'music-api/qq-music-api/dist/services.js')).href);
  async function readFavorites() {
    const songs = [];
    for (let offset = 0; offset < 10000; offset += 100) {
      const reply = await api.getUserLikedSongs({ uin: account.provider_user_id, cookie, offset, limit: 100 });
      const envelope = reply.body.response;
      const data = envelope?.req_1?.data;
      if (reply.status !== 200 || envelope?.code !== 0 || envelope.req_1?.code !== 0
        || !data || (data.code !== undefined && data.code !== 0) || !Array.isArray(data.songlist)) throw new Error('QQ favorites read was not confirmed');
      songs.push(...data.songlist, ...(Array.isArray(data.filtered_song) ? data.filtered_song : []));
      if (data.hasmore === 0 || data.hasmore === false) return songs;
      if (data.hasmore !== 1 && data.hasmore !== true) throw new Error('QQ favorites pagination was not confirmed');
    }
    throw new Error('QQ favorites exceed verification limit');
  }
  const before = await readFavorites();
  const isTarget = song => String(song.mid || song.songmid || '') === mid;
  if (before.some(isTarget)) {
    console.log(JSON.stringify({ target: mid, skippedAlreadyFavorite: true, count: before.length, writes: 0 }));
    return;
  }
  // Exclusive marker prevents rerunning an uncertain account write.
  fs.writeFileSync(marker, JSON.stringify({ target: mid, state: 'started', at: new Date().toISOString() }), { flag: 'wx' });
  const reply = await api.setSongFavorite({ songMid: mid, liked: true, cookie });
  const after = await readFavorites();
  const songKey = song => `${song.id ?? song.songid}:${song.type ?? song.songtype ?? 0}`;
  const afterKeys = new Set(after.map(songKey));
  const response = reply.body.response;
  const result = { target: mid, writes, chain, status: reply.status, code: response?.code,
    requestCode: response?.req_1?.code, retCode: response?.req_1?.data?.retCode,
    beforeCount: before.length, afterCount: after.length, presentAfter: after.some(isTarget),
    existingFavoritesPreserved: before.every(song => afterKeys.has(songKey(song))), at: new Date().toISOString() };
  fs.writeFileSync(marker, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
  if (!result.presentAfter || !result.existingFavoritesPreserved || result.status !== 200
    || result.code !== 0 || result.requestCode !== 0 || (result.retCode !== undefined && result.retCode !== 0)) process.exitCode = 1;
}
main().catch(() => { console.error('QQ favorite verification could not complete. No automatic retry was performed.'); process.exitCode = 1; });
