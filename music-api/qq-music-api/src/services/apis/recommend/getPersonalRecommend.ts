import { getCommonParams } from '../../config'
import uCommon from '../u_common'
import { handleApi } from '../../../util/apiResponse'
import { extractCookieValue, extractUinFromCookie } from '../../../util/cookieResolver'
import { getGtk } from '../../../util/loginUtils'

const PERSONAL_RECOMMEND_CONFIG = {
  1: {
    key: 'recomPlaylist',
    method: 'get_recommend',
    module: 'music.web_srf_svr',
    param: {
      page: 0,
      num: 20,
      uin: 0,
      login: 0
    }
  },
  2: {
    key: 'radio',
    method: 'get_radio_list',
    module: 'pf.radiosvr',
    param: {
      page_offset: 1,
      page_size: 20
    }
  },
  3: {
    key: 'mv',
    method: 'GetRecommendMV',
    module: 'gosrf.Stream.MvUrlProxy',
    param: {
      size: 20
    }
  }
} as const

const DEFAULT_PERSONAL_RECOMMEND_TYPE = 1
const DEFAULT_SIMILAR_SONG_LIMIT = 20

function resolveRecommendConfig(type: number) {
  return PERSONAL_RECOMMEND_CONFIG[
    type as keyof typeof PERSONAL_RECOMMEND_CONFIG
  ] || PERSONAL_RECOMMEND_CONFIG[DEFAULT_PERSONAL_RECOMMEND_TYPE]
}

/**
 * 获取个性化推荐
 * @param type - 推荐类型 (1: 歌单，2: 电台，3: MV)
 * @param cookie - 用户 Cookie
 * @returns 推荐列表
 */
export async function getPersonalRecommend(type: number = 1, cookie?: string) {
  const recommendConfig = resolveRecommendConfig(type)
  const rawUin = (extractUinFromCookie(cookie) || '0').replace(/^o?0*/, '')
  const uin = /^\d+$/.test(rawUin) ? rawUin : '0'
  const authst = extractCookieValue(cookie, 'qm_keyst') ||
    extractCookieValue(cookie, 'qqmusic_key') || extractCookieValue(cookie, 'music_key')
  const loggedIn = uin !== '0' && Boolean(authst)
  const data = {
    comm: {
      ...getCommonParams(),
      uin,
      loginUin: uin,
      g_tk: getGtk(authst || extractCookieValue(cookie, 'p_skey') || ''),
      ...(authst ? { authst } : {}),
      ct: 24,
      cv: 0
    },
    [recommendConfig.key]: {
      method: recommendConfig.method,
      module: recommendConfig.module,
      param: recommendConfig.key === 'recomPlaylist'
        ? { ...recommendConfig.param, uin, login: loggedIn ? 1 : 0 }
        : recommendConfig.param
    }
  }

  const headers: any = { 'Content-Type': 'application/json' }
  if (cookie) headers.cookie = cookie

  const result = await handleApi(
    uCommon({
      method: 'POST',
      options: {
        data: JSON.stringify(data),
        headers
      }
    }),
    { logError: false }
  )
  return {
    ...result,
    body: {
      ...result.body,
      recommendationContext: { accountId: loggedIn ? uin : null }
    }
  }
}

/**
 * 获取相似歌曲推荐
 * @param songmid - 歌曲 MID
 * @param cookie - 用户 Cookie
 * @returns 相似歌曲列表
 */
export async function getSimilarSongs(songmid: string, cookie?: string) {
  const data = {
    comm: {
      ...getCommonParams(),
      ct: 24,
      cv: 0
    },
    similarSong: {
      method: 'get_similar_song_info',
      module: 'music.web_srf_svr',
      param: {
        songid: 0,
        songmid,
        num: DEFAULT_SIMILAR_SONG_LIMIT
      }
    }
  }

  const headers: any = { 'Content-Type': 'application/json' }
  if (cookie) headers.cookie = cookie

  return handleApi(
    uCommon({
      method: 'POST',
      options: {
        data: JSON.stringify(data),
        headers
      }
    })
  )
}

export default {
  getPersonalRecommend,
  getSimilarSongs
}
