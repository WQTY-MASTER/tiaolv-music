import { beforeEach, describe, expect, it, vi } from 'vitest';

const { requestMock } = vi.hoisted(() => ({ requestMock: vi.fn() }));

vi.mock('../../../../../src/util/request', () => ({ default: requestMock }));

import { setPlaylistSubscription } from '../../../../../src/services/apis/user/playlistSubscription';

describe('playlistSubscription', () => {
	beforeEach(() => {
		requestMock.mockReset().mockResolvedValue({ data: { code: 0 } });
	});

	it('maps collection state to QQ optype and forwards the account cookie', async () => {
		const cookie = 'uin=o123456; p_skey=playlist-key';

		await setPlaylistSubscription({ playlistId: '778899', subscribed: true, cookie });
		await setPlaylistSubscription({ playlistId: '778899', subscribed: false, cookie });

		expect(requestMock).toHaveBeenCalledTimes(2);
		expect(requestMock.mock.calls[0][0]).toMatchObject({
			url: '/folder/fcgi-bin/fcg_qm_order_diss.fcg',
			method: 'GET',
			cookie,
			options: {
				params: {
					loginUin: 'o123456',
					uin: 'o123456',
					dissid: '778899',
					optype: '1',
					g_tk: 799643780,
				},
				headers: {
					Referer: 'https://y.qq.com/n/yqq/playlist/778899.html',
					origin: 'https://imgcache.qq.com',
					'content-type': 'application/x-www-form-urlencoded',
				},
			},
		});
		expect(requestMock.mock.calls[1][0].options.params.optype).toBe('2');
	});

	it('turns a QQ business error into an HTTP failure response', async () => {
		requestMock.mockResolvedValueOnce({ data: { code: 1000, subcode: 1, message: 'cookie expired' } });

		const response = await setPlaylistSubscription({
			playlistId: '778899',
			subscribed: true,
			cookie: 'uin=123456; p_skey=playlist-key',
		});

		expect(response.status).toBe(500);
	});
});
