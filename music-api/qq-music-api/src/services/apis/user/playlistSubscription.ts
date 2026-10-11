import type { ApiResponse } from '../../../types/api';
import { extractUinFromCookie } from '../../../util/cookieResolver';
import { handleApi } from '../../../util/apiResponse';
import request from '../../../util/request';

interface SetPlaylistSubscriptionOptions {
	playlistId: string;
	subscribed: boolean;
	cookie: string;
}

const verifyPlaylistSubscriptionResponse = (data: unknown): unknown => {
	if (!data || typeof data !== 'object') return data;
	const payload = data as Record<string, unknown>;
	const errorCode = ['code', 'subcode', 'retcode']
		.map(key => Number(payload[key]))
		.find(code => Number.isFinite(code) && code !== 0);
	if (errorCode !== undefined) {
		throw new Error(String(payload.message || payload.msg || `QQ Music error: ${errorCode}`));
	}
	return data;
};

export const setPlaylistSubscription = ({
	playlistId,
	subscribed,
	cookie,
}: SetPlaylistSubscriptionOptions): Promise<ApiResponse> => {
	const cookieUin = extractUinFromCookie(cookie) || '';
	const uin = cookieUin;
	const playlistUrl = `https://y.qq.com/n/yqq/playlist/${playlistId}.html`;

	return handleApi(
		request({
			url: '/folder/fcgi-bin/fcg_qm_order_diss.fcg',
			method: 'GET',
			cookie,
			options: {
				params: {
					loginUin: uin,
					hostUin: 0,
					inCharset: 'GB2312',
					outCharset: 'utf8',
					platform: 'yqq',
					format: 'json',
					g_tk: 799643780,
					uin,
					dissid: playlistId,
					notice: 0,
					needNewCode: 0,
					from: 1,
					optype: subscribed ? '1' : '2',
					utf8: 1,
					qzreferrer: playlistUrl,
				},
				headers: {
					Referer: playlistUrl,
					origin: 'https://imgcache.qq.com',
					'content-type': 'application/x-www-form-urlencoded',
				},
			},
		}),
		{ transformData: verifyPlaylistSubscriptionResponse, logError: false },
	);
};
