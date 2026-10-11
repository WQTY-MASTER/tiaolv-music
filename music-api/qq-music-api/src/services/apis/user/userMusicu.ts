import { createHash } from 'node:crypto';
import { isAxiosError, type Method } from 'axios';
import { decodeAG1Response, encodeAG1Request } from '@jixun/qmweb-sign';
import { getUserInfo, getUserUin } from '../../../config/user-info-store';
import { extractCookieValue, extractUinFromCookie } from '../../../util/cookieResolver';
import { getGtk } from '../../../util/loginUtils';
import { errorResponse, successResponse } from '../../../util/apiResponse';
import request from '../../../util/request';
import type { ApiResponse } from '../../../types/api';
import { getRenewedCookie, refreshQqSession } from './qqSession';

const PART_1_INDEXES = [23, 14, 6, 36, 16, 7, 19];
const PART_2_INDEXES = [16, 1, 32, 12, 19, 27, 8, 5];
const SCRAMBLE_VALUES = [89, 39, 179, 150, 218, 82, 58, 252, 177, 52, 186, 123, 120, 64, 242, 133, 143, 161, 121, 179];

export const zzcSign = (payload: string): string => {
	const hash = createHash('sha1').update(payload, 'utf8').digest('hex').toUpperCase();
	const part1 = PART_1_INDEXES.map(index => hash[index]).join('');
	const part2 = PART_2_INDEXES.map(index => hash[index]).join('');
	const part3 = Buffer.from(
		SCRAMBLE_VALUES.map((value, index) => value ^ Number.parseInt(hash.slice(index * 2, index * 2 + 2), 16)),
	);
	const base64 = part3.toString('base64').replace(/[\\/+=]/g, '');
	return `zzc${part1}${base64}${part2}`.toLowerCase();
};

const getEffectiveCookie = (cookie?: string): string | undefined =>
	cookie === undefined ? getUserInfo().cookie : cookie;

const resolveUin = (cookie?: string): string => {
	const effectiveCookie = getEffectiveCookie(cookie);
	const rawUin = extractUinFromCookie(effectiveCookie) || (cookie === undefined ? getUserUin('') : '');
	const digits = rawUin.replace(/\D/g, '').replace(/^0+/, '');
	return digits || rawUin;
};

const buildComm = (cookie?: string, webClient = false): Record<string, unknown> => {
	const effectiveCookie = getEffectiveCookie(cookie);
	const uin = resolveUin(cookie);
	const authst =
		extractCookieValue(effectiveCookie, 'qm_keyst') ||
		extractCookieValue(effectiveCookie, 'qqmusic_key') ||
		extractCookieValue(effectiveCookie, 'music_key');
	const pSkey = extractCookieValue(effectiveCookie, 'p_skey');
	const webKey = extractCookieValue(effectiveCookie, 'qqmusic_key');
	const skey = extractCookieValue(effectiveCookie, 'skey');
	const gtkKey = webClient ? skey || webKey : pSkey;
	const gtk = gtkKey ? getGtk(gtkKey) : webClient ? 5381 : undefined;
	// The official Web SDK uses different cookie precedence for these tokens.
	const modernGtk = webClient
		? getGtk(webKey || pSkey || skey || extractCookieValue(effectiveCookie, 'p_lskey') || extractCookieValue(effectiveCookie, 'lskey') || '')
		: gtk;
	const loginType = extractCookieValue(effectiveCookie, 'tmeLoginType');

	return {
		uin,
		...(webClient ? {} : { loginUin: uin }),
		format: 'json',
		ct: !webClient && authst ? 19 : 24,
		cv: !webClient && authst ? 0 : 4747474,
		platform: 'yqq.json',
		inCharset: 'utf-8',
		outCharset: 'utf-8',
		notice: 0,
		needNewCode: 1,
		...(!webClient && authst ? { authst } : {}),
		...(!webClient && loginType ? { tmeLoginType: Number(loginType) } : {}),
		...(gtk === undefined ? {} : { g_tk: gtk, g_tk_new_20200303: modernGtk }),
	};
};

interface UserMusicuOptions {
	module: string;
	method: string;
	param: Record<string, unknown>;
	cookie?: string;
	signed?: boolean;
	// Select the website's Cookie/GTK payload. Business rejection codes must
	// still be checked by the caller; this mode does not guarantee write access.
	webClient?: boolean;
	encryptedWeb?: boolean;
	// A renewed read session does not establish Web write authorization.
	useOriginalSession?: boolean;
}

const sendUserMusicu = async ({ module, method, param, cookie, signed = false, webClient = false, encryptedWeb = false }: UserMusicuOptions) => {
	const payload = {
		comm: buildComm(cookie, webClient),
		req_1: { module, method, param },
	};
	const serializedPayload = JSON.stringify(payload);

	const response = await request({
		url: `https://${encryptedWeb ? 'u6' : 'u'}.y.qq.com/cgi-bin/${signed || encryptedWeb ? 'musics' : 'musicu'}.fcg`,
		method: 'POST' as Method,
		isUUrl: 'u',
		cookie,
		options: {
			headers: { 'Content-Type': encryptedWeb ? 'text/plain' : 'application/json', Referer: 'https://y.qq.com/' },
			data: encryptedWeb ? await encodeAG1Request(serializedPayload) : serializedPayload,
			...(encryptedWeb ? { responseType: 'arraybuffer' as const } : {}),
			...(signed || encryptedWeb
				? {
						params: {
							_: Date.now(),
							...(encryptedWeb ? { encoding: 'ag-1' } : {}),
							sign: zzcSign(serializedPayload),
						},
					}
				: {}),
		},
	});
	if (encryptedWeb) response.data = JSON.parse(decodeAG1Response(new Uint8Array(response.data)));
	return response;
};

const isExpiredSession = (response: ApiResponse): boolean => {
	const data = response.body.response as { code?: number; req_1?: { code?: number } } | undefined;
	return [data?.code, data?.req_1?.code].some(code => code === 1000 || code === 104400 || code === 104401);
};

export const callUserMusicu = async (options: UserMusicuOptions): Promise<ApiResponse> => {
	const originalCookie = getEffectiveCookie(options.cookie) || '';
	const cookie = options.useOriginalSession ? originalCookie : getRenewedCookie(originalCookie);
	const send = async (currentCookie: string): Promise<ApiResponse> => {
		try {
			return successResponse((await sendUserMusicu({ ...options, cookie: currentCookie })).data);
		} catch (error) {
			const status = isAxiosError(error) ? error.response?.status : undefined;
			// Keep rate-limit status visible to callers; never log the credential-bearing request.
			return status === 403 || status === 429
				? errorResponse('QQ 音乐暂时限制操作，请稍后再试', status)
				: errorResponse('服务器内部错误', 500);
		}
	};
	const response = await send(cookie);
	if (options.useOriginalSession || !originalCookie || !isExpiredSession(response)) return response;
	const renewed = await refreshQqSession(originalCookie, cookie);
	// Retry once, and only after an explicit authentication rejection. Never retry
	// timeouts or other failures where a write might already have been applied.
	return renewed ? send(renewed) : response;
};
