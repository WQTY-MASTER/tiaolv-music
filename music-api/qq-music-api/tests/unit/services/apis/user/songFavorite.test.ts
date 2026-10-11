import { beforeEach, describe, expect, it, vi } from 'vitest';

const { callUserMusicuMock, uCommonMock, getUserLikedSongsMock } = vi.hoisted(() => ({
	callUserMusicuMock: vi.fn(),
	uCommonMock: vi.fn(),
	getUserLikedSongsMock: vi.fn(),
}));

vi.mock('../../../../../src/services/apis/u_common', () => ({ default: uCommonMock }));
vi.mock('../../../../../src/services/apis/user/userMusicu', () => ({ callUserMusicu: callUserMusicuMock }));
vi.mock('../../../../../src/services/apis/user/getUserLikedSongs', () => ({
	getUserLikedSongs: getUserLikedSongsMock,
}));

import { setSongFavorite } from '../../../../../src/services/apis/user/songFavorite';

describe('songFavorite', () => {
	beforeEach(() => {
		getUserLikedSongsMock.mockReset();
		uCommonMock.mockReset().mockResolvedValue({
			data: { songinfo: { data: { track_info: { id: 12345, type: 0 } } } },
		});
		callUserMusicuMock.mockReset().mockImplementation(async options => ({
			status: 200,
			body: { response: { code: 0, req_1: { code: 0,
				data: options.method.startsWith('IsSongFan')
					? { m_fan: { [String(options.param.v_songMid?.[0] ?? options.param.v_songId?.[0])]: options.param.v_songMid?.[0] === 'mid-liked-1' ? false : true } }
					: {},
			} } },
		}));
	});

	it('adds a resolved song to the current QQ favorite directory with the request cookie', async () => {
		const cookie = 'uin=o200; p_skey=favorite-key';

		const response = await setSongFavorite({ songMid: 'mid-liked-1', liked: true, cookie });

		expect(response.status).toBe(200);
		expect(uCommonMock).toHaveBeenCalledWith(
			expect.objectContaining({
				customCookie: cookie,
			}),
		);
		expect(callUserMusicuMock).toHaveBeenCalledWith({
			module: 'music.musicasset.PlaylistDetailWrite',
			method: 'AddSonglist',
			cookie,
			signed: true,
			webClient: true,
			encryptedWeb: true,
			useOriginalSession: true,
			param: { dirId: 201, tid: 0, bFmtUtf8: true, v_songInfo: [{ songType: 0, songId: 12345 }] },
		});
	});

	it('removes a resolved song from the current QQ favorite directory', async () => {
		const cookie = 'uin=o200; p_skey=favorite-key';
		callUserMusicuMock.mockResolvedValueOnce({ status: 200, body: { response: { code: 0, req_1: { code: 0, data: { m_fan: { 'mid-liked-1': true } } } } } });

		const response = await setSongFavorite({ songMid: 'mid-liked-1', liked: false, cookie });

		expect(response.status).toBe(200);
		expect(callUserMusicuMock).toHaveBeenCalledWith({
			module: 'music.musicasset.PlaylistDetailWrite',
			method: 'DelSonglist',
			cookie,
			signed: true,
			webClient: true,
			encryptedWeb: true,
			useOriginalSession: true,
			param: { dirId: 201, tid: 0, bFmtUtf8: true, v_songInfo: [{ songType: 0, songId: 12345 }] },
		});
	});

	it('removes an imported favorite using its numeric ID and original type, without looking it up as a MID', async () => {
		getUserLikedSongsMock.mockResolvedValue({
			status: 200,
			body: {
				response: {
					code: 0,
					req_1: {
						code: 0,
						data: {
							songlist: [{ id: 3399339082, mid: '', type: 1, title: 'Imported song' }],
							hasmore: 0,
						},
					},
				},
			},
		});
		const response = await setSongFavorite({ songMid: '3399339082', liked: false, cookie: 'uin=200' });
		expect(response.status).toBe(200);
		expect(uCommonMock).not.toHaveBeenCalled();
		expect(callUserMusicuMock).toHaveBeenCalledWith(
			expect.objectContaining({
				method: 'DelSonglist',
				param: {
					dirId: 201,
					tid: 0,
					bFmtUtf8: true,
					v_songInfo: [{ songType: 1, songId: 3399339082 }],
				},
			}),
		);
	});

	it('finds imported entries beyond the first page and retains filtered entry types', async () => {
		getUserLikedSongsMock
			.mockResolvedValueOnce({
				status: 200,
				body: { response: { code: 0, req_1: { code: 0, data: { songlist: [], hasmore: 1 } } } },
			})
			.mockResolvedValueOnce({
				status: 200,
				body: {
					response: {
						code: 0,
						req_1: {
							code: 0,
							data: {
								songlist: [],
								filtered_song: [{ songid: 123456, songtype: 21 }],
								hasmore: 0,
							},
						},
					},
				},
			});
		await setSongFavorite({ songMid: '123456', liked: false, cookie: 'uin=200' });
		expect(getUserLikedSongsMock.mock.calls[1][0].offset).toBe(100);
		expect(callUserMusicuMock.mock.calls[0][0].method).toBe('IsSongFanById');
		expect(callUserMusicuMock.mock.calls[1][0].param.v_songInfo).toEqual([{ songId: 123456, songType: 21 }]);
	});

	it('does not guess an imported type or write after a failed favorite-list read', async () => {
		getUserLikedSongsMock.mockResolvedValue({ status: 200, body: { response: { code: 0, req_1: { code: 1000 } } } });
		const result = await setSongFavorite({ songMid: '3399339082', liked: false, cookie: 'uin=200' });
		expect(result.body.response).toMatchObject({ req_1: { code: 1000 } });
		expect(callUserMusicuMock).not.toHaveBeenCalled();
		expect(uCommonMock).not.toHaveBeenCalled();
	});

	it('treats an already absent numeric favorite as removed only after a successful complete list read', async () => {
		getUserLikedSongsMock.mockResolvedValue({
			status: 200,
			body: { response: { code: 0, req_1: { code: 0, data: { songlist: [], hasmore: 0 } } } },
		});
		const result = await setSongFavorite({ songMid: '3399339082', liked: false, cookie: 'uin=200' });
		expect(result.body.response).toMatchObject({ req_1: { code: 0 } });
		expect(callUserMusicuMock).not.toHaveBeenCalled();
		expect(uCommonMock).not.toHaveBeenCalled();
	});

	it('rejects malformed list responses rather than confirming that the entry is absent', async () => {
		getUserLikedSongsMock.mockResolvedValue({ status: 200, body: { response: {} } });
		const result = await setSongFavorite({ songMid: '3399339082', liked: false, cookie: 'uin=200' });
		expect(result.status).toBe(502);
		expect(callUserMusicuMock).not.toHaveBeenCalled();
	});
});
