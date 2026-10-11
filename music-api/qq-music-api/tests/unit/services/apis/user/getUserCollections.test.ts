import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getGtk } from '../../../../../src/util/loginUtils';

const { requestMock } = vi.hoisted(() => ({ requestMock: vi.fn() }));

vi.mock('../../../../../src/util/request', () => ({ default: requestMock }));

import { getUserCollectedSongLists } from '../../../../../src/services/apis/user/getUserCollections';

describe('getUserCollectedSongLists', () => {
	beforeEach(() => {
		requestMock.mockReset().mockResolvedValue({ data: { code: 0, data: { cdlist: [] } } });
	});

	it('uses the account p_skey instead of the anonymous fallback token', async () => {
		const cookie = 'uin=200; p_skey=test-skey';

		await getUserCollectedSongLists({ uin: '200', page: 1, limit: 20, cookie });

		expect(requestMock.mock.calls[0][0].options.params).toMatchObject({
			g_tk: getGtk('test-skey'),
			loginUin: '200',
		});
	});
});
