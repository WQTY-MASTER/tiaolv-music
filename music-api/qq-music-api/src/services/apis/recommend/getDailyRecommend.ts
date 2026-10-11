import { getCommonParams } from '../../config'
import uCommon from '../u_common'
import { handleApi } from '../../../util/apiResponse'
import { extractCookieValue, extractUinFromCookie } from '../../../util/cookieResolver'

const DEFAULT_NEW_SONG_TYPE = 5

function normalizeNewSongType(areaId: number) {
  return Number.isInteger(areaId) && areaId >= 1 && areaId <= 5
    ? areaId
    : DEFAULT_NEW_SONG_TYPE
}

/**
 * 获取每日推荐歌曲
 * @param cookie - 用户 Cookie（可选，用于获取个性化推荐）
 * @returns 每日推荐歌曲列表
 */
export async function getDailyRecommend(cookie?: string) {
  return handleApi(loadDailyRecommend(cookie))
}

async function loadDailyRecommend(cookie?: string) {
  const uin = (extractUinFromCookie(cookie) || '0').replace(/^o0*/, '') || '0'
  const authst =
    extractCookieValue(cookie, 'qm_keyst') ||
    extractCookieValue(cookie, 'qqmusic_key') ||
    extractCookieValue(cookie, 'music_key') ||
    extractCookieValue(cookie, 'p_skey')
  const comm: Record<string, string | number> = {
    uin,
    format: 'json',
    ct: authst ? 19 : 24,
    cv: 0
  }
  if (authst) comm.authst = authst

  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (cookie) headers.cookie = cookie

  const songlist: unknown[] = []
  const seen = new Set<string>()
  let firstPayload: any

  // QQ's radio endpoint returns only a few tracks per request. Pull several
  // batches so the desktop daily mix can present a full recommendation set.
  for (let batch = 0; batch < 12 && songlist.length < 30; batch += 1) {
    const response: any = await uCommon({
      method: 'POST',
      options: {
        data: JSON.stringify({
          comm,
          radio: {
            module: 'music.radioProxy.MbTrackRadioSvr',
            method: 'get_radio_track',
            param: {}
          }
        }),
        headers
      }
    })
    const payload = response?.data ?? response
    firstPayload ??= payload
    const radio = payload?.radio
    if (!radio || Number(radio.code || 0) !== 0) {
      break
    }
    const data = radio.data || {}
    const tracks = [data.track, data.songList, data.vec_song, data.tracks]
      .find(Array.isArray) || []
    for (const track of tracks) {
      const key = String(track?.mid || track?.songmid || track?.id || '')
      if (!key || seen.has(key)) continue
      seen.add(key)
      songlist.push(track)
      if (songlist.length >= 30) break
    }
    // Consecutive radio calls can repeat a batch before the recommendation
    // cursor advances, so keep polling up to the fixed cap.
  }

  if (songlist.length === 0 && firstPayload) {
    return firstPayload
  }
  return {
    code: 0,
    recommend: {
      code: 0,
      data: {
        songlist,
        total: songlist.length
      }
    }
  }
}

/**
 * 获取私人 FM
 * @param cookie - 用户 Cookie
 * @returns 私人 FM 歌曲列表
 */
export async function getPrivateFM(cookie?: string) {
  const data = {
    comm: {
      ...getCommonParams(),
      ct: 24,
      cv: 0
    },
    fm: {
      method: 'GetPrivateFmPlaylist',
      module: 'music.web_fm_svr',
      param: {
        enc: 'utf8',
        moter: 0,
        uin: 0,
        login: 0
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

/**
 * 获取新歌速递
 * @param areaId - 地区 ID（兼容旧参数，当前映射到新歌类型，暂定映射关系）
 * @param limit - 返回数量（当前上游接口固定类型，limit 仅用于兼容入参）
 * @returns 新歌列表
 */
export async function getNewSongs(areaId: number = DEFAULT_NEW_SONG_TYPE, limit: number = 20) {
  const normalizedType = normalizeNewSongType(areaId)
  const normalizedLimit = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 20

  const data = {
    comm: {
      ...getCommonParams(),
      ct: 24,
      cv: 0
    },
    new_song: {
      module: 'newsong.NewSongServer',
      method: 'get_new_song_info',
      param: {
        type: normalizedType,
        num: normalizedLimit
      }
    }
  }

  return handleApi(
    uCommon({
      method: 'POST',
      options: {
        data: JSON.stringify(data),
        headers: {
          'Content-Type': 'application/json'
        }
      }
    })
  )
}

export default {
  getDailyRecommend,
  getPrivateFM,
  getNewSongs
}
