import { setUserInfo } from '../../../../../src/config/user-info-store';
import { callUserMusicu, zzcSign } from '../../../../../src/services/apis/user/userMusicu';
import { getGtk } from '../../../../../src/util/loginUtils';

const { requestMock } = vi.hoisted(() => ({ requestMock: vi.fn() }));

vi.mock('../../../../../src/util/request', () => ({ default: requestMock }));

describe('services/apis/user/userMusicu', () => {
	beforeEach(() => {
		requestMock.mockReset().mockResolvedValue({ data: { code: 0 } });
		setUserInfo({
			loginUin: 'global-login',
			uin: 'global-uin',
			cookie: 'uin=global-cookie; qqmusic_key=global-key; p_skey=global-skey',
			cookieList: [],
			cookieObject: {},
			refreshData: () => ({}),
		});
	});

	test('generates the canonical zzc signature for a fixed payload', () => {
		expect(zzcSign('123')).toBe('zzcec1b555gzqzg7laztguyjl2bu20r6x1w50c55f60');
	});

	test.each([403, 429])('preserves upstream HTTP %s without retrying or exposing credentials', async status => {
		requestMock.mockRejectedValue({ isAxiosError: true, response: { status }, config: { headers: { Cookie: 'secret' } } });
		const result = await callUserMusicu({ module: 'music.musicasset.PlaylistDetailWrite', method: 'SeqSonglist', param: {}, cookie: 'uin=200' });
		expect(result.status).toBe(status);
		expect(JSON.stringify(result)).not.toContain('secret');
		expect(requestMock).toHaveBeenCalledTimes(1);
	});

	test('does not mix default-session credentials into an explicit cookie', async () => {
		await callUserMusicu({
			module: 'test.module',
			method: 'TestMethod',
			param: {},
			cookie: 'uin=request-user',
		});

		const payload = JSON.parse(requestMock.mock.calls[0][0].options.data);
		expect(payload.comm).toMatchObject({ uin: 'request-user', loginUin: 'request-user' });
		expect(payload.comm).not.toHaveProperty('authst');
		expect(payload.comm).not.toHaveProperty('g_tk');
	});

	test('uses default-session credentials when no explicit cookie is provided', async () => {
		await callUserMusicu({
			module: 'test.module',
			method: 'TestMethod',
			param: {},
		});

		const payload = JSON.parse(requestMock.mock.calls[0][0].options.data);
		expect(payload.comm).toMatchObject({
			uin: 'global-cookie',
			loginUin: 'global-cookie',
			authst: 'global-key',
			ct: 19,
			cv: 0,
			g_tk: getGtk('global-skey'),
		});
	});

	test('prefers qm_keyst over the legacy qqmusic_key', async () => {
		await callUserMusicu({
			module: 'test.module',
			method: 'TestMethod',
			param: {},
			cookie: 'uin=o200; qm_keyst=current-key; qqmusic_key=legacy-key',
		});

		const payload = JSON.parse(requestMock.mock.calls[0][0].options.data);
		expect(payload.comm).toMatchObject({ uin: '200', loginUin: '200', authst: 'current-key' });
	});

	test('uses separate legacy and modern GTK values from the official website cookie contract', async () => {
		await callUserMusicu({
			module: 'music.musicasset.PlaylistDetailWrite',
			method: 'AddSonglist',
			param: { dirId: 201, v_songInfo: [{ songId: 123, songType: 0 }] },
			cookie: 'uin=o000200; qm_keyst=music-key; qqmusic_key=web-key; skey=legacy-key; p_skey=different-key; tmeLoginType=2',
			signed: true,
			webClient: true,
		});
		const request = requestMock.mock.calls[0][0];
		const { comm } = JSON.parse(request.options.data);
		expect(comm).toMatchObject({
			uin: '200',
			ct: 24,
			cv: 4747474,
			g_tk: getGtk('legacy-key'),
			g_tk_new_20200303: getGtk('web-key'),
		});
		expect(comm).not.toHaveProperty('authst');
		expect(comm).not.toHaveProperty('tmeLoginType');
		expect(comm).not.toHaveProperty('loginUin');
		expect(request.options.params.sign).toBe(zzcSign(request.options.data));
	});

	test.each([
		['uin=200; qqmusic_key=web; p_skey=ps', 'web', 'web'],
		['uin=200; p_skey=ps; skey=legacy', 'legacy', 'ps'],
		['uin=200; p_lskey=pls; lskey=ls', '', 'pls'],
		['uin=200; lskey=ls', '', 'ls'],
		['uin=200; qm_keyst=music-only', '', ''],
		['', '', ''],
	])('preserves the official Web GTK fallback order for %s', async (cookie, legacy, modern) => {
		await callUserMusicu({ module: 'test.module', method: 'Test', param: {}, cookie, webClient: true });
		const { comm } = JSON.parse(requestMock.mock.calls[0][0].options.data);
		expect(comm.g_tk).toBe(getGtk(legacy));
		expect(comm.g_tk_new_20200303).toBe(getGtk(modern));
	});
});
