import { responseBytes, decodeRequest } from '../../../../helpers/ag1';
import { beforeEach, describe, expect, it, vi } from 'vitest';
const { requestMock } = vi.hoisted(() => ({ requestMock: vi.fn() }));
vi.mock('../../../../../src/util/request', () => ({ default: requestMock }));
import { callUserMusicu, zzcSign } from '../../../../../src/services/apis/user/userMusicu';

const options = { module: 'music.musicasset.PlaylistDetailWrite', method: 'AddSonglist',
  param: { dirId: 201, v_songInfo: [{ songId: 123, songType: 0 }] }, cookie: 'uin=200; qqmusic_key=private',
  signed: true, webClient: true, encryptedWeb: true };

describe('official Web ag-1 transport', () => {
  beforeEach(() => requestMock.mockReset());
  it('encrypts the exact signed payload, sends text/plain to u6, and decodes the business response', async () => {
    const response = { code: 0, req_1: { code: 0, data: { retCode: 0 } } };
    requestMock.mockResolvedValue({ data: responseBytes(response) });
    const result = await callUserMusicu(options);
    expect(result.body.response).toEqual(response);
    const request = requestMock.mock.calls[0][0];
    expect(request.url).toBe('https://u6.y.qq.com/cgi-bin/musics.fcg');
    expect(request.options.headers['Content-Type']).toBe('text/plain');
    expect(request.options.responseType).toBe('arraybuffer');
    expect(request.options.params.encoding).toBe('ag-1');
    const plaintext = decodeRequest(request.options.data);
    expect(JSON.parse(plaintext).req_1).toEqual({ module: options.module, method: options.method, param: options.param });
    expect(request.options.params.sign).toBe(zzcSign(plaintext));
    expect(request.options.data).not.toContain('private');
    expect(requestMock).toHaveBeenCalledTimes(1);
  });

  it('preserves a decoded business rejection without replaying the write', async () => {
    const response = { code: 0, req_1: { code: 80105, data: { retCode: 0 } } };
    requestMock.mockResolvedValue({ data: responseBytes(response) });
    expect((await callUserMusicu(options)).body.response).toEqual(response);
    expect(requestMock).toHaveBeenCalledTimes(1);
  });

  it('does not expose the raw encrypted response or replay after a malformed response', async () => {
    requestMock.mockResolvedValue({ data: Buffer.from('broken') });
    expect((await callUserMusicu(options)).status).toBe(500);
    expect(requestMock).toHaveBeenCalledTimes(1);
  });
});
