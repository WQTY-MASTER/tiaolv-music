import { KoaContext } from '../routes/types';
import { UCommon } from '../services';
import { setApiResponse, withErrorHandler } from './util';
import { customResponse } from '../util/apiResponse';
import {
  findSongListLocation,
  normalizeSongItem,
  type NormalizedSong,
  type RankResponseShape,
} from '../util/song-normalize';

interface SongDetailTrack extends NormalizedSong {
  interval?: number;
  album?: unknown;
  singer?: unknown;
  file?: unknown;
  pay?: unknown;
}

interface SongDetailResponse {
  songinfo?: {
    data?: {
      track_info?: SongDetailTrack;
      trackInfo?: SongDetailTrack;
    };
  };
}

const MID_RESOLVE_CONCURRENCY = 5;

/**
 * Fetch playable song details by numeric song id.
 * Logs errors so upstream / network issues remain visible while returning
 * undefined when no track data is available for a given song.
 */
const fetchSongDetailBySongId = async (songId: number): Promise<SongDetailTrack | undefined> => {
  try {
    const response = await UCommon({
      method: 'get',
      params: {
        format: 'json',
        data: JSON.stringify({
          comm: {
            ct: 24,
            cv: 0,
          },
          songinfo: {
            method: 'get_song_detail_yqq',
            param: {
              song_type: 0,
              song_mid: '',
              song_id: songId,
            },
            module: 'music.pf_song_detail_svr',
          },
        }),
      },
      option: {},
    });

    const data = response.data as SongDetailResponse;
    return data?.songinfo?.data?.track_info ?? data?.songinfo?.data?.trackInfo;
  } catch (error) {
    console.error('[getRanks] Failed to resolve song mid by song id:', error);
    return undefined;
  }
};

const resolveSongDetails = async (songs: NormalizedSong[]): Promise<Map<number, SongDetailTrack>> => {
  const songIds = [
    ...new Set(
      songs.flatMap(song => {
        if (song.song_mid || song.mid || song.songId === undefined) return [];
        const songId = Number(song.songId);
        return Number.isFinite(songId) ? [songId] : [];
      }),
    ),
  ];
  const detailBySongId = new Map<number, SongDetailTrack>();
  let nextIndex = 0;

  const worker = async (): Promise<void> => {
    while (nextIndex < songIds.length) {
      const songId = songIds[nextIndex];
      nextIndex += 1;
      const detail = await fetchSongDetailBySongId(songId);
      if (detail?.mid) detailBySongId.set(songId, detail);
    }
  };

  const workerCount = Math.min(MID_RESOLVE_CONCURRENCY, songIds.length);
  await Promise.all(Array.from({ length: workerCount }, worker));
  return detailBySongId;
};

const getRanksController = withErrorHandler(async (ctx: KoaContext) => {
  const getWeekNumber = (d: Date): number => {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  };

  const topId = +ctx.query.topId || 4;
  const num = +ctx.query.limit || 20;
  const offset = +ctx.query.page || 0;
  const resolveMidRaw = Array.isArray(ctx.query.resolveMid)
    ? ctx.query.resolveMid[0]
    : ctx.query.resolveMid;
  const resolveMid = resolveMidRaw === 'true';

  const date = new Date();
  const week = getWeekNumber(date);
  const isoWeekYearVal = date.getFullYear();
  const period = `${isoWeekYearVal}_${week}`;

  const data = {
    comm: {
      ct: 24,
      cv: 4747474,
      format: 'json',
      inCharset: 'utf-8',
      needNewCode: 1,
      uin: 0,
    },
    req_1: {
      module: 'musicToplist.ToplistInfoServer',
      method: 'GetDetail',
      param: {
        topId,
        offset,
        num,
        period,
      },
    },
  };

  const params = {
    format: 'json',
    data: JSON.stringify(data),
  };

  const props = {
    method: 'get',
    params,
    option: {},
  };

  const response = await UCommon(props);
  const responseData = response.data as RankResponseShape;

  const location = findSongListLocation(responseData);
  if (location) {
    const songList = location.container[location.key] as NormalizedSong[];

    const normalizedList = songList.slice(0, num).map(normalizeSongItem);

    if (resolveMid) {
      const detailBySongId = await resolveSongDetails(normalizedList);
      normalizedList.forEach(song => {
        if (song.song_mid || song.mid || song.songId === undefined) return;
        const detail = detailBySongId.get(Number(song.songId));
        if (!detail?.mid) return;
        song.song_mid = detail.mid;
        song.mid = detail.mid;
        for (const key of ['interval', 'album', 'singer', 'file', 'pay'] as const) {
          if (detail[key] !== undefined) song[key] = detail[key];
        }
      });
    }

    location.container[location.key] = normalizedList;
  }

  setApiResponse(ctx, customResponse({ response: responseData }, 200));
});

export default getRanksController;
