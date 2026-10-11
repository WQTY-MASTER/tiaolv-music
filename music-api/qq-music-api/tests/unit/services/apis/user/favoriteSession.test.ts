import { beforeEach, describe, expect, it, vi } from 'vitest';
import { responseBytes, decodeRequest } from '../../../../helpers/ag1';

const { requestMock, uCommonMock } = vi.hoisted(() => ({ requestMock: vi.fn(), uCommonMock: vi.fn() }));
vi.mock('../../../../../src/util/request', () => ({ default: requestMock }));
vi.mock('../../../../../src/services/apis/u_common', () => ({ default: uCommonMock }));

const cookie = 'uin=200; qm_keyst=expired; qqmusic_key=expired; tmeLoginType=2; psrf_qqopenid=open; psrf_qqaccess_token=access; psrf_qqrefresh_token=refresh';
const denied = { data: { code: 0, req_1: { code: 1000 } } };
const authenticated = { data: { code: 0, req_1: { code: 0, data: { m_fan: { target: false } } } } };
const renewal = { data: { code: 0, req_1: { code: 0, data: { musicid: 200, musickey: 'renewed', loginType: 2 } } } };
const written = { data: { code: 0, req_1: { code: 0, data: { retCode: 0 } } } };
const requestBody = (request: any) => JSON.parse(request.options.params?.encoding === 'ag-1' ? decodeRequest(request.options.data) : request.options.data);
const reply = (request: any, result: { data: unknown }) => ({ data: request.options.params?.encoding === 'ag-1' ? responseBytes(result.data) : result.data });
const payloads = () => requestMock.mock.calls.map(([request]) => requestBody(request));

describe('favorite authentication before account writes', () => {
  beforeEach(() => {
    vi.resetModules();
    requestMock.mockReset();
    uCommonMock.mockReset().mockResolvedValue({ data: { songinfo: { data: { track_info: { id: 123, type: 0 } } } } });
  });

  it('requires a fresh web login when the original favorite ticket is expired', async () => {
    requestMock.mockImplementation(async request => {
      const body = requestBody(request);
      if (body.req_1.method === 'IsSongFanByMid') return reply(request, request.cookie.includes('qqmusic_key=renewed') ? authenticated : denied);
      if (body.req_1.method === 'Login') return renewal;
      return reply(request, request.cookie.includes('qqmusic_key=renewed') ? written : { data: { code: 0, req_1: { code: 80105 } } });
    });
    const { setSongFavorite } = await import('../../../../../src/services/apis/user/songFavorite');
    const result = await setSongFavorite({ songMid: 'target', liked: true, cookie });
    expect(result.body.response).toEqual(denied.data);
    expect(payloads().map(body => body.req_1.method)).toEqual(['IsSongFanByMid']);
  });

  it('does not write or silently refresh when favorite authentication fails', async () => {
    requestMock.mockImplementation(async request => reply(request, denied));
    const { setSongFavorite } = await import('../../../../../src/services/apis/user/songFavorite');
    const result = await setSongFavorite({ songMid: 'target', liked: true, cookie });
    expect(result.body.response).toEqual(denied.data);
    expect(payloads().map(body => body.req_1.method)).toEqual(['IsSongFanByMid']);
  });

  it('does not substitute a cached read-only renewal for the original web favorite ticket', async () => {
    requestMock.mockImplementation(async request => {
      const body = requestBody(request);
      if (body.req_1.method === 'Login') return renewal;
      return reply(request, request.cookie.includes('qqmusic_key=renewed') ? authenticated : denied);
    });
    const { callUserMusicu } = await import('../../../../../src/services/apis/user/userMusicu');
    const read = await callUserMusicu({ module: 'music.musicasset.PlayRecentlyRead', method: 'GetPlayRecentlyInfo', param: {}, cookie });
    expect(read.body.response).toEqual(authenticated.data);
    const { setSongFavorite } = await import('../../../../../src/services/apis/user/songFavorite');
    const favorite = await setSongFavorite({ songMid: 'target', liked: true, cookie });
    expect(favorite.body.response).toEqual(denied.data);
    expect(payloads().map(body => body.req_1.method)).toEqual(['GetPlayRecentlyInfo', 'Login', 'GetPlayRecentlyInfo', 'IsSongFanByMid']);
    expect(requestMock.mock.calls.at(-1)?.[0].cookie).toBe(cookie);
  });

  it('sends exactly one favorite write with a valid original web ticket', async () => {
    requestMock.mockImplementation(async request => reply(request, requestBody(request).req_1.method === 'IsSongFanByMid' ? authenticated : written));
    const { setSongFavorite } = await import('../../../../../src/services/apis/user/songFavorite');
    const valid = cookie.replaceAll('expired', 'fresh-web-ticket');
    const result = await setSongFavorite({ songMid: 'target', liked: true, cookie: valid });
    expect(result.body.response).toEqual(written.data);
    expect(payloads().map(body => body.req_1.method)).toEqual(['IsSongFanByMid', 'AddSonglist']);
    expect(requestMock.mock.calls.every(([request]) => request.cookie === valid)).toBe(true);
  });

  it('does not blindly retry 80105 after authentication was confirmed', async () => {
    requestMock.mockImplementation(async request => reply(request, requestBody(request).req_1.method === 'IsSongFanByMid' ? authenticated : { data: { code: 0, req_1: { code: 80105, data: { retCode: 0 } } } }));
    const { setSongFavorite } = await import('../../../../../src/services/apis/user/songFavorite');
    const result = await setSongFavorite({ songMid: 'target', liked: true, cookie });
    expect(result.body.response).toMatchObject({ req_1: { code: 80105 } });
    expect(payloads().map(body => body.req_1.method)).toEqual(['IsSongFanByMid', 'AddSonglist']);
  });

  it('does not accept an incomplete successful-looking authentication response', async () => {
    requestMock.mockResolvedValue({ data: responseBytes({ code: 0, req_1: { code: 0, data: {} } }) });
    const { setSongFavorite } = await import('../../../../../src/services/apis/user/songFavorite');
    const result = await setSongFavorite({ songMid: 'target', liked: true, cookie });
    expect(result.status).toBe(502);
    expect(payloads().map(body => body.req_1.method)).toEqual(['IsSongFanByMid']);
  });

  it('does not send an add when the authenticated state is already favorite', async () => {
    requestMock.mockResolvedValue({ data: responseBytes({ code: 0, req_1: { code: 0, data: { m_fan: { target: true } } } }) });
    const { setSongFavorite } = await import('../../../../../src/services/apis/user/songFavorite');
    expect((await setSongFavorite({ songMid: 'target', liked: true, cookie })).body.response).toEqual(written.data);
    expect(payloads().map(body => body.req_1.method)).toEqual(['IsSongFanByMid']);
  });

  it('does not send a removal when the authenticated state is already absent', async () => {
    requestMock.mockResolvedValue({ data: responseBytes(authenticated.data) });
    const { setSongFavorite } = await import('../../../../../src/services/apis/user/songFavorite');
    expect((await setSongFavorite({ songMid: 'target', liked: false, cookie })).body.response).toEqual(written.data);
    expect(payloads().map(body => body.req_1.method)).toEqual(['IsSongFanByMid']);
  });
});
