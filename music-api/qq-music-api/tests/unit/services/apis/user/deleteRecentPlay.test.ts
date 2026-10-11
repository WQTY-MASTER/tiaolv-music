import { beforeEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ recent: vi.fn(), rpc: vi.fn() }));
vi.mock('../../../../../src/services/apis/user/getRecentPlay', () => ({ getRecentPlay: mocks.recent }));
vi.mock('../../../../../src/services/apis/user/userMusicu', () => ({ callUserMusicu: mocks.rpc }));

import { deleteRecentPlay } from '../../../../../src/services/apis/user/deleteRecentPlay';

const recent = (...tracks: Array<{ id: number; mid: string }>) => ({
	status: 200,
	body: {
		response: {
			code: 0,
			req_1: { code: 0, data: { data: { songList: tracks.map(track => ({ track })) } } },
		},
	},
});

beforeEach(() => {
	mocks.recent.mockReset();
	mocks.rpc.mockReset();
});

it('deletes selected numeric IDs in one write and verifies the refreshed cloud snapshot', async () => {
	mocks.recent.mockResolvedValueOnce(recent({ id: 11, mid: 'mid1' }, { id: 22, mid: 'mid2' }));
	mocks.rpc.mockResolvedValue({
		status: 200,
		body: { response: { code: 0, req_1: { code: 0, data: { ret: 0, timeList: [] } } } },
	});
	mocks.recent.mockResolvedValueOnce(recent({ id: 22, mid: 'mid2' }));

	const result = await deleteRecentPlay({ trackIds: ['mid1'], cookie: 'uin=200' });

	expect(result.status).toBe(200);
	expect(mocks.rpc).toHaveBeenCalledTimes(1);
	expect(mocks.rpc).toHaveBeenCalledWith(expect.objectContaining({
		module: 'music.musicasset.PlayRecentlyWrite',
		method: 'DeletePlayRecentlyInfo',
		param: { data: [{ id: '11', type: 2 }] },
	}));
	expect(result.body).toEqual(expect.objectContaining({
		response: expect.objectContaining({ deletedTrackIds: ['mid1'] }),
	}));
});

it('does not retry or hide a rate-limited write', async () => {
	mocks.recent.mockResolvedValueOnce(recent({ id: 11, mid: 'mid1' }));
	mocks.rpc.mockResolvedValue({ status: 429, body: { error: '操作频繁' } });

	const result = await deleteRecentPlay({ trackIds: ['mid1'], cookie: 'uin=200' });

	expect(result.status).toBe(429);
	expect(mocks.rpc).toHaveBeenCalledTimes(1);
	expect(mocks.recent).toHaveBeenCalledTimes(1);
});

it('deletes an imported recent track that only has a numeric song ID', async () => {
	mocks.recent.mockResolvedValueOnce(recent({ id: 33, mid: '' }));
	mocks.rpc.mockResolvedValue({
		status: 200,
		body: { response: { code: 0, req_1: { code: 0, data: { ret: 0 } } } },
	});
	mocks.recent.mockResolvedValueOnce(recent());

	const result = await deleteRecentPlay({ trackIds: ['33'], cookie: 'uin=200' });

	expect(result.status).toBe(200);
	expect(mocks.rpc).toHaveBeenCalledWith(expect.objectContaining({ param: { data: [{ id: '33', type: 2 }] } }));
	expect(result.body).toEqual(expect.objectContaining({
		response: expect.objectContaining({ deletedTrackIds: ['33'] }),
	}));
});

it('reports failure when the refreshed cloud snapshot still contains a selected track', async () => {
	mocks.recent.mockResolvedValueOnce(recent({ id: 11, mid: 'mid1' }));
	mocks.rpc.mockResolvedValue({
		status: 200,
		body: { response: { code: 0, req_1: { code: 0, data: { ret: 0, timeList: [{ code: 0 }] } } } },
	});
	mocks.recent.mockResolvedValueOnce(recent({ id: 11, mid: 'mid1' }));

	const result = await deleteRecentPlay({ trackIds: ['mid1'], cookie: 'uin=200' });

	expect(result.status).toBe(502);
	expect(mocks.rpc).toHaveBeenCalledTimes(1);
	expect(mocks.recent).toHaveBeenCalledTimes(2);
});
