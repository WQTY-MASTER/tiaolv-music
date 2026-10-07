const STORAGE_KEY = "tiaolv-music.localListeningStats";
const LEGACY_STORAGE_KEY = "tingting.localListeningStats";

export interface TrackListeningStat {
  trackId: string;
  playCount: number;
  listenedSeconds: number;
  lastListenedAt: string;
  lastListenedDate: string;
}

export interface DayListeningStat {
  date: string;
  listenedSeconds: number;
}

export interface ListeningStatsState {
  revision: number;
  tracks: Record<string, TrackListeningStat>;
  days: Record<string, DayListeningStat>;
}

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function browserStorage(): StorageLike | undefined {
  return typeof window === "undefined" ? undefined : window.localStorage;
}

export function createEmptyListeningStats(): ListeningStatsState {
  return { revision: 0, tracks: {}, days: {} };
}

export function readListeningStats(storage: StorageLike | undefined = browserStorage()): ListeningStatsState {
  const raw = storage?.getItem(STORAGE_KEY) ?? storage?.getItem(LEGACY_STORAGE_KEY);
  if (!raw) {
    return createEmptyListeningStats();
  }

  try {
    const parsed = JSON.parse(raw) as Partial<ListeningStatsState>;
    return normalizeListeningStats({
      revision: safeRevision(parsed.revision),
      tracks: parsed.tracks && typeof parsed.tracks === "object" ? parsed.tracks : {},
      days: parsed.days && typeof parsed.days === "object" ? parsed.days : {}
    });
  } catch {
    return createEmptyListeningStats();
  }
}

export function writeListeningStats(
  stats: ListeningStatsState,
  storage: StorageLike | undefined = browserStorage()
) {
  storage?.setItem(STORAGE_KEY, JSON.stringify(stats));
}

export function mergeListeningStats(
  local: ListeningStatsState,
  persisted: ListeningStatsState
): ListeningStatsState {
  const localRevision = safeRevision(local?.revision);
  const persistedRevision = safeRevision(persisted?.revision);
  if (persistedRevision > localRevision) {
    return normalizeListeningStats(persisted);
  }
  if (localRevision > persistedRevision) {
    return normalizeListeningStats(local);
  }
  const tracks: Record<string, TrackListeningStat> = {};
  for (const trackId of new Set([
    ...Object.keys(local?.tracks ?? {}),
    ...Object.keys(persisted?.tracks ?? {})
  ])) {
    const left = local?.tracks?.[trackId];
    const right = persisted?.tracks?.[trackId];
    const lastListenedAt = latestTimestamp(left?.lastListenedAt, right?.lastListenedAt);
    const latest = lastListenedAt === left?.lastListenedAt ? left : right;
    tracks[trackId] = {
      trackId,
      playCount: Math.max(safeNumber(left?.playCount), safeNumber(right?.playCount)),
      listenedSeconds: Math.max(
        safeNumber(left?.listenedSeconds),
        safeNumber(right?.listenedSeconds)
      ),
      lastListenedAt,
      lastListenedDate: latest?.lastListenedDate || dateKeyFromTimestamp(lastListenedAt)
    };
  }

  const days: Record<string, DayListeningStat> = {};
  for (const date of new Set([
    ...Object.keys(local?.days ?? {}),
    ...Object.keys(persisted?.days ?? {})
  ])) {
    days[date] = {
      date,
      listenedSeconds: Math.max(
        safeNumber(local?.days?.[date]?.listenedSeconds),
        safeNumber(persisted?.days?.[date]?.listenedSeconds)
      )
    };
  }
  return { revision: localRevision, tracks, days };
}

function normalizeListeningStats(stats: ListeningStatsState): ListeningStatsState {
  const tracks = Object.fromEntries(Object.entries(stats?.tracks ?? {}).map(([trackId, stat]) => [
    trackId,
    {
      trackId,
      playCount: safeNumber(stat?.playCount),
      listenedSeconds: safeNumber(stat?.listenedSeconds),
      lastListenedAt: stat?.lastListenedAt || new Date(0).toISOString(),
      lastListenedDate: stat?.lastListenedDate || dateKeyFromTimestamp(stat?.lastListenedAt)
    }
  ]));
  const days = Object.fromEntries(Object.entries(stats?.days ?? {}).map(([date, stat]) => [
    date,
    { date, listenedSeconds: safeNumber(stat?.listenedSeconds) }
  ]));
  return { revision: safeRevision(stats?.revision), tracks, days };
}

function safeRevision(value: number | undefined) {
  return Number.isInteger(value) && Number(value) >= 0 ? Number(value) : 0;
}

function dateKeyFromTimestamp(value: string | undefined) {
  const parsed = new Date(value ?? "");
  return Number.isFinite(parsed.getTime()) ? toLocalDateKey(parsed) : "1970-01-01";
}

function safeNumber(value: number | undefined) {
  return Number.isFinite(value) ? Math.max(0, Number(value)) : 0;
}

function latestTimestamp(left: string | undefined, right: string | undefined) {
  const leftTime = Date.parse(left ?? "");
  const rightTime = Date.parse(right ?? "");
  if (Number.isFinite(leftTime) && (!Number.isFinite(rightTime) || leftTime >= rightTime)) {
    return left as string;
  }
  if (Number.isFinite(rightTime)) {
    return right as string;
  }
  return left || right || new Date(0).toISOString();
}

export function toLocalDateKey(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function recordListeningPlay(
  stats: ListeningStatsState,
  trackId: string,
  at = new Date()
): ListeningStatsState {
  const previous = stats.tracks[trackId];
  const date = toLocalDateKey(at);
  return {
    ...stats,
    tracks: {
      ...stats.tracks,
      [trackId]: {
        trackId,
        playCount: (previous?.playCount ?? 0) + 1,
        listenedSeconds: previous?.listenedSeconds ?? 0,
        lastListenedAt: at.toISOString(),
        lastListenedDate: date
      }
    }
  };
}

export function addListeningSeconds(
  stats: ListeningStatsState,
  trackId: string,
  seconds: number,
  at = new Date()
): ListeningStatsState {
  const safeSeconds = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  if (safeSeconds <= 0 || !trackId) {
    return stats;
  }

  const date = toLocalDateKey(at);
  const previousTrack = stats.tracks[trackId];
  const previousDay = stats.days[date];
  return {
    revision: stats.revision,
    tracks: {
      ...stats.tracks,
      [trackId]: {
        trackId,
        playCount: previousTrack?.playCount ?? 0,
        listenedSeconds: Math.round(((previousTrack?.listenedSeconds ?? 0) + safeSeconds) * 100) / 100,
        lastListenedAt: at.toISOString(),
        lastListenedDate: date
      }
    },
    days: {
      ...stats.days,
      [date]: {
        date,
        listenedSeconds: Math.round(((previousDay?.listenedSeconds ?? 0) + safeSeconds) * 100) / 100
      }
    }
  };
}

export function secondsToDisplayMinutes(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return 0;
  }
  return Math.max(1, Math.ceil(seconds / 60));
}

export function getTrackListeningMinutes(stats: ListeningStatsState, trackId: string) {
  return secondsToDisplayMinutes(stats.tracks[trackId]?.listenedSeconds ?? 0);
}

export function getMonthListeningSummary(stats: ListeningStatsState, year: number, monthIndex: number) {
  const monthPrefix = `${year}-${`${monthIndex + 1}`.padStart(2, "0")}-`;
  const monthDays = Object.values(stats.days).filter((day) => day.date.startsWith(monthPrefix));
  const totalSeconds = monthDays.reduce((total, day) => total + Math.max(0, day.listenedSeconds), 0);
  return {
    activeDays: monthDays.filter((day) => day.listenedSeconds > 0).length,
    totalMinutes: secondsToDisplayMinutes(totalSeconds)
  };
}

export function getCalendarIntensity(seconds: number, maxSeconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0 || !Number.isFinite(maxSeconds) || maxSeconds <= 0) {
    return 0;
  }
  return Math.max(1, Math.min(5, Math.ceil((seconds / maxSeconds) * 5)));
}
