import request from '../../../util/request';
import { customResponse, errorResponse } from '../../../util/apiResponse';
import type { ApiResponse } from '../../../types/api';

// 获取用户创建的歌单。该接口对额外的旧版主页参数很敏感，只传官网当前使用的字段。
export const getUserPlaylists = async (params: {
	uin: string;
	offset?: number;
	limit?: number;
	cookie?: string;
}): Promise<ApiResponse> => {
	const { uin, offset = 0, limit = 30, cookie } = params;

	try {
		const response = await request<Record<string, any>>({
			url: '/rsc/fcgi-bin/fcg_user_created_diss',
			method: 'GET',
			cookie,
			options: {
				params: { hostuin: uin, sin: offset, size: limit },
				headers: { Referer: 'https://y.qq.com/n/ryqq/profile' },
			},
		});
		const payload = response.data;

		if (payload?.code === 4000) {
			return customResponse({ response: { code: 0, data: { playlists: [] } } }, 200);
		}
		if (!payload || payload.code !== 0 || !Array.isArray(payload?.data?.disslist)) {
			return errorResponse(payload?.message || payload?.msg || '获取用户歌单失败', 502);
		}

		return customResponse({ response: { code: 0, data: { playlists: payload.data.disslist } } }, 200);
	} catch (error) {
		return errorResponse(error, 502);
	}
};
