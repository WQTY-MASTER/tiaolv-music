import { createPlaylist } from '../services/apis/user/deletePlaylist';
import { resolveRequestCookie } from '../util/cookieResolver';
import { setApiResponse, withErrorHandler } from './util';

export const createPlaylistController = withErrorHandler(async ctx => {
	const name = ctx.request.body?.name;
	const { cookie } = resolveRequestCookie(ctx);
	if (typeof name !== 'string' || !cookie) {
		setApiResponse(ctx, { status: 400, body: { error: '缺少 name 或 cookie 参数' } });
		return;
	}
	setApiResponse(ctx, await createPlaylist({ name, cookie }));
}, 'createPlaylist');
