import { beforeEach, afterEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ recent: vi.fn(), rpc: vi.fn(), resolve: vi.fn() }));
vi.mock('../../../../../src/services/apis/user/getRecentPlay', () => ({ getRecentPlay: mocks.recent }));
vi.mock('../../../../../src/services/apis/user/userMusicu', () => ({ callUserMusicu: mocks.rpc }));
vi.mock('../../../../../src/services/apis/user/songFavorite', () => ({ resolveSong: mocks.resolve }));
import { reportRecentPlay } from '../../../../../src/services/apis/user/reportRecentPlay';

const now = 1791702000;
const options = {
  songMid: 'mid1', listenedSeconds: 30, totalSeconds: 180,
  sessionId: 'cf3dac35-7a99-4706-9c69-11a4742486a1', cookie: 'uin=200; qqmusic_key=test',
};
const snapshot = (lastTime = now, id = 11) => ({ status: 200, body: { response: {
  code: 0, req_1: { code: 0, data: { data: { songList: [{ track: { id, mid: 'mid1' }, lastTime }] } } },
} } });
const written = () => ({ status: 200, body: { response: { code: 0, req_1: { code: 0, data: { ret: 0 } } } } });

beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(now * 1000);
  mocks.resolve.mockReset().mockResolvedValue({ id: 11, type: 0 });
  mocks.rpc.mockReset().mockResolvedValue(written());
  mocks.recent.mockReset().mockResolvedValue(snapshot());
});
afterEach(() => vi.useRealTimers());
const session = () => ({ ...options, sessionId: crypto.randomUUID() });

it('reports the numeric song resource once and returns only a fresh confirmed cloud snapshot', async () => {
  const result = await reportRecentPlay(session());
  expect(result.status).toBe(200);
  expect(mocks.rpc).toHaveBeenCalledTimes(1);
  expect(mocks.rpc).toHaveBeenCalledWith(expect.objectContaining({
    module: 'music.musicasset.PlayRecentlyWrite', method: 'ReportPlayRecentlyInfo',
    param: { data: [{ id: '11', type: 2, lastTime: now, listenCnt: 1 }] }, useOriginalSession: true,
  }));
  expect(result.body.response).toEqual(expect.objectContaining({ confirmed: true, songList: snapshot().body.response.req_1.data.data.songList }));
  expect(mocks.recent).toHaveBeenCalledWith({ cookie: options.cookie, useOriginalSession: true });
});

it('shares one terminal attempt for concurrent and subsequent duplicate session requests', async () => {
  const input = session();
  const [a, b] = await Promise.all([reportRecentPlay(input), reportRecentPlay(input)]);
  expect(a).toEqual(b);
  expect(await reportRecentPlay(input)).toEqual(a);
  expect(mocks.rpc).toHaveBeenCalledTimes(1);
});

it('rejects reuse of the same account/session UUID for a different song', async () => {
  const input = session();
  await reportRecentPlay(input);
  expect((await reportRecentPlay({ ...input, songMid: 'otherMid' })).status).toBe(409);
  expect(mocks.rpc).toHaveBeenCalledTimes(1);
});

it('rejects short playback, invalid duration, malformed UUID and missing account before network use', async () => {
  for (const change of [{ listenedSeconds: 29 }, { listenedSeconds: NaN }, { totalSeconds: 0 },
    { listenedSeconds: 181 }, { sessionId: 'bad' }, { cookie: '' }, { songMid: '../other' }]) {
    expect((await reportRecentPlay({ ...session(), ...change })).status).toBe(400);
  }
  expect(mocks.rpc).not.toHaveBeenCalled(); expect(mocks.recent).not.toHaveBeenCalled();
});

it('never writes after explicit private-login rejection', async () => {
  mocks.recent.mockResolvedValue({ status: 200, body: { response: { code: 0, req_1: { code: 1000 } } } });
  const result = await reportRecentPlay(session());
  expect(result.body.response).toEqual(expect.objectContaining({ req_1: { code: 1000 } }));
  expect(mocks.rpc).not.toHaveBeenCalled();
});

it('preserves nested private-read rejection even when a stale array is present', async () => {
  const denied = snapshot();
  Object.assign(denied.body.response.req_1.data, { code: 1000 });
  mocks.recent.mockResolvedValue(denied);
  const result = await reportRecentPlay(session());
  expect(result.body.response).toEqual(denied.body.response);
  expect(mocks.rpc).not.toHaveBeenCalled();
});

it('preserves rate limiting and caches failure rather than repeating the write', async () => {
  const input = session(); mocks.rpc.mockResolvedValue({ status: 429, body: { error: 'limited' } });
  expect((await reportRecentPlay(input)).status).toBe(429);
  expect((await reportRecentPlay(input)).status).toBe(429);
  expect(mocks.rpc).toHaveBeenCalledTimes(1);
});

it('does not accept missing business confirmation or inner failure', async () => {
  for (const data of [{}, { ret: 1 }]) {
    mocks.rpc.mockResolvedValue({ status: 200, body: { response: { code: 0, req_1: { code: 0, data } } } });
    expect((await reportRecentPlay(session())).status).toBe(502);
  }
});

it('does not turn a business rejection into success or retry it', async () => {
  mocks.rpc.mockResolvedValue({ status: 200, body: { response: { code: 0, req_1: { code: 80105, data: { ret: 0 } } } } });
  const input = session();
  const result = await reportRecentPlay(input);
  expect(result.body.response).toEqual(expect.objectContaining({ req_1: { code: 80105, data: { ret: 0 } } }));
  await reportRecentPlay(input); expect(mocks.rpc).toHaveBeenCalledTimes(1);
});

it('rejects unsafe or unsupported resource identities before writing', async () => {
  for (const resolved of [{ id: Number.MAX_SAFE_INTEGER + 1, type: 0 }, { id: 11, type: 1 }, { id: 0, type: 0 }]) {
    mocks.resolve.mockResolvedValue(resolved);
    expect((await reportRecentPlay(session())).status).toBe(502);
  }
  expect(mocks.rpc).not.toHaveBeenCalled();
});

it('allows bounded read-only propagation checks but never accepts stale/wrong-song history', async () => {
  mocks.recent.mockResolvedValue(snapshot(now - 10));
  const resultPromise = reportRecentPlay(session());
  await vi.runAllTimersAsync();
  expect((await resultPromise).status).toBe(502);
  expect(mocks.rpc).toHaveBeenCalledTimes(1);
  expect(mocks.recent).toHaveBeenCalledTimes(4);
});
