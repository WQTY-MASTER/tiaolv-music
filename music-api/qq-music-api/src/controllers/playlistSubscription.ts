import { setPlaylistSubscription } from '../services';
import type { KoaContext } from '../routes/types';
import { resolveRequestCookie } from '../util/cookieResolver';
import { setApiResponse, withErrorHandler } from './util';

const getSingleValue = (value: unknown): string | undefined => {
	if (Array.isArray(value)) return getSingleValue(value[0]);
	if (value === undefined || value === null) return undefined;
	const text = String(value).trim();
	return text || undefined;
};

export const setPlaylistSubscriptionController = withErrorHandler(async (ctx: KoaContext) => {
	const body = ctx.request.body || {};
	const playlistId = getSingleValue(body.id);
	if (!playlistId) {
		setApiResponse(ctx, { status: 400, body: { error: '缺少 id 参数' } });
		return;
	}
	if (typeof body.subscribed !== 'boolean') {
		setApiResponse(ctx, { status: 400, body: { error: 'subscribed 必须为布尔值' } });
		return;
	}
	const { cookie } = resolveRequestCookie(ctx);
	if (!cookie) {
		setApiResponse(ctx, { status: 400, body: { error: '缺少 cookie 参数' } });
		return;
	}

	setApiResponse(ctx, await setPlaylistSubscription({ playlistId, subscribed: body.subscribed, cookie }));
}, 'setPlaylistSubscription');
