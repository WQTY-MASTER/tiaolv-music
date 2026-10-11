import type { ApiResponse } from '../../../types/api';
import { errorResponse, successResponse } from '../../../util/apiResponse';
import { extractUinFromCookie } from '../../../util/cookieResolver';
import uCommon from '../u_common';
import { callUserMusicu } from './userMusicu';
import { getUserLikedSongs } from './getUserLikedSongs';

interface SetSongFavoriteOptions {
	songMid: string;
	liked: boolean;
	cookie: string;
}

const FAVORITE_DIRECTORY_ID = 201;

export interface ResolvedSong {
	id: number;
	type: number;
}

// Imported entries have no MID. Resolve their original type from the account's
// favorite directory instead of querying the public song catalog as type 0.
const resolveNumericFavorite = async (id: number, cookie: string): Promise<ResolvedSong | ApiResponse> => {
	if (!Number.isSafeInteger(id) || id <= 0) throw new Error('无效的 QQ 歌曲 ID');
	const uin = extractUinFromCookie(cookie) || '';
	for (let offset = 0; offset < 10000; offset += 100) {
		const result = await getUserLikedSongs({ uin, cookie, offset, limit: 100 });
		const payload = result.body.response as
			| {
					code?: number;
					req_1?: {
						code?: number;
						data?: {
							code?: number;
							songlist?: Record<string, unknown>[];
							filtered_song?: Record<string, unknown>[];
							hasmore?: number | boolean;
						};
					};
			  }
			| undefined;
		if (result.status !== 200) return result;
		if (payload?.code === undefined) throw new Error('QQ 音乐未返回业务状态');
		if (payload.code !== 0) return result;
		if (payload.req_1?.code === undefined) throw new Error('QQ 音乐未返回喜欢列表状态');
		if (payload.req_1.code !== 0) return result;
		const data = payload.req_1.data;
		if (!data || !Array.isArray(data.songlist)) throw new Error('QQ 音乐未返回完整的喜欢列表');
		if (data.code !== undefined && data.code !== 0) return result;
		const song = [...data.songlist, ...(data.filtered_song || [])].find(item => Number(item.id ?? item.songid) === id);
		if (song) {
			const type = Number(song.type ?? song.songtype);
			if (!Number.isInteger(type) || type < 0) throw new Error('QQ 音乐未返回歌曲类型');
			return { id, type };
		}
		if (data.hasmore === 0 || data.hasmore === false) {
			// A stale UI may retry removing an already removed entry. Only confirm
			// absence after the upstream explicitly reports the end of the list.
			return successResponse({ code: 0, req_1: { code: 0, data: { retCode: 0 } } });
		}
		if (data.hasmore !== 1 && data.hasmore !== true) throw new Error('QQ 喜欢列表分页状态缺失');
	}
	throw new Error('QQ 喜欢列表过大，无法确认歌曲类型');
};

export const resolveSong = async (songMid: string, cookie: string): Promise<ResolvedSong> => {
	const rawUin = extractUinFromCookie(cookie) || '';
	const uin = rawUin.replace(/\D/g, '').replace(/^0+/, '') || rawUin;
	const response = await uCommon({
		method: 'post',
		customCookie: cookie,
		options: {
			headers: { 'content-type': 'application/json' },
			data: JSON.stringify({
				comm: { uin, ct: 24, cv: 0 },
				songinfo: {
					module: 'music.pf_song_detail_svr',
					method: 'get_song_detail_yqq',
					param: { song_type: 0, song_mid: songMid, song_id: 0 },
				},
			}),
		},
	});
	const payload = response.data as {
		songinfo?: { data?: { track_info?: Record<string, unknown>; trackInfo?: Record<string, unknown> } };
	};
	const track = payload.songinfo?.data?.track_info || payload.songinfo?.data?.trackInfo;
	const id = Number(track?.id ?? track?.song_id);
	const type = Number(track?.type ?? track?.song_type ?? 0);
	if (!Number.isFinite(id) || id <= 0) throw new Error('无法解析 QQ 音乐歌曲 ID');
	return { id, type: Number.isFinite(type) ? type : 0 };
};

export const setSongFavorite = async ({ songMid, liked, cookie }: SetSongFavoriteOptions): Promise<ApiResponse> => {
	try {
		const song =
			!liked && /^\d+$/.test(songMid)
				? await resolveNumericFavorite(Number(songMid), cookie)
				: await resolveSong(songMid, cookie);
		if ('status' in song) return song;
		// Public lists and renewed read sessions do not prove Web write access.
		// Require the original Web ticket; explicit expiry asks for a fresh login.
		const numeric = /^\d+$/.test(songMid);
		const favoriteKey = numeric ? String(song.id) : songMid;
		const authentication = await callUserMusicu({
			module: 'music.musicasset.SongFavRead',
			method: numeric ? 'IsSongFanById' : 'IsSongFanByMid',
			param: numeric ? { v_songId: [song.id] } : { v_songMid: [songMid] },
			cookie,
			signed: true,
			webClient: true,
			encryptedWeb: true,
			useOriginalSession: true,
		});
		const status = authentication.body.response as
			| { code?: number; req_1?: { code?: number; data?: { m_fan?: Record<string, boolean> } } }
			| undefined;
		if (authentication.status !== 200) return authentication;
		if (status?.code === undefined || status.req_1?.code === undefined) {
			return errorResponse('QQ 音乐未确认收藏登录状态', 502);
		}
		if (status.code !== 0 || status.req_1.code !== 0) return authentication;
		const currentFavorite = status.req_1.data?.m_fan?.[favoriteKey];
		if (typeof currentFavorite !== 'boolean') return errorResponse('QQ 音乐未返回歌曲收藏状态', 502);
		if (currentFavorite === liked) return successResponse({ code: 0, req_1: { code: 0, data: { retCode: 0 } } });
		const response = await callUserMusicu({
			module: 'music.musicasset.PlaylistDetailWrite',
			method: liked ? 'AddSonglist' : 'DelSonglist',
			param: {
				dirId: FAVORITE_DIRECTORY_ID,
				tid: 0,
				bFmtUtf8: true,
				v_songInfo: [{ songType: song.type, songId: song.id }],
			},
			cookie,
			signed: true,
			webClient: true,
			encryptedWeb: true,
			useOriginalSession: true,
		});
		return response;
	} catch (error) {
		return errorResponse(error, 502);
	}
};
