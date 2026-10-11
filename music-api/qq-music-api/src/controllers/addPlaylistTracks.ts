import { addPlaylistTracks } from '../services/apis/user/playlistTracks';
import { resolveRequestCookie } from '../util/cookieResolver';
import { setApiResponse, withErrorHandler } from './util';

export const addPlaylistTracksController = withErrorHandler(async ctx => {
	const { id, trackIds } = ctx.request.body || {};
	const { cookie } = resolveRequestCookie(ctx);
	if (!cookie || typeof id !== 'string' || !Array.isArray(trackIds) || trackIds.some(value => typeof value !== 'string')) {
		ctx.status = 400;
		ctx.body = { error: 'id 和 trackIds 参数无效' };
		return;
	}
	setApiResponse(ctx, await addPlaylistTracks({ id, trackIds, cookie }));
}, 'addPlaylistTracks');
