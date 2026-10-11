import { beforeEach, describe, expect, it, vi } from 'vitest';

const { callUserMusicu } = vi.hoisted(() => ({ callUserMusicu: vi.fn() }));

vi.mock('../../../../../src/services/apis/user/userMusicu', () => ({ callUserMusicu }));

import {
  getSingerSubscription,
  setSingerSubscription,
} from '../../../../../src/services/apis/user/singerSubscription';

describe('singerSubscription', () => {
  beforeEach(() => {
    callUserMusicu.mockReset().mockResolvedValue({ status: 200, body: { response: {} } });
  });

  it('queries the current singer concern status', async () => {
    await getSingerSubscription({ singerMid: '002wbPaC0L9C3A', cookie: 'uin=o200' });

    expect(callUserMusicu).toHaveBeenCalledWith({
      module: 'Concern.ConcernSystemServer',
      method: 'cgi_qry_concern_status',
      param: {
        vec_userinfo: [{ usertype: 1, userid: '002wbPaC0L9C3A' }],
        opertype: 5,
        encrypt_singerid: 1,
      },
      cookie: 'uin=o200',
    });
  });

	it('uses opertype zero to follow and one to unfollow through the signed gateway', async () => {
    await setSingerSubscription({ singerMid: '002wbPaC0L9C3A', subscribed: true, cookie: 'uin=o200' });
    await setSingerSubscription({ singerMid: '002wbPaC0L9C3A', subscribed: false, cookie: 'uin=o200' });

		expect(callUserMusicu.mock.calls[0][0].param).toMatchObject({ opertype: 0, source: 0 });
		expect(callUserMusicu.mock.calls[0][0].signed).toBe(true);
		expect(callUserMusicu.mock.calls[1][0].param).toMatchObject({ opertype: 1, source: 0 });
	});
});
