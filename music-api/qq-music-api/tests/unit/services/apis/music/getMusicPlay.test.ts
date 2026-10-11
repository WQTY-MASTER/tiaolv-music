import { beforeEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ request: vi.fn() }));

vi.mock('../../../../../src/services/apis/UCommon/UCommon', () => ({ default: mocks.request }));

import getMusicPlay from '../../../../../src/services/apis/music/getMusicPlay';

beforeEach(() => {
	mocks.request.mockReset().mockResolvedValue({
		data: {
			req_0: {
				data: {
					sip: ['https://isure.stream.qqmusic.qq.com/'],
					midurlinfo: [{ songmid: 'test-mid', purl: 'test.mp3' }],
				},
			},
		},
	});
});

it('uses the authenticated QQ Music session for protected playback URLs', async () => {
	await getMusicPlay({
		params: { songmid: 'test-mid', quality: '128' },
		option: { headers: { Cookie: 'uin=o0012345; qm_keyst=session-key' } },
	});

	const payload = JSON.parse(mocks.request.mock.calls[0][0].params.data);
	expect(payload.loginUin).toBe('12345');
	expect(payload.comm.uin).toBe('12345');
	expect(payload.req_0.param).toMatchObject({
		uin: '12345',
		authst: 'session-key',
		loginflag: 1,
	});
});
