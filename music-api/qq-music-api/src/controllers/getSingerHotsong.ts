import { KoaContext } from '../routes/types';
import { UCommon } from '../services';
import { setApiResponse, withErrorHandler } from './util';
import { customResponse } from '../util/apiResponse';

const getSingerHotsongController = withErrorHandler(async (ctx: KoaContext) => {
  const singermid = ctx.query.singermid as string;
  const singeridValue = Array.isArray(ctx.query.singerid) ? ctx.query.singerid[0] : ctx.query.singerid;
  const singerid = singeridValue === undefined ? undefined : Number(singeridValue);
  const num = +ctx.query.limit || 5;
  const page = +ctx.query.page || 0;
  const singerIdentifier = singermid
    ? { singermid }
    : Number.isFinite(singerid)
      ? { singerid }
      : undefined;

  if (!singerIdentifier) {
    setApiResponse(ctx, {
      status: 400,
      body: {
        response: 'no singermid'
      }
    });
    return;
  }
  
  const data = {
    comm: {
      ct: 24,
      cv: 0
    },
    singer: {
      method: 'get_singer_detail_info',
      param: {
        sort: 5,
        ...singerIdentifier,
        sin: (page - 1) * num,
        num
      },
      module: 'music.web_singer_info_svr'
    }
  };
  
  const params = {
    format: 'json',
    ...singerIdentifier,
    data: JSON.stringify(data)
  };
  
  const props = {
    method: 'get',
    params,
    option: {}
  };
  
  const response = await UCommon(props);
  setApiResponse(ctx, customResponse({ response: response.data }, 200));
});

export default getSingerHotsongController;
