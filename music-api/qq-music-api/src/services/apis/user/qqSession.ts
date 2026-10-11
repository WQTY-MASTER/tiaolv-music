import { createHash } from 'node:crypto';
import { extractCookieValue } from '../../../util/cookieResolver';
import request from '../../../util/request';

// Keep renewed tickets private to the supplied credential, never the global user.
// The bounded cache also retains rotated refresh tokens for subsequent renewals.
const sessions = new Map<string, string>();
const refreshing = new Map<string, Promise<string | undefined>>();
const sessionKey = (cookie: string) => createHash('sha256').update(cookie).digest('hex');
const normalizeUin = (uin: string) => uin.replace(/^o/, '').replace(/^0+/, '');

export const getRenewedCookie = (cookie: string): string => sessions.get(sessionKey(cookie)) || cookie;

export const refreshQqSession = async (originalCookie: string, failedCookie: string): Promise<string | undefined> => {
	const key = sessionKey(originalCookie);
	const current = getRenewedCookie(originalCookie);
	if (current !== failedCookie) return current;
	const pending = refreshing.get(key);
	if (pending) return pending;
	const refresh = renew(current)
		.then(cookie => {
			if (cookie) {
				sessions.delete(key);
				sessions.set(key, cookie);
				if (sessions.size > 64) sessions.delete(sessions.keys().next().value!);
			}
			return cookie;
		})
		.finally(() => refreshing.delete(key));
	refreshing.set(key, refresh);
	return refresh;
};

async function renew(cookie: string): Promise<string | undefined> {
	const value = (name: string) => extractCookieValue(cookie, name) || '';
	const uin = normalizeUin(value('uin'));
	const musickey = value('qm_keyst') || value('qqmusic_key');
	const openid = value('psrf_qqopenid');
	const accessToken = value('psrf_qqaccess_token');
	const refreshToken = value('psrf_qqrefresh_token');
	if (!/^\d+$/.test(uin) || !musickey || !openid || !accessToken || !refreshToken) return;
	if (value('tmeLoginType') && value('tmeLoginType') !== '2') return;

	try {
		const result = await request({
			url: 'https://u.y.qq.com/cgi-bin/musicu.fcg',
			method: 'POST',
			isUUrl: 'u',
			cookie,
			options: {
				headers: { 'Content-Type': 'application/json', Referer: 'https://y.qq.com/' },
				data: JSON.stringify({
					comm: { uin, authst: musickey, ct: 19, cv: 0, tmeLoginType: 2 },
					req_1: {
						module: 'music.login.LoginServer',
						method: 'Login',
						param: {
							openid,
							access_token: accessToken,
							refresh_token: refreshToken,
							expired_in: Number(value('psrf_access_token_expiresAt')) || 0,
							musicid: Number(uin),
							musickey,
							refresh_key: value('refresh_key'),
							loginMode: 2,
						},
					},
				}),
			},
		});
		const response = result.data;
		const data = response?.req_1?.data;
		if (response?.code !== 0 || response?.req_1?.code !== 0 || !data) return;
		if (typeof data.musickey !== 'string' || !data.musickey.trim()) return;
		if (normalizeUin(String(data.musicid ?? data.str_musicid ?? '')) !== uin) return;
		if (data.loginType !== undefined && Number(data.loginType) !== 2) return;
		const updates: Record<string, unknown> = {
			uin,
			qm_keyst: data.musickey,
			qqmusic_key: data.musickey,
			tmeLoginType: 2,
			psrf_qqopenid: data.openid,
			psrf_qqaccess_token: data.access_token,
			psrf_qqrefresh_token: data.refresh_token,
			psrf_access_token_expiresAt: data.expired_at,
			psrf_musickey_createtime: data.musickeyCreateTime,
			refresh_key: data.refresh_key,
			euin: data.encryptUin,
		};
		const pairs = new Map(
			cookie.split(';').map(part => {
				const separator = part.indexOf('=');
				return [part.slice(0, separator).trim(), part.slice(separator + 1).trim()];
			}),
		);
		for (const [name, content] of Object.entries(updates)) {
			if (content !== undefined && content !== null && String(content) !== '') pairs.set(name, String(content));
		}
		return [...pairs].map(([name, content]) => `${name}=${content}`).join('; ');
	} catch {
		// Never log a request config containing credentials, or conceal the original failure.
		return undefined;
	}
}
