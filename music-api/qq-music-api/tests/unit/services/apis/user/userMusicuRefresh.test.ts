const { requestMock } = vi.hoisted(() => ({ requestMock: vi.fn() }));
vi.mock('../../../../../src/util/request', () => ({ default: requestMock }));

const cookie =
	'uin=o200; qm_keyst=expired; qqmusic_key=expired; tmeLoginType=2; psrf_qqopenid=open; psrf_qqaccess_token=access; psrf_qqrefresh_token=refresh';
const denied = { data: { code: 0, req_1: { code: 1000 } } };
const success = { data: { code: 0, req_1: { code: 0, data: { List: [{ MID: 'singer' }] } } } };
const renewed = (musicid = 200) => ({
	data: {
		code: 0,
		req_1: {
			code: 0,
			data: {
				musicid,
				musickey: 'renewed',
				loginType: 2,
				access_token: 'new-access',
				refresh_token: 'new-refresh',
				refresh_key: 'refresh-key',
			},
		},
	},
});
const options = {
	module: 'music.concern.RelationList',
	method: 'GetFollowSingerList',
	param: { From: 0, Size: 20 },
	cookie,
};

describe('expired QQ music sessions', () => {
	beforeEach(() => {
		vi.resetModules();
		requestMock.mockReset();
	});

	it('refreshes an expired ticket, retries with matching Cookie/authst/sign, and reuses it', async () => {
		const { callUserMusicu, zzcSign } = await import('../../../../../src/services/apis/user/userMusicu');
		requestMock.mockResolvedValueOnce(denied).mockResolvedValueOnce(renewed()).mockResolvedValue(success);
		const result = await callUserMusicu({ ...options, signed: true });
		expect(result.body.response).toEqual(success.data);
		const refresh = JSON.parse(requestMock.mock.calls[1][0].options.data);
		expect(refresh.req_1).toMatchObject({
			module: 'music.login.LoginServer',
			method: 'Login',
			param: {
				musicid: 200,
				musickey: 'expired',
				openid: 'open',
				access_token: 'access',
				refresh_token: 'refresh',
				loginMode: 2,
			},
		});
		expect(refresh.comm.tmeLoginType).toBe(2);
		const retry = requestMock.mock.calls[2][0];
		expect(retry.cookie).toContain('qm_keyst=renewed');
		expect(retry.cookie).toContain('qqmusic_key=renewed');
		expect(JSON.parse(retry.options.data).comm.authst).toBe('renewed');
		expect(retry.options.params.sign).toBe(zzcSign(retry.options.data));
		await callUserMusicu(options);
		expect(requestMock).toHaveBeenCalledTimes(4);
		expect(requestMock.mock.calls[3][0].cookie).toContain('qm_keyst=renewed');
	});

	it('coalesces concurrent refreshes for one credential', async () => {
		const { callUserMusicu } = await import('../../../../../src/services/apis/user/userMusicu');
		requestMock.mockImplementation(async config => {
			const payload = JSON.parse(config.options.data);
			if (payload.req_1.method === 'Login') return renewed();
			return payload.comm.authst === 'renewed' ? success : denied;
		});
		const results = await Promise.all([callUserMusicu(options), callUserMusicu(options)]);
		expect(results.map(r => r.body.response)).toEqual([success.data, success.data]);
		expect(requestMock.mock.calls.filter(([c]) => JSON.parse(c.options.data).req_1.method === 'Login')).toHaveLength(1);
	});

	it('retains the website contract and rebuilds GTK and signature after renewal', async () => {
		const { callUserMusicu, zzcSign } = await import('../../../../../src/services/apis/user/userMusicu');
		const { getGtk } = await import('../../../../../src/util/loginUtils');
		requestMock.mockResolvedValueOnce(denied).mockResolvedValueOnce(renewed()).mockResolvedValue(success);
		await callUserMusicu({ ...options, signed: true, webClient: true });
		const retry = requestMock.mock.calls[2][0];
		expect(JSON.parse(retry.options.data).comm).toMatchObject({ ct: 24, cv: 4747474, g_tk: getGtk('renewed') });
		expect(JSON.parse(retry.options.data).comm).not.toHaveProperty('authst');
		expect(retry.cookie).toContain('qm_keyst=renewed');
		expect(retry.options.params.sign).toBe(zzcSign(retry.options.data));
	});

	it('preserves the original auth failure when renewal fails and does not retry a write', async () => {
		const { callUserMusicu } = await import('../../../../../src/services/apis/user/userMusicu');
		requestMock.mockResolvedValueOnce(denied).mockResolvedValueOnce({ data: { code: 0, req_1: { code: 1000 } } });
		const result = await callUserMusicu({ ...options, method: 'AddSonglist', signed: true });
		expect(result.body.response).toEqual(denied.data);
		expect(requestMock).toHaveBeenCalledTimes(2);
	});

	it('rejects a refreshed ticket belonging to another account', async () => {
		const { callUserMusicu } = await import('../../../../../src/services/apis/user/userMusicu');
		requestMock.mockResolvedValueOnce(denied).mockResolvedValueOnce(renewed(999));
		expect((await callUserMusicu(options)).body.response).toEqual(denied.data);
		expect(requestMock).toHaveBeenCalledTimes(2);
	});

	it('does not replay an operation after a non-authentication error', async () => {
		const { callUserMusicu } = await import('../../../../../src/services/apis/user/userMusicu');
		const failure = { code: 0, req_1: { code: 42 } };
		requestMock.mockResolvedValue({ data: failure });
		expect((await callUserMusicu(options)).body.response).toEqual(failure);
		expect(requestMock).toHaveBeenCalledTimes(1);
	});

	it('does not use another session when an explicit cookie lacks renewal credentials', async () => {
		const { callUserMusicu } = await import('../../../../../src/services/apis/user/userMusicu');
		requestMock.mockResolvedValue(denied);
		expect((await callUserMusicu({ ...options, cookie: 'uin=300; qm_keyst=other' })).body.response).toEqual(
			denied.data,
		);
		expect(requestMock).toHaveBeenCalledTimes(1);
	});
});
