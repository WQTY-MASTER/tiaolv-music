import { deleteRecentPlay } from '../services/apis/user/deleteRecentPlay';
import { resolveRequestCookie } from '../util/cookieResolver';
import { setApiResponse, withErrorHandler } from './util';

export const deleteRecentPlayController = withErrorHandler(async ctx => {
	const { cookie } = resolveRequestCookie(ctx);
	const { trackIds } = ctx.request.body || {};
	if (!cookie) {
		ctx.status = 400;
		ctx.body = { error: '缺少 cookie 参数' };
		return;
	}
	if (!Array.isArray(trackIds) || trackIds.some(value => typeof value !== 'string')) {
		ctx.status = 400;
		ctx.body = { error: 'trackIds 必须为歌曲 MID 数组' };
		return;
	}
	setApiResponse(ctx, await deleteRecentPlay({ trackIds, cookie }));
}, 'deleteRecentPlay');
