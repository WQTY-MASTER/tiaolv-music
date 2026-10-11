import type { ApiResponse } from '../../../types/api';
import { callUserMusicu } from '../user/userMusicu';

export type QqSearchType = 'song' | 'playlist' | 'artist';

const SEARCH_TYPE_CODES: Record<QqSearchType, number> = {
  song: 0,
  artist: 1,
  playlist: 3,
};

export default ({
  key,
  type,
  page = 1,
  limit = 20,
  cookie,
}: {
  key: string;
  type: QqSearchType;
  page?: number;
  limit?: number;
  cookie?: string;
}): Promise<ApiResponse> =>
  callUserMusicu({
    module: 'music.search.SearchCgiService',
    method: 'DoSearchForQQMusicDesktop',
    param: {
      query: key,
      search_type: SEARCH_TYPE_CODES[type],
      page_num: page,
      num_per_page: limit,
    },
    cookie,
  });
