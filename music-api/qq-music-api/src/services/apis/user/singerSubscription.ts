import type { ApiResponse } from '../../../types/api';
import { callUserMusicu } from './userMusicu';

interface SingerSubscriptionOptions {
	singerMid: string;
	cookie?: string;
}

interface SetSingerSubscriptionOptions extends SingerSubscriptionOptions {
	subscribed: boolean;
}

export const getSingerSubscription = ({
	singerMid,
	cookie,
}: SingerSubscriptionOptions): Promise<ApiResponse> =>
	callUserMusicu({
		module: 'Concern.ConcernSystemServer',
		method: 'cgi_qry_concern_status',
		param: {
			vec_userinfo: [{ usertype: 1, userid: singerMid }],
			opertype: 5,
			encrypt_singerid: 1,
		},
		cookie,
	});

export const setSingerSubscription = ({
	singerMid,
	subscribed,
	cookie,
}: SetSingerSubscriptionOptions): Promise<ApiResponse> =>
	callUserMusicu({
		module: 'Concern.ConcernSystemServer',
		method: 'cgi_concern_user_v2',
		param: {
			opertype: subscribed ? 0 : 1,
			source: 0,
			userinfo: { usertype: 1, userid: singerMid },
			encrypt_singerid: 1,
		},
		cookie,
		signed: true,
	});
