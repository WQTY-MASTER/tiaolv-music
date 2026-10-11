import { setSongFavorite } from '../services';
import type { KoaContext } from '../routes/types';
import { resolveRequestCookie } from '../util/cookieResolver';
import { setApiResponse, withErrorHandler } from './util';

const singleValue = (value: unknown): string => {
	if (Array.isArray(value)) return singleValue(value[0]);
	return value === undefined || value === null ? '' : String(value).trim();
};

export const setSongFavoriteController = withErrorHandler(async (ctx: KoaContext) => {
	const body = ctx.request.body || {};
	const songMid = singleValue(body.mid);
	if (!songMid) {
		setApiResponse(ctx, { status: 400, body: { error: '缺少 mid 参数' } });
		return;
	}
	if (typeof body.liked !== 'boolean') {
		setApiResponse(ctx, { status: 400, body: { error: 'liked 必须为布尔值' } });
		return;
	}
	const { cookie } = resolveRequestCookie(ctx);
	if (!cookie) {
		setApiResponse(ctx, { status: 400, body: { error: '缺少 cookie 参数' } });
		return;
	}

	setApiResponse(ctx, await setSongFavorite({ songMid, liked: body.liked, cookie }));
}, 'setSongFavorite');
