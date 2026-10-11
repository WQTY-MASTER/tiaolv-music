import type { ApiResponse } from '../../../types/api';
import { errorResponse, successResponse } from '../../../util/apiResponse';
import { extractUinFromCookie } from '../../../util/cookieResolver';
import { getRecentPlay } from './getRecentPlay';
import { resolveSong } from './songFavorite';
import { callUserMusicu } from './userMusicu';

interface ReportOptions {
	songMid: string;
	sessionId: string;
	listenedSeconds: number;
	totalSeconds: number;
	cookie: string;
}
type Row = { track?: { id?: number; songid?: number }; lastTime?: number };
type Rpc = { code?: number; req_1?: { code?: number; data?: { code?: number; ret?: number; data?: { songList?: Row[] } } } };
const attempts = new Map<string, { mid: string; expires: number; result: Promise<ApiResponse> }>();
const RETENTION_MS = 24 * 60 * 60 * 1000;
const MAX_ATTEMPTS = 5000;

const read = async (cookie: string): Promise<Row[] | ApiResponse> => {
	const result = await getRecentPlay({ cookie, useOriginalSession: true });
	if (result.status !== 200) return result;
	const rpc = result.body.response as Rpc | undefined;
	if (rpc?.code === undefined || rpc.req_1?.code === undefined)
		return errorResponse('QQ 音乐未确认最近播放登录状态', 502);
	if (rpc.code !== 0 || rpc.req_1.code !== 0 || (rpc.req_1.data?.code !== undefined && rpc.req_1.data.code !== 0)) return result;
	const rows = rpc.req_1.data?.data?.songList;
	return Array.isArray(rows) ? rows : errorResponse('QQ 音乐未返回完整最近播放', 502);
};

const perform = async ({ songMid, cookie }: ReportOptions): Promise<ApiResponse> => {
	try {
		const before = await read(cookie);
		if (!Array.isArray(before)) return before;
		const song = await resolveSong(songMid, cookie);
		if (!Number.isSafeInteger(song.id) || song.id <= 0 || song.type !== 0)
			return errorResponse('QQ 音乐未返回支持上报的标准歌曲 ID', 502);
		const lastTime = Math.floor(Date.now() / 1000);
		const result = await callUserMusicu({
			module: 'music.musicasset.PlayRecentlyWrite', method: 'ReportPlayRecentlyInfo',
			param: { data: [{ id: String(song.id), type: 2, lastTime, listenCnt: 1 }] },
			cookie, useOriginalSession: true,
		});
		if (result.status !== 200) return result;
		const rpc = result.body.response as Rpc | undefined;
		if (rpc?.code === undefined || rpc.req_1?.code === undefined)
			return errorResponse('QQ 音乐未返回最近播放上报状态', 502);
		if (rpc.code !== 0 || rpc.req_1.code !== 0 || (rpc.req_1.data?.code !== undefined && rpc.req_1.data.code !== 0)) return result;
		if (rpc.req_1.data?.ret !== 0) return errorResponse('QQ 音乐未确认最近播放上报成功', 502);
		// Propagation checks are reads only: an uncertain write must never be repeated.
		for (const delay of [0, 250, 750]) {
			if (delay) await new Promise(resolve => setTimeout(resolve, delay));
			const rows = await read(cookie);
			if (!Array.isArray(rows)) return rows;
			if (rows.some(row => Number(row.track?.id ?? row.track?.songid) === song.id && Number(row.lastTime) >= lastTime))
				return successResponse({ code: 0, confirmed: true, songList: rows });
		}
		return errorResponse('QQ 已接收上报，但云端最近播放尚未确认；本次不会重复提交', 502);
	} catch {
		return errorResponse('QQ 最近播放上报失败；本次不会重复提交', 502);
	}
};

export const reportRecentPlay = async (options: ReportOptions): Promise<ApiResponse> => {
	const { songMid, sessionId, listenedSeconds, totalSeconds, cookie } = options;
	if (typeof cookie !== 'string' || typeof songMid !== 'string' || typeof sessionId !== 'string')
		return errorResponse('最近播放上报参数类型无效', 400);
	const uin = extractUinFromCookie(cookie)?.replace(/^o?0*/, '');
	if (!uin || !/^\d+$/.test(uin) || !/^[a-zA-Z0-9]{1,64}$/.test(songMid) || /^\d+$/.test(songMid)
		|| !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(sessionId)
		|| !Number.isSafeInteger(listenedSeconds) || listenedSeconds < 30
		|| !Number.isSafeInteger(totalSeconds) || totalSeconds <= 0 || listenedSeconds > totalSeconds)
		return errorResponse('最近播放上报需要有效账号、歌曲、会话和至少 30 秒真实播放', 400);
	const now = Date.now();
	for (const [key, value] of attempts) if (value.expires <= now) attempts.delete(key);
	const key = `${uin}:${sessionId.toLowerCase()}`;
	const existing = attempts.get(key);
	if (existing) return existing.mid === songMid ? existing.result : errorResponse('播放会话已绑定其他歌曲', 409);
	if (attempts.size >= MAX_ATTEMPTS) return errorResponse('最近播放上报繁忙，请稍后开始新的播放', 429);
	const result = perform(options);
	attempts.set(key, { mid: songMid, expires: now + RETENTION_MS, result });
	return result;
};
