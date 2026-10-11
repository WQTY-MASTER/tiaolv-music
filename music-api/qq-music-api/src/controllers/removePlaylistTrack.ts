import { removePlaylistTrack } from '../services/apis/user/playlistTracks';
import { resolveRequestCookie } from '../util/cookieResolver';
import { setApiResponse, withErrorHandler } from './util';
export const removePlaylistTrackController = withErrorHandler(async ctx => {
	const { id, songId } = ctx.request.body || {};
	const { cookie } = resolveRequestCookie(ctx);
	if (
		typeof id !== 'string' ||
		!/^[1-9]\d*$/.test(id) ||
		typeof songId !== 'string' ||
		!/^[a-zA-Z0-9]+$/.test(songId) ||
		!cookie
	) {
		setApiResponse(ctx, { status: 400, body: { error: '缺少有效 id、songId 或 cookie 参数' } });
		return;
	}
	setApiResponse(ctx, await removePlaylistTrack({ id, songId, cookie }));
}, 'removePlaylistTrack');
