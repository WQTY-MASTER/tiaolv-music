import { beforeEach, describe, expect, it, vi } from 'vitest';

const { callUserMusicu } = vi.hoisted(() => ({ callUserMusicu: vi.fn() }));

vi.mock('../../../../../src/services/apis/user/userMusicu', () => ({ callUserMusicu }));

import { getUserLikedSongs } from '../../../../../src/services/apis/user/getUserLikedSongs';

describe('getUserLikedSongs', () => {
	beforeEach(() => {
		callUserMusicu.mockReset().mockResolvedValue({ status: 200, body: { response: {} } });
	});

	it('loads the real liked-song directory through the current musicu service', async () => {
		const cookie = 'uin=o200; qm_keyst=secret';

		await getUserLikedSongs({ uin: '200', offset: 30, limit: 20, cookie });

		expect(callUserMusicu).toHaveBeenCalledWith({
			module: 'music.srfDissInfo.DissInfo',
			method: 'CgiGetDiss',
			param: {
				disstid: 0,
				dirid: 201,
				tag: true,
				song_begin: 30,
				song_num: 20,
				userinfo: true,
				orderlist: true,
				onlysonglist: false,
			},
			cookie,
		});
	});
});
