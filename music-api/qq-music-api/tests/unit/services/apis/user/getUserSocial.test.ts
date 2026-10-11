import { beforeEach, describe, expect, it, vi } from 'vitest';

const { callUserMusicu } = vi.hoisted(() => ({ callUserMusicu: vi.fn() }));

vi.mock('../../../../../src/services/apis/user/userMusicu', () => ({ callUserMusicu }));

import { getUserFans, getUserFollowSingers } from '../../../../../src/services/apis/user/getUserSocial';

describe('getUserFollowSingers', () => {
	beforeEach(() => {
		callUserMusicu.mockReset().mockResolvedValue({ status: 200, body: { response: {} } });
	});

	it('loads followed singers from the current relation service', async () => {
		await getUserFollowSingers({
			uin: '2657207894',
			page: 2,
			limit: 20,
			cookie: 'uin=o2657207894',
		});

		expect(callUserMusicu).toHaveBeenCalledWith({
			module: 'music.concern.RelationList',
			method: 'GetFollowSingerList',
			param: {
				From: 20,
				Size: 20,
				HostUin: '',
			},
			cookie: 'uin=o2657207894',
		});
	});

	it('loads account followers from the current relation service', async () => {
		await getUserFans({
			uin: '2657207894',
			page: 3,
			limit: 10,
			cookie: 'uin=o2657207894',
		});

		expect(callUserMusicu).toHaveBeenCalledWith({
			module: 'music.concern.RelationList',
			method: 'GetFansList',
			param: {
				From: 20,
				Size: 10,
				HostUin: '',
			},
			cookie: 'uin=o2657207894',
		});
	});
});
