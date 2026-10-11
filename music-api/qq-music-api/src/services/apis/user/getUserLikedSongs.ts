import type { ApiResponse } from '../../../types/api';
import { callUserMusicu } from './userMusicu';

// dirid 201 是 QQ 音乐的“我喜欢”目录，可直接返回真实歌曲而不是旧主页里的歌单摘要。
export const getUserLikedSongs = ({
	offset = 0,
	limit = 30,
	cookie,
}: {
	uin: string;
	offset?: number;
	limit?: number;
	cookie: string;
}): Promise<ApiResponse> =>
	callUserMusicu({
		module: 'music.srfDissInfo.DissInfo',
		method: 'CgiGetDiss',
		param: {
			disstid: 0,
			dirid: 201,
			tag: true,
			song_begin: offset,
			song_num: limit,
			userinfo: true,
			orderlist: true,
			onlysonglist: false,
		},
		cookie,
	});
