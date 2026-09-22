const STORAGE_KEY = "tingting.localListeningStats";

export interface TrackListeningStat {
  trackId: string;
  playCount: number;
  listenedSeconds: number;
  lastListenedAt: string;
}

export interface DayListeningStat {
  date: string;
  listenedSeconds: number;
}

export interface ListeningStatsState {
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
  return { tracks: {}, days: {} };
}

export function readListeningStats(storage: StorageLike | undefined = browserStorage()): ListeningStatsState {
  const raw = storage?.getItem(STORAGE_KEY);
  if (!raw) {
    return createEmptyListeningStats();
  }

  try {
    const parsed = JSON.parse(raw) as Partial<ListeningStatsState>;
    return {
      tracks: parsed.tracks && typeof parsed.tracks === "object" ? parsed.tracks : {},
      days: parsed.days && typeof parsed.days === "object" ? parsed.days : {}
    };
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
  return {
    ...stats,
    tracks: {
      ...stats.tracks,
      [trackId]: {
        trackId,
        playCount: (previous?.playCount ?? 0) + 1,
        listenedSeconds: previous?.listenedSeconds ?? 0,
        lastListenedAt: at.toISOString()
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
    tracks: {
      ...stats.tracks,
      [trackId]: {
        trackId,
        playCount: previousTrack?.playCount ?? 0,
        listenedSeconds: Math.round(((previousTrack?.listenedSeconds ?? 0) + safeSeconds) * 100) / 100,
        lastListenedAt: at.toISOString()
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
