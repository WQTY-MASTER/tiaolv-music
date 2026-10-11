import { afterAll, beforeEach, expect, it, vi } from 'vitest';
afterAll(() => vi.useRealTimers());
const mocks = vi.hoisted(() => ({ list: vi.fn(), recent: vi.fn(), rpc: vi.fn(), resolve: vi.fn() }));
vi.mock('../../../../../src/services/apis/user/getUserPlaylists', () => ({ getUserPlaylists: mocks.list }));
vi.mock('../../../../../src/services/apis/user/getRecentPlay', () => ({ getRecentPlay: mocks.recent }));
vi.mock('../../../../../src/services/apis/user/userMusicu', () => ({ callUserMusicu: mocks.rpc }));
vi.mock('../../../../../src/services/apis/user/songFavorite', () => ({ resolveSong: mocks.resolve }));
import { addPlaylistTracks, removePlaylistTrack, reorderPlaylistTracks } from '../../../../../src/services/apis/user/playlistTracks';
const ok = (data: unknown) => ({ status: 200, body: { response: { code: 0, req_1: { code: 0, data } } } });
const song = { id: 99, mid: 'mid99', type: 0 };
const call = () => removePlaylistTrack({ id: '900', songId: 'mid99', cookie: 'uin=200' });
const other = { id: 77, type: 1 };
const reorder = (trackIds = ['77', 'mid99'], previousTrackIds = ['mid99', '77']) =>
	reorderPlaylistTracks({ id: '900', trackIds, previousTrackIds, cookie: 'uin=200' });
beforeEach(() => {
	vi.setSystemTime(Date.now() + 61000);
	mocks.list
		.mockReset()
		.mockResolvedValue({ status: 200, body: { response: { code: 0, data: { playlists: [{ tid: 900, dirid: 2 }] } } } });
	mocks.rpc.mockReset();
	mocks.recent.mockReset().mockResolvedValue({
		status: 200,
		body: { response: { code: 0, req_1: { code: 0, data: { data: { songList: [] } } } } },
	});
	mocks.resolve.mockReset().mockResolvedValue({ id: 88, type: 0 });
});

it('adds multiple songs with one cloud write and verifies the target playlist', async () => {
	mocks.recent.mockResolvedValue({
		status: 200,
		body: { response: { code: 0, req_1: { code: 0, data: { data: { songList: [
			{ track: { id: 88, mid: 'mid88', type: 0 } },
			{ track: { id: 99, mid: 'mid99', type: 1 } },
		] } } } } },
	});
	mocks.rpc
		.mockResolvedValueOnce(ok({ songlist: [], hasmore: 0 }))
		.mockResolvedValueOnce(ok({ retCode: 0 }))
		.mockResolvedValueOnce(ok({ songlist: [{ id: 88, mid: 'mid88', type: 0 }, { id: 99, mid: 'mid99', type: 1 }], hasmore: 0 }));

	const result = await addPlaylistTracks({ id: '900', trackIds: ['mid88', 'mid99'], cookie: 'uin=200' });

	expect(result.status).toBe(200);
	expect(mocks.rpc).toHaveBeenCalledWith(expect.objectContaining({
		method: 'AddSonglist',
		param: { dirId: 2, v_songInfo: [{ songId: 88, songType: 0 }, { songId: 99, songType: 1 }] },
	}));
	expect(mocks.resolve).not.toHaveBeenCalled();
});
it('rejects rapid repeated saves before making any upstream request', async () => {
	mocks.rpc
		.mockResolvedValueOnce(ok({ songlist: [song, other], hasmore: 0 }))
		.mockResolvedValueOnce(ok({ retCode: 0 }))
		.mockResolvedValueOnce(ok({ songlist: [other, song], hasmore: 0 }));
	expect((await reorder()).status).toBe(200);
	const calls = mocks.rpc.mock.calls.length;
	expect((await reorder()).status).toBe(429);
	expect(mocks.rpc).toHaveBeenCalledTimes(calls);
});
it('resolves numeric song identity and verifies removal from the owned directory', async () => {
	mocks.rpc
		.mockResolvedValueOnce(ok({ songlist: [song], hasmore: 0 }))
		.mockResolvedValueOnce(ok({ retCode: 0 }))
		.mockResolvedValueOnce(ok({ songlist: [], hasmore: 0 }));
	expect((await call()).status).toBe(200);
	expect(mocks.rpc).toHaveBeenCalledWith(
		expect.objectContaining({
			method: 'DelSonglist',
			param: { dirId: 2, v_songInfo: [{ songId: 99, songType: 0 }] },
			webClient: true,
		}),
	);
});
it('preserves imported song type when removing a numeric entry', async () => {
	mocks.rpc
		.mockResolvedValueOnce(ok({ songlist: [{ id: 99, type: 1 }], hasmore: 0 }))
		.mockResolvedValueOnce(ok({ retCode: 0 }))
		.mockResolvedValueOnce(ok({ songlist: [], hasmore: 0 }));
	await removePlaylistTrack({ id: '900', songId: '99', cookie: 'uin=200' });
	expect(mocks.rpc).toHaveBeenCalledWith(
		expect.objectContaining({ method: 'DelSonglist', param: { dirId: 2, v_songInfo: [{ songId: 99, songType: 1 }] } }),
	);
});
it.each([201, 205, 206, 0, undefined])('rejects protected/unknown directory %s for ordinary removal', async dirid => {
	mocks.list.mockResolvedValue({
		status: 200,
		body: { response: { code: 0, data: { playlists: [{ tid: 900, dirid }] } } },
	});
	expect((await call()).status).toBe(403);
	expect(mocks.rpc).not.toHaveBeenCalled();
});
it('rejects a playlist owned by somebody else', async () => {
	mocks.list.mockResolvedValue({ status: 200, body: { response: { code: 0, data: { playlists: [] } } } });
	expect((await call()).status).toBe(403);
	expect(mocks.rpc).not.toHaveBeenCalled();
});
it('does not treat business errors or incomplete reads as an empty playlist', async () => {
	mocks.rpc.mockResolvedValue(ok({ code: 80105 }));
	expect((await call()).status).toBe(502);
	expect(mocks.rpc).toHaveBeenCalledTimes(1);
});
it('rejects an unconfirmed write instead of reporting success', async () => {
	mocks.rpc
		.mockResolvedValueOnce(ok({ songlist: [song], hasmore: 0 }))
		.mockResolvedValueOnce(ok({ retCode: 0 }))
		.mockResolvedValue(ok({ songlist: [song], hasmore: 0 }));
	expect((await call()).status).toBe(502);
});
it('checks all pages and never writes a guessed type', async () => {
	mocks.rpc
		.mockResolvedValueOnce(ok({ songlist: [], hasmore: 1 }))
		.mockResolvedValueOnce(ok({ songlist: [{ id: 99, mid: 'mid99' }], hasmore: 0 }));
	expect((await call()).status).toBe(502);
	expect(mocks.rpc).toHaveBeenCalledTimes(2);
});
it('saves the full ordered identity list and confirms the resulting order', async () => {
	mocks.rpc
		.mockResolvedValueOnce(ok({ songlist: [song, other], hasmore: 0 }))
		.mockResolvedValueOnce(ok({ retCode: 0 }))
		.mockResolvedValueOnce(ok({ songlist: [other, song], hasmore: 0 }));
	expect((await reorder()).status).toBe(200);
	expect(mocks.rpc).toHaveBeenCalledWith(
		expect.objectContaining({
			method: 'SeqSonglist',
			param: {
				dirId: 2,
				tid: 900,
				v_songPair: [
					{ songId: 77, songType: 1 },
					{ songId: 99, songType: 0 },
				],
			},
		}),
	);
});
it('allows favorites ordering without allowing playlist deletion', async () => {
	mocks.list.mockResolvedValue({
		status: 200,
		body: { response: { code: 0, data: { playlists: [{ tid: 900, dirid: 201 }] } } },
	});
	mocks.rpc
		.mockResolvedValueOnce(ok({ songlist: [song, other], hasmore: 0 }))
		.mockResolvedValueOnce(ok({ retCode: 0 }))
		.mockResolvedValueOnce(ok({ songlist: [other, song], hasmore: 0 }));
	expect((await reorder()).status).toBe(200);
	expect(mocks.rpc.mock.calls.map(args => args[0].method)).toEqual(['CgiGetDiss', 'SeqSonglist', 'CgiGetDiss']);
});
it('reorders visible favorites while preserving unavailable imported songs', async () => {
	const unavailable = { id: 55, type: 1 };
	mocks.list.mockResolvedValue({
		status: 200,
		body: { response: { code: 0, data: { playlists: [{ tid: 900, dirid: 201 }] } } },
	});
	mocks.rpc
		.mockResolvedValueOnce(ok({ songlist: [song, other], filtered_song: [unavailable], hasmore: 0 }))
		.mockResolvedValueOnce(ok({ retCode: 0 }))
		.mockResolvedValueOnce(ok({ songlist: [other, song], filtered_song: [unavailable], hasmore: 0 }));
	expect((await reorder()).status).toBe(200);
	expect(mocks.rpc).toHaveBeenCalledWith(
		expect.objectContaining({
			method: 'SeqSonglist',
			param: {
				dirId: 201,
				tid: 900,
				v_songPair: [
					{ songId: 77, songType: 1 },
					{ songId: 99, songType: 0 },
					{ songId: 55, songType: 1 },
				],
			},
		}),
	);
});
it.each([['mid99', 'mid99'], ['mid99'], ['mid99', '77', 'unknown']])('rejects invalid order %s', async ids => {
	mocks.rpc.mockResolvedValue(ok({ songlist: [song, other], hasmore: 0 }));
	expect((await reorder(ids)).status).not.toBe(200);
	expect(mocks.rpc.mock.calls.some(args => args[0].method === 'SeqSonglist')).toBe(false);
});
it('refuses stale order from another device or incomplete pagination', async () => {
	mocks.rpc.mockResolvedValueOnce(ok({ songlist: [other, song], hasmore: 0 }));
	expect((await reorder()).status).toBe(409);
	expect(mocks.rpc).toHaveBeenCalledTimes(1);
});
it('does not claim success if QQ ignores the requested order', async () => {
	mocks.rpc
		.mockResolvedValueOnce(ok({ songlist: [song, other], hasmore: 0 }))
		.mockResolvedValueOnce(ok({ retCode: 0 }))
		.mockResolvedValueOnce(ok({ songlist: [song, other], hasmore: 0 }));
	expect((await reorder()).status).toBe(502);
});
