import type { Mock } from 'vitest';
import getSongInfoController from '../../../src/controllers/getSongInfo';
import { UCommon } from '../../../src/services';

vi.mock('../../../src/services');

describe('controllers/getSongInfo', () => {
  test('uses zero for a missing numeric song id', async () => {
    const ctx: any = {
      status: 200,
      body: null,
      query: { songmid: '0039MnYb0qxYhV' }
    };
    (UCommon as Mock).mockResolvedValue({ data: { code: 0 } });

    await getSongInfoController(ctx, vi.fn());

    const request = (UCommon as Mock).mock.calls[0][0];
    expect(typeof request.params.data).toBe('string');
    const data = JSON.parse(request.params.data);
    expect(data.songinfo.param).toEqual({
      song_type: 0,
      song_mid: '0039MnYb0qxYhV',
      song_id: 0
    });
  });
});
