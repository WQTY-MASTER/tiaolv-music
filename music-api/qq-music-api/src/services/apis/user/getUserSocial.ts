import request from '../../../util/request';
import { handleApi } from '../../../util/apiResponse';
import { callUserMusicu } from './userMusicu';

interface UserSocialParams {
	uin: string;
	page?: number;
	limit?: number;
	cookie?: string;
}

export const getUserFollowSingers = async ({ page = 1, limit = 20, cookie }: UserSocialParams) =>
	callUserMusicu({
		module: 'music.concern.RelationList',
		method: 'GetFollowSingerList',
		param: {
			From: (page - 1) * limit,
			Size: limit,
			HostUin: '',
		},
		cookie,
	});

const getUserFollowOrFans = async ({ uin, page = 1, limit = 20, cookie }: UserSocialParams) =>
	handleApi(
		request({
			url: '/rsc/fcgi-bin/friend_follow_or_listen_list.fcg',
			method: 'GET',
			cookie,
			options: {
				params: {
					utf8: 1,
					start: (page - 1) * limit,
					num: limit,
					uin,
					format: 'json',
					g_tk: 5381,
				},
			},
		}),
	);

export const getUserFollowUsers = (params: UserSocialParams) => getUserFollowOrFans(params);

export const getUserFans = async ({ page = 1, limit = 20, cookie }: UserSocialParams) =>
	callUserMusicu({
		module: 'music.concern.RelationList',
		method: 'GetFansList',
		param: {
			From: (page - 1) * limit,
			Size: limit,
			HostUin: '',
		},
		cookie,
	});
