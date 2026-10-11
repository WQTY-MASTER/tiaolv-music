import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import checkQQLoginQr from '../../src/services/apis/user/checkQQLoginQr';

const response = (body: string, headers: Record<string, string> = {}, status = 200): Response =>
	new Response(body, { status, headers });

function confirmedScan(login: Response) {
	vi.mocked(fetch)
		.mockResolvedValueOnce(response(
			"ptuiCB('0','0','https://graph.qq.com/check_sig?ticket=test','0','登录成功！','User');",
			{ 'Set-Cookie': 'uin=o123456; Path=/; HttpOnly' },
		))
		.mockResolvedValueOnce(response('', { 'Set-Cookie': 'p_skey=test-graph-ticket; Path=/' }, 302))
		.mockResolvedValueOnce(response('', { Location: 'https://y.qq.com/portal/wx_redirect.html?code=test-code' }, 302))
		.mockResolvedValueOnce(login);
}

const check = () => checkQQLoginQr({ params: { qrsig: 'test-sig', ptqrtoken: '123' } });

describe('QQ QR music credential exchange', () => {
	beforeEach(() => vi.stubGlobal('fetch', vi.fn()));
	afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

	test('rejects business failure even if the response includes music cookies', async () => {
		confirmedScan(response('{"code":0,"req":{"code":1000}}', {
			'Set-Cookie': 'qqmusic_key=invalid-ticket; Path=/',
		}));
		const result = await check();
		expect(result.status).toBe(502);
		expect(result.body).not.toHaveProperty('session');
		expect(result.body).not.toHaveProperty('isOk', true);
	});

	test('rejects malformed JSON instead of marking the scan as authenticated', async () => {
		confirmedScan(response('<html>upstream failure</html>', {
			'Set-Cookie': 'qqmusic_key=invalid-ticket; Path=/',
		}));
		expect((await check()).status).toBe(502);
	});

	test('rejects missing music credentials despite a successful QQ account scan', async () => {
		confirmedScan(response('{"code":0,"req":{"code":0,"data":{}}}'));
		const result = await check();
		expect(result.status).toBe(502);
		expect(result.body).not.toHaveProperty('session');
	});

	test('rejects a missing operation code and HTTP failures', async () => {
		confirmedScan(response('{"code":0}', { 'Set-Cookie': 'qqmusic_key=test-ticket; Path=/' }));
		expect((await check()).status).toBe(502);
		vi.mocked(fetch).mockReset();
		confirmedScan(response('{"code":0,"req":{"code":0}}', {
			'Set-Cookie': 'qqmusic_key=test-ticket; Path=/',
		}, 503));
		expect((await check()).status).toBe(502);
	});

	test('keeps complete music cookies and encrypted identity on a confirmed exchange', async () => {
		const login = response('{"code":0,"req":{"code":0,"data":{"encryptUin":"encrypted-test-id"}}}');
		login.headers.append('Set-Cookie', 'uin=123456; Path=/; HttpOnly');
		login.headers.append('Set-Cookie', 'qqmusic_key=test-key==; Path=/; HttpOnly');
		login.headers.append('Set-Cookie', 'qm_keyst=test-key==; Path=/; HttpOnly');
		confirmedScan(login);
		const result = await check();
		expect(result.status).toBe(200);
		expect(result.body).toMatchObject({ isOk: true, session: {
			uin: '123456', euin: 'encrypted-test-id',
			cookieObject: { uin: '123456', qqmusic_key: 'test-key==', qm_keyst: 'test-key==' },
		} });
	});
});
