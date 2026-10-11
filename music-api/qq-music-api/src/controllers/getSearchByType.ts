import { getSearchByType } from '../services';
import { resolveRequestCookie } from '../util/cookieResolver';
import type { QqSearchType } from '../services/apis/search/getSearchByType';
import type { KoaContext } from '../routes/types';
import { setApiResponse, withErrorHandler } from './util';

const SEARCH_TYPES = new Set<QqSearchType>(['song', 'playlist', 'artist']);

const queryValue = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

export default withErrorHandler(async (ctx: KoaContext) => {
  const key = queryValue(ctx.query.key)?.trim();
  const requestedType = queryValue(ctx.query.type) as QqSearchType | undefined;
  if (!key) {
    setApiResponse(ctx, { status: 400, body: { response: 'search key is null' } });
    return;
  }
  if (!requestedType || !SEARCH_TYPES.has(requestedType)) {
    setApiResponse(ctx, { status: 400, body: { response: 'unsupported search type' } });
    return;
  }

  const page = Math.max(1, Number(queryValue(ctx.query.page)) || 1);
  const limit = Math.max(1, Math.min(50, Number(queryValue(ctx.query.limit)) || 20));
  const { cookie } = resolveRequestCookie(ctx);
  const result = await getSearchByType({ key, type: requestedType, page, limit, cookie });
  setApiResponse(ctx, result);
}, 'getSearchByType');
