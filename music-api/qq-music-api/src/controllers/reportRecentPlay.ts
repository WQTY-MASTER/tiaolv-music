import { reportRecentPlay } from '../services/apis/user/reportRecentPlay';
import { resolveRequestCookie } from '../util/cookieResolver';
import { setApiResponse, withErrorHandler } from './util';

export const reportRecentPlayController = withErrorHandler(async ctx => {
	const { cookie } = resolveRequestCookie(ctx);
	const { songMid, sessionId, listenedSeconds, totalSeconds } = ctx.request.body || {};
	if (!cookie || typeof songMid !== 'string' || typeof sessionId !== 'string'
		|| typeof listenedSeconds !== 'number' || typeof totalSeconds !== 'number') {
		ctx.status = 400;
		ctx.body = { error: '缺少有效的播放上报参数' };
		return;
	}
	setApiResponse(ctx, await reportRecentPlay({ songMid, sessionId, listenedSeconds, totalSeconds, cookie }));
}, 'reportRecentPlay');
