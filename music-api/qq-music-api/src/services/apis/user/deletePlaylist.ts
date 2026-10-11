import type { ApiResponse } from '../../../types/api';
import { errorResponse, successResponse } from '../../../util/apiResponse';
import { extractUinFromCookie } from '../../../util/cookieResolver';
import { getUserPlaylists } from './getUserPlaylists';
import { callUserMusicu } from './userMusicu';

const SYSTEM_DIRECTORIES = new Set([0, 1, 201, 205, 206]);

type PlaylistRow = Record<string, unknown>;

async function loadCreatedPlaylists(uin: string, cookie: string): Promise<ApiResponse | PlaylistRow[]> {
	const playlists: PlaylistRow[] = [];
	for (let offset = 0; offset < 10000; offset += 100) {
		const result = await getUserPlaylists({ uin, cookie, offset, limit: 100 });
		if (result.status !== 200) return result;
		const payload = result.body.response as { code?: number; data?: { playlists?: PlaylistRow[] } };
		if (payload?.code !== 0 || !Array.isArray(payload.data?.playlists))
			return errorResponse('无法读取账号歌单', 502);
		playlists.push(...payload.data.playlists);
		if (payload.data.playlists.length < 100) return playlists;
	}
	return errorResponse('歌单过多，无法确认创建结果', 502);
}

const playlistId = (playlist: PlaylistRow): string => String(playlist.tid ?? playlist.dissid ?? playlist.id ?? '');

export async function createPlaylist({ name, cookie }: { name: string; cookie: string }): Promise<ApiResponse> {
	const normalizedName = name.trim();
	if (!normalizedName) return errorResponse('歌单名不能为空', 400);
	if (normalizedName.length > 40) return errorResponse('歌单名不能超过 40 个字符', 400);
	const uin = (extractUinFromCookie(cookie) || '').replace(/\D/g, '').replace(/^0+/, '');
	if (!uin) return errorResponse('缺少账号身份', 400);

	const before = await loadCreatedPlaylists(uin, cookie);
	if (!Array.isArray(before)) return before;
	const beforeIds = new Set(before.map(playlistId));
	const write = await callUserMusicu({
		module: 'music.musicasset.PlaylistBaseWrite',
		method: 'AddPlaylist',
		param: { dirName: normalizedName },
		cookie,
		signed: true,
		webClient: true,
	});
	if (write.status === 403 || write.status === 429) return write;
	const payload = write.body.response as {
		code?: number;
		req_1?: { code?: number; data?: { retCode?: number; result?: PlaylistRow } };
	};
	const data = payload?.req_1?.data;
	if (write.status !== 200 || payload?.code !== 0 || payload.req_1?.code !== 0 || !data || data.retCode !== 0)
		return errorResponse('QQ 音乐未确认歌单创建成功', 502);

	const resultId = playlistId(data.result || {});
	const after = await loadCreatedPlaylists(uin, cookie);
	if (!Array.isArray(after)) return after;
	const created = after.find(row => (resultId && playlistId(row) === resultId) || !beforeIds.has(playlistId(row)));
	if (!created) return errorResponse('QQ 音乐尚未返回新歌单，请刷新后重试', 502);
	return successResponse({ code: 0, data: { playlist: created } });
}

// Resolve the account-local directory ID server-side. A public playlist ID
// alone is not sufficient evidence that the current account owns the list.
export async function deletePlaylist({ id, cookie }: { id: string; cookie: string }): Promise<ApiResponse> {
	if (!/^[1-9]\d*$/.test(id)) return errorResponse('无效的歌单 ID', 400);
	const uin = (extractUinFromCookie(cookie) || '').replace(/\D/g, '').replace(/^0+/, '');
	if (!uin) return errorResponse('缺少账号身份', 400);
	for (let offset = 0; offset < 10000; offset += 100) {
		const result = await getUserPlaylists({ uin, cookie, offset, limit: 100 });
		if (result.status !== 200) return result;
		const payload = result.body.response as { code?: number; data?: { playlists?: Record<string, unknown>[] } };
		if (payload?.code !== 0 || !Array.isArray(payload.data?.playlists)) return errorResponse('无法确认歌单归属', 502);
		const rows = payload.data.playlists;
		const owned = rows.find(p => String(p.tid ?? p.dissid ?? p.id) === id);
		if (owned) {
			const dirId = Number(owned.dirid);
			if (!Number.isSafeInteger(dirId) || dirId < 1 || SYSTEM_DIRECTORIES.has(dirId))
				return errorResponse('系统歌单不支持删除', 400);
			return callUserMusicu({
				module: 'music.musicasset.PlaylistBaseWrite',
				method: 'DelPlaylist',
				param: { dirId },
				cookie,
				signed: true,
				webClient: true,
			});
		}
		if (rows.length < 100) break;
	}
	return errorResponse('只能删除当前账号创建的歌单', 403);
}
