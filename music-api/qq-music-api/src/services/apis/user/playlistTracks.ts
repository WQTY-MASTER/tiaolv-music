import type { ApiResponse } from '../../../types/api';
import { errorResponse, successResponse } from '../../../util/apiResponse';
import { extractUinFromCookie } from '../../../util/cookieResolver';
import { getUserPlaylists } from './getUserPlaylists';
import { getRecentPlay } from './getRecentPlay';
import { callUserMusicu } from './userMusicu';
import { resolveSong, type ResolvedSong } from './songFavorite';

const orderWrites = new Map<string, { busy: boolean; until: number }>();
const songKey = (song: Record<string, unknown>) => String(song.mid || song.songmid || song.id || song.songid);

export async function resolveOwnedDirectory(id: string, cookie: string): Promise<number> {
	if (!/^[1-9]\d*$/.test(id)) throw new Error('无效的歌单 ID');
	const uin = (extractUinFromCookie(cookie) || '').replace(/\D/g, '').replace(/^0+/, '');
	if (!uin) throw new Error('缺少账号身份');
	for (let offset = 0; offset < 10000; offset += 100) {
		const result = await getUserPlaylists({ uin, cookie, offset, limit: 100 });
		const payload = result.body.response as { code?: number; data?: { playlists?: Record<string, unknown>[] } };
		if (result.status !== 200 || payload?.code !== 0 || !Array.isArray(payload.data?.playlists))
			throw new Error('无法确认歌单归属');
		const rows = payload.data.playlists;
		const owned = rows.find(row => String(row.tid ?? row.dissid ?? row.id) === id);
		if (owned) return Number(owned.dirid);
		if (rows.length < 100) break;
	}
	return -1;
}

function readData(result: ApiResponse): Record<string, unknown> {
	const payload = result.body.response as { code?: number; req_1?: { code?: number; data?: Record<string, unknown> } };
	const data = payload?.req_1?.data;
	if (
		result.status !== 200 ||
		payload?.code !== 0 ||
		payload.req_1?.code !== 0 ||
		!data ||
		(data.code !== undefined && data.code !== 0) ||
		(data.retCode !== undefined && data.retCode !== 0)
	) {
		throw new Error('QQ 音乐未确认歌单操作成功');
	}
	return data;
}

export async function readOwnedSongs(id: string, dirId: number, cookie: string): Promise<Record<string, unknown>[]> {
	const songs: Record<string, unknown>[] = [];
	for (let offset = 0; offset < 10000; offset += 100) {
		const data = readData(
			await callUserMusicu({
				module: 'music.srfDissInfo.DissInfo',
				method: 'CgiGetDiss',
				param: {
					disstid: Number(id),
					dirid: dirId,
					song_begin: offset,
					song_num: 100,
					orderlist: true,
					onlysonglist: false,
					userinfo: true,
					tag: true,
				},
				cookie,
			}),
		);
		if (!Array.isArray(data.songlist)) throw new Error('QQ 音乐未返回完整歌曲列表');
		songs.push(
			...data.songlist,
			...(Array.isArray(data.filtered_song)
				? data.filtered_song.map(song => ({ ...song, __filtered: true }))
				: []),
		);
		if (data.hasmore === 0 || data.hasmore === false) return songs;
		if (data.hasmore !== 1 && data.hasmore !== true) throw new Error('QQ 音乐未返回分页状态');
	}
	throw new Error('歌单过大，无法确认完整歌曲列表');
}

export async function removePlaylistTrack({
	id,
	songId,
	cookie,
}: {
	id: string;
	songId: string;
	cookie: string;
}): Promise<ApiResponse> {
	try {
		const dirId = await resolveOwnedDirectory(id, cookie);
		if (!Number.isSafeInteger(dirId) || dirId < 1 || [201, 205, 206].includes(dirId))
			return errorResponse('只能从当前账号的普通歌单移出歌曲', 403);
		const matches = (song: Record<string, unknown>) =>
			String(song.mid || song.songmid || song.id || song.songid) === songId;
		const songs = await readOwnedSongs(id, dirId, cookie);
		const song = songs.find(matches);
		if (song) {
			const numericId = Number(song.id ?? song.songid);
			const type = Number(song.type ?? song.songtype);
			if (!Number.isSafeInteger(numericId) || numericId <= 0 || !Number.isSafeInteger(type) || type < 0)
				throw new Error('无法确认歌曲 ID 或类型');
			readData(
				await callUserMusicu({
					module: 'music.musicasset.PlaylistDetailWrite',
					method: 'DelSonglist',
					param: { dirId, v_songInfo: [{ songId: numericId, songType: type }] },
					cookie,
					signed: true,
					webClient: true,
				}),
			);
			if ((await readOwnedSongs(id, dirId, cookie)).some(matches))
				throw new Error('QQ 音乐尚未确认歌曲已移出，请刷新后重试');
		}
		return successResponse({ code: 0, req_1: { code: 0, data: { retCode: 0 } } });
	} catch (error) {
		return errorResponse(error, 502);
	}
}

export async function addPlaylistTracks({
	id,
	trackIds,
	cookie,
}: {
	id: string;
	trackIds: string[];
	cookie: string;
}): Promise<ApiResponse> {
	try {
		const requested = [...new Set(trackIds.map(value => value.trim()).filter(Boolean))];
		if (!requested.length || requested.length > 100) return errorResponse('请选择 1 到 100 首歌曲', 400);
		const dirId = await resolveOwnedDirectory(id, cookie);
		if (!Number.isSafeInteger(dirId) || dirId < 1 || [201, 205, 206].includes(dirId))
			return errorResponse('只能添加到当前账号的普通歌单', 403);
		const current = await readOwnedSongs(id, dirId, cookie);
		const existing = new Set(current.map(songKey));
		const missing = requested.filter(trackId => !existing.has(trackId));
		if (missing.length) {
			const recent = await getRecentPlay({ cookie });
			const recentPayload = recent.body.response as {
				code?: number;
				req_1?: { code?: number; data?: { data?: { songList?: Array<{ track?: Record<string, unknown> }> } } };
			};
			const recentRows = recent.status === 200 && recentPayload?.code === 0 && recentPayload.req_1?.code === 0
				&& Array.isArray(recentPayload.req_1.data?.data?.songList)
				? recentPayload.req_1.data.data.songList
				: [];
			const recentPairs = new Map(recentRows.map(row => {
				const track = row.track || {};
				const key = String(track.mid || track.songmid || track.id || track.songid || '');
				const songId = Number(track.id ?? track.songid);
				const songType = Number(track.type ?? track.songtype ?? 0);
				return [key, { id: songId, type: songType }] as const;
			}));
			const resolved: ResolvedSong[] = [];
			for (const trackId of missing) {
				const recentPair = recentPairs.get(trackId);
				if (recentPair && Number.isSafeInteger(recentPair.id) && recentPair.id > 0
					&& Number.isSafeInteger(recentPair.type) && recentPair.type >= 0) {
					resolved.push(recentPair);
				} else {
					if (/^\d+$/.test(trackId)) throw new Error('无法确认导入歌曲的类型，请刷新最近播放后重试');
					resolved.push(await resolveSong(trackId, cookie));
				}
			}
			const response = await callUserMusicu({
				module: 'music.musicasset.PlaylistDetailWrite',
				method: 'AddSonglist',
				param: { dirId, v_songInfo: resolved.map(song => ({ songId: song.id, songType: song.type })) },
				cookie,
				signed: true,
				webClient: true,
			});
			if (response.status === 403 || response.status === 429) return response;
			readData(response);
		}
		const verified = new Set((await readOwnedSongs(id, dirId, cookie)).map(songKey));
		if (requested.some(trackId => !verified.has(trackId)))
			throw new Error('QQ 音乐尚未确认歌曲已加入歌单，请刷新后重试');
		return successResponse({ code: 0, req_1: { code: 0, data: { retCode: 0 } } });
	} catch (error) {
		return errorResponse(error, 502);
	}
}

// The desktop client uses SeqSonglist with the complete ordered song/type pairs.
// Never emulate ordering by deleting and re-adding tracks.
export async function reorderPlaylistTracks({
	id,
	trackIds,
	previousTrackIds,
	cookie,
}: {
	id: string;
	trackIds: string[];
	previousTrackIds: string[];
	cookie: string;
}): Promise<ApiResponse> {
	if (
		!trackIds.length ||
		trackIds.length > 10000 ||
		new Set(trackIds).size !== trackIds.length ||
		previousTrackIds.length !== trackIds.length ||
		new Set(previousTrackIds).size !== previousTrackIds.length ||
		trackIds.some(value => !previousTrackIds.includes(value))
	)
		return errorResponse('排序必须包含完整且不重复的歌曲', 400);
	const uin = (extractUinFromCookie(cookie) || '').replace(/\D/g, '').replace(/^0+/, '');
	const now = Date.now();
	// Account-wide gate also prevents racing requests from multiple playlist tabs.
	for (const [key, state] of orderWrites) if (!state.busy && state.until <= now) orderWrites.delete(key);
	const gate = orderWrites.get(uin);
	if (gate?.busy || (gate && gate.until > now)) return errorResponse('排序保存过于频繁，请稍后再试', 429);
	const state = { busy: true, until: now + 3000 };
	orderWrites.set(uin, state);
	try {
		const dirId = await resolveOwnedDirectory(id, cookie);
		if (!Number.isSafeInteger(dirId) || dirId < 1 || [205, 206].includes(dirId))
			return errorResponse('只能调整当前账号的歌曲列表', 403);
		const songs = await readOwnedSongs(id, dirId, cookie);
		const visibleSongs = songs.filter(song => song.__filtered !== true);
		const filteredSongs = songs.filter(song => song.__filtered === true);
		const currentIds = visibleSongs.map(songKey);
		if (JSON.stringify(currentIds) !== JSON.stringify(previousTrackIds))
			return errorResponse('歌单已在其他设备发生变化，请刷新后再排序', 409);
		const byId = new Map(visibleSongs.map(song => [songKey(song), song]));
		const orderedSongs = [
			...trackIds.map(key => byId.get(key)),
			...filteredSongs,
		];
		const pairs = orderedSongs.map(song => {
			const songId = Number(song?.id ?? song?.songid),
				songType = Number(song?.type ?? song?.songtype);
			if (!Number.isSafeInteger(songId) || songId <= 0 || !Number.isSafeInteger(songType) || songType < 0)
				throw new Error('无法确认歌曲 ID 或类型');
			return { songId, songType };
		});
		if (JSON.stringify(currentIds) !== JSON.stringify(trackIds)) {
			const response = await callUserMusicu({
				module: 'music.musicasset.PlaylistDetailWrite',
				method: 'SeqSonglist',
				param: { dirId, tid: Number(id), v_songPair: pairs },
				cookie,
				signed: true,
				webClient: true,
			});
			if (response.status === 403 || response.status === 429) {
				state.until = Date.now() + 60000;
				return errorResponse('QQ 音乐暂时限制操作，请至少一分钟后重试', response.status);
			}
			readData(response);
			const verified = await readOwnedSongs(id, dirId, cookie);
			const verifiedVisibleIds = verified.filter(song => song.__filtered !== true).map(songKey);
			const verifiedFilteredIds = verified.filter(song => song.__filtered === true).map(songKey);
			if (
				JSON.stringify(verifiedVisibleIds) !== JSON.stringify(trackIds) ||
				JSON.stringify(verifiedFilteredIds) !== JSON.stringify(filteredSongs.map(songKey))
			)
				throw new Error('QQ 音乐尚未确认新顺序，请刷新后重试');
		}
		return successResponse({ code: 0, req_1: { code: 0, data: { retCode: 0 } } });
	} catch (error) {
		return errorResponse(error, 502);
	} finally {
		state.busy = false;
		state.until = Math.max(state.until, Date.now() + 3000);
	}
}
