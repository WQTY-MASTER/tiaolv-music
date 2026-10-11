import { expect, it, vi } from 'vitest';
import type { Context } from 'koa';
const report = vi.hoisted(() => vi.fn());
vi.mock('../../../src/services/apis/user/reportRecentPlay', () => ({ reportRecentPlay: report }));
vi.mock('../../../src/util/cookieResolver', () => ({ resolveRequestCookie: (ctx: Context) => ({ cookie: ctx.headers.cookie }) }));
import { reportRecentPlayController } from '../../../src/controllers/reportRecentPlay';

it('rejects missing or stringified playback fields before service use', async () => {
  for (const body of [{}, { songMid: 'mid1', sessionId: 'uuid', listenedSeconds: '30', totalSeconds: 180 }]) {
    const ctx = { request: { body }, headers: { cookie: 'uin=200' } } as unknown as Context;
    await reportRecentPlayController(ctx, async () => {});
    expect(ctx.status).toBe(400);
  }
  expect(report).not.toHaveBeenCalled();
});

it('forwards one validated POST payload and preserves service failure', async () => {
  report.mockResolvedValue({ status: 502, body: { error: 'QQ rejected' } });
  const body = { songMid: 'mid1', sessionId: 'uuid', listenedSeconds: 30, totalSeconds: 180 };
  const ctx = { request: { body }, headers: { cookie: 'uin=200' } } as unknown as Context;
  await reportRecentPlayController(ctx, async () => {});
  expect(report).toHaveBeenCalledWith({ ...body, cookie: 'uin=200' });
  expect(ctx.status).toBe(502);
});
