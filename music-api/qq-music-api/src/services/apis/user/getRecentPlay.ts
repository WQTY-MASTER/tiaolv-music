import { callUserMusicu } from './userMusicu';

/**
 * Fetch the authenticated account's QQ Music cloud playback history.
 * type=2 selects songs; updateTime=0 requests a full snapshot.
 */
export const getRecentPlay = async ({ cookie, useOriginalSession }: { cookie?: string; useOriginalSession?: boolean }) =>
	callUserMusicu({
		module: 'music.musicasset.PlayRecentlyRead',
		method: 'GetPlayRecentlyInfo',
		param: { type: 2, updateTime: 0 },
		cookie,
		useOriginalSession,
	});
