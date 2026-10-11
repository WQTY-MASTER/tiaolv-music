import { deletePlaylist } from '../services/apis/user/deletePlaylist';
import { resolveRequestCookie } from '../util/cookieResolver';
import { setApiResponse, withErrorHandler } from './util';
export const deletePlaylistController = withErrorHandler(async ctx => {
	const id = ctx.request.body?.id;
	const { cookie } = resolveRequestCookie(ctx);
	if (typeof id !== 'string' || !cookie) {
		setApiResponse(ctx, { status: 400, body: { error: '缺少 id 或 cookie 参数' } });
		return;
	}
	setApiResponse(ctx, await deletePlaylist({ id, cookie }));
}, 'deletePlaylist');
