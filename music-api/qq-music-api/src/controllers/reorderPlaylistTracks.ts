import { reorderPlaylistTracks } from '../services/apis/user/playlistTracks';
import { resolveRequestCookie } from '../util/cookieResolver';
import { setApiResponse, withErrorHandler } from './util';
export const reorderPlaylistTracksController = withErrorHandler(async ctx => {
	const { id, trackIds, previousTrackIds } = ctx.request.body || {};
	const { cookie } = resolveRequestCookie(ctx);
	const validIds = (ids: unknown): ids is string[] =>
		Array.isArray(ids) &&
		ids.length > 0 &&
		ids.length <= 10000 &&
		ids.every(id => typeof id === 'string' && /^[a-zA-Z0-9]+$/.test(id));
	if (
		typeof id !== 'string' ||
		!/^[1-9]\d*$/.test(id) ||
		!validIds(trackIds) ||
		!validIds(previousTrackIds) ||
		!cookie
	) {
		setApiResponse(ctx, { status: 400, body: { error: '缺少有效歌单、歌曲顺序或 cookie 参数' } });
		return;
	}
	setApiResponse(ctx, await reorderPlaylistTracks({ id, trackIds, previousTrackIds, cookie }));
}, 'reorderPlaylistTracks');
