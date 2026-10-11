import { beforeEach, describe, expect, it, vi } from 'vitest';

const { requestMock } = vi.hoisted(() => ({ requestMock: vi.fn() }));

vi.mock('../../../../../src/util/request', () => ({ default: requestMock }));

import { getUserPlaylists } from '../../../../../src/services/apis/user/getUserPlaylists';

describe('getUserPlaylists', () => {
	beforeEach(() => {
		requestMock.mockReset().mockResolvedValue({
			data: {
				code: 0,
				data: { disslist: [{ tid: '99', diss_name: '我的歌单' }] },
			},
		});
	});

	it('uses the current created-playlist endpoint with its minimal parameter set', async () => {
		const cookie = 'uin=200; qm_keyst=secret';
		const response = await getUserPlaylists({ uin: '200', offset: 20, limit: 10, cookie });

		expect(requestMock).toHaveBeenCalledWith({
			url: '/rsc/fcgi-bin/fcg_user_created_diss',
			method: 'GET',
			cookie,
			options: {
				params: { hostuin: '200', sin: 20, size: 10 },
				headers: { Referer: 'https://y.qq.com/n/ryqq/profile' },
			},
		});
		expect(response).toMatchObject({
			status: 200,
			body: { response: { code: 0, data: { playlists: [{ tid: '99' }] } } },
		});
	});
});
