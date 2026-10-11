import { getSingerSubscription, setSingerSubscription } from '../services';
import type { KoaContext } from '../routes/types';
import { resolveRequestCookie } from '../util/cookieResolver';
import { setApiResponse, withErrorHandler } from './util';

const getSingleValue = (value: unknown): string | undefined => {
	if (Array.isArray(value)) return getSingleValue(value[0]);
	if (value === undefined || value === null) return undefined;
	const text = String(value).trim();
	return text || undefined;
};

const requireCookie = (ctx: KoaContext): string | undefined => {
	const { cookie } = resolveRequestCookie(ctx);
	if (!cookie) {
		setApiResponse(ctx, { status: 400, body: { error: '缺少 cookie 参数' } });
	}
	return cookie;
};

export const getSingerSubscriptionController = withErrorHandler(async (ctx: KoaContext) => {
	const singerMid = getSingleValue(ctx.query.singermid);
	if (!singerMid) {
		setApiResponse(ctx, { status: 400, body: { error: '缺少 singermid 参数' } });
		return;
	}
	const cookie = requireCookie(ctx);
	if (!cookie) return;

	setApiResponse(ctx, await getSingerSubscription({ singerMid, cookie }));
}, 'getSingerSubscription');

export const setSingerSubscriptionController = withErrorHandler(async (ctx: KoaContext) => {
	const body = ctx.request.body || {};
	const singerMid = getSingleValue(body.singermid);
	if (!singerMid) {
		setApiResponse(ctx, { status: 400, body: { error: '缺少 singermid 参数' } });
		return;
	}
	if (typeof body.subscribed !== 'boolean') {
		setApiResponse(ctx, { status: 400, body: { error: 'subscribed 必须为布尔值' } });
		return;
	}
	const cookie = requireCookie(ctx);
	if (!cookie) return;

	setApiResponse(ctx, await setSingerSubscription({ singerMid, subscribed: body.subscribed, cookie }));
}, 'setSingerSubscription');
