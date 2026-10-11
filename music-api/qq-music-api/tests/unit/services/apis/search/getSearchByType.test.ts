import { beforeEach, describe, expect, it, vi } from 'vitest';

const { callUserMusicu } = vi.hoisted(() => ({ callUserMusicu: vi.fn() }));

vi.mock('../../../../../src/services/apis/user/userMusicu', () => ({
  callUserMusicu,
}));

describe('getSearchByType', () => {
  beforeEach(() => {
    callUserMusicu.mockReset();
    callUserMusicu.mockResolvedValue({ status: 200, body: { response: {} } });
  });

  it('uses QQ Music playlist search with the request cookie', async () => {
    const { default: getSearchByType } = await import(
      '../../../../../src/services/apis/search/getSearchByType'
    );

    await getSearchByType({
      key: '鸣潮',
      type: 'playlist',
      page: 3,
      limit: 8,
      cookie: 'uin=o200; qm_keyst=secret',
    });

    expect(callUserMusicu).toHaveBeenCalledWith({
      module: 'music.search.SearchCgiService',
      method: 'DoSearchForQQMusicDesktop',
      param: {
        query: '鸣潮',
        search_type: 3,
        page_num: 3,
        num_per_page: 8,
      },
      cookie: 'uin=o200; qm_keyst=secret',
    });
  });
});
