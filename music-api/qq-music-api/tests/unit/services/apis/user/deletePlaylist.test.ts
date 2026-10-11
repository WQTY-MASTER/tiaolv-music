import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ list: vi.fn(), write: vi.fn() }));
vi.mock('../../../../../src/services/apis/user/getUserPlaylists', () => ({ getUserPlaylists: mocks.list }));
vi.mock('../../../../../src/services/apis/user/userMusicu', () => ({ callUserMusicu: mocks.write }));
import * as playlistMutations from '../../../../../src/services/apis/user/deletePlaylist';
const { deletePlaylist } = playlistMutations;
beforeEach(() => {
	mocks.list.mockReset();
	mocks.write.mockReset().mockResolvedValue({ status: 200, body: { response: { code: 0 } } });
});
const list = (rows: unknown[]) => ({ status: 200, body: { response: { code: 0, data: { playlists: rows } } } });
it('resolves only the authenticated account directory before deletion', async () => {
	mocks.list.mockResolvedValue(list([{ tid: '900', dirid: 2 }]));
	await deletePlaylist({ id: '900', cookie: 'uin=o00200; qm_keyst=test' });
	expect(mocks.list).toHaveBeenCalledWith(expect.objectContaining({ uin: '200' }));
	expect(mocks.write).toHaveBeenCalledWith(
		expect.objectContaining({ method: 'DelPlaylist', param: { dirId: 2 }, webClient: true }),
	);
});
it.each([0, 1, 201, 205, 206, undefined])('protects system or unresolved directory %s', async dirid => {
	mocks.list.mockResolvedValue(list([{ tid: '900', dirid }]));
	expect((await deletePlaylist({ id: '900', cookie: 'uin=200' })).status).toBe(400);
	expect(mocks.write).not.toHaveBeenCalled();
});
it('rejects playlists not owned by this account', async () => {
	mocks.list.mockResolvedValue(list([]));
	expect((await deletePlaylist({ id: '900', cookie: 'uin=200' })).status).toBe(403);
	expect(mocks.write).not.toHaveBeenCalled();
});
it('does not delete after a failed ownership read', async () => {
	mocks.list.mockResolvedValue({ status: 502, body: { error: 'read failed' } });
	expect((await deletePlaylist({ id: '900', cookie: 'uin=200' })).status).toBe(502);
	expect(mocks.write).not.toHaveBeenCalled();
});

it('creates a playlist with the modern write command and returns the verified cloud row', async () => {
	expect(typeof playlistMutations.createPlaylist).toBe('function');
	mocks.list
		.mockResolvedValueOnce(list([{ tid: '800', dirid: 2, diss_name: '旧歌单' }]))
		.mockResolvedValueOnce(list([
			{ tid: '800', dirid: 2, diss_name: '旧歌单' },
			{ tid: '901', dirid: 3, diss_name: '新歌单', song_cnt: 0 },
		]));
	mocks.write.mockResolvedValue({
		status: 200,
		body: { response: { code: 0, req_1: { code: 0, data: { retCode: 0, result: { tid: 901, dirId: 3, dirName: '新歌单' } } } } },
	});

	const result = await playlistMutations.createPlaylist!({ name: ' 新歌单 ', cookie: 'uin=200; qm_keyst=test' });

	expect(mocks.write).toHaveBeenCalledWith(expect.objectContaining({
		module: 'music.musicasset.PlaylistBaseWrite',
		method: 'AddPlaylist',
		param: { dirName: '新歌单' },
		signed: true,
		webClient: true,
	}));
	expect(result).toEqual(expect.objectContaining({
		status: 200,
		body: { response: { code: 0, data: { playlist: expect.objectContaining({ tid: '901', dirid: 3, diss_name: '新歌单' }) } } },
	}));
});
