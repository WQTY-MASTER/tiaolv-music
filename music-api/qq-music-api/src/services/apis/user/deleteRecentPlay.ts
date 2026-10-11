import type { ApiResponse } from '../../../types/api';
import { errorResponse, successResponse } from '../../../util/apiResponse';
import { getRecentPlay } from './getRecentPlay';
import { callUserMusicu } from './userMusicu';

type RecentRow = Record<string, unknown> & { track?: Record<string, unknown> };

const readRows = async (cookie: string): Promise<RecentRow[] | ApiResponse> => {
	const result = await getRecentPlay({ cookie });
	if (result.status !== 200) return result;
	const payload = result.body.response as {
		code?: number;
		req_1?: { code?: number; data?: { data?: { songList?: RecentRow[] } } };
	};
	if (payload?.code !== 0 || payload.req_1?.code !== 0 || !Array.isArray(payload.req_1.data?.data?.songList))
		throw new Error('QQ 音乐未返回完整的最近播放');
	return payload.req_1.data.data.songList;
};

const trackKey = (row: RecentRow): string => {
	const track = row.track || row;
	return String(track.mid || track.songmid || track.id || track.songid || '');
};

const numericTrackId = (row: RecentRow): number => {
	const track = row.track || row;
	return Number(track.id ?? track.songid);
};

export const deleteRecentPlay = async ({ trackIds, cookie }: { trackIds: string[]; cookie: string }): Promise<ApiResponse> => {
	try {
		const requested = [...new Set(trackIds.map(value => value.trim()).filter(Boolean))];
		if (!requested.length || requested.length > 100) return errorResponse('请选择 1 到 100 首歌曲', 400);
		const before = await readRows(cookie);
		if (!Array.isArray(before)) return before;
		const requestedSet = new Set(requested);
		const numericIds = before
			.filter(row => requestedSet.has(trackKey(row)))
			.map(numericTrackId);
		if (numericIds.some(id => !Number.isSafeInteger(id) || id <= 0))
			throw new Error('QQ 音乐未返回可用于删除的歌曲 ID');

		if (numericIds.length) {
			const write = await callUserMusicu({
				module: 'music.musicasset.PlayRecentlyWrite',
				method: 'DeletePlayRecentlyInfo',
				param: { data: numericIds.map(id => ({ id: String(id), type: 2 })) },
				cookie,
			});
			if (write.status === 403 || write.status === 429) return write;
			const payload = write.body.response as { code?: number; req_1?: { code?: number; data?: { ret?: number } } };
			if (write.status !== 200 || payload?.code !== 0 || payload.req_1?.code !== 0 || payload.req_1.data?.ret !== 0)
				throw new Error('QQ 音乐未确认最近播放删除成功');
		}

		const after = await readRows(cookie);
		if (!Array.isArray(after)) return after;
		const remainingIds = new Set(after.map(trackKey));
		const deletedTrackIds = requested.filter(id => !remainingIds.has(id));
		if (deletedTrackIds.length !== requested.length)
			throw new Error('QQ 音乐云端仍保留部分最近播放记录');
		return successResponse({ code: 0, deletedTrackIds, songList: after });
	} catch (error) {
		return errorResponse(error, 502);
	}
};
