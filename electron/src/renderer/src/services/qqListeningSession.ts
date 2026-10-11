export interface QqListeningTrack {
  id: string;
  title: string;
  artist?: string;
  album?: string;
  duration?: number;
  source?: string;
  coverUrl?: string;
}

export interface QqListeningDeltaPayload {
  accountId: string;
  accountNickname?: string;
  accountAvatarUrl?: string;
  track: QqListeningTrack;
  listenedSeconds: number;
  playCount: 0 | 1;
}

export interface QqListeningSession {
  recentReportSessionId: string;
  recentReportStatus: "tracking" | "reporting" | "reported" | "failed";
  accountId: string;
  accountNickname?: string;
  accountAvatarUrl?: string;
  track: QqListeningTrack;
  totalListenedSeconds: number;
  pendingSeconds: number;
  pendingPlayCount: 0 | 1;
  playCountRecorded: boolean;
  lastMediaTime: number | null;
  lastWallTimeMs: number | null;
  inFlight: QqListeningDeltaPayload | null;
}

const PLAY_COUNT_THRESHOLD_SECONDS = 30;
const FLUSH_THRESHOLD_SECONDS = 15;
const MAX_SAMPLE_GAP_SECONDS = 6;
const MAX_DELTA_SECONDS = 60;

export function createQqListeningSession(
  accountId: string,
  track: QqListeningTrack,
  accountNickname?: string,
  accountAvatarUrl?: string
): QqListeningSession {
  return {
    recentReportSessionId: crypto.randomUUID(),
    recentReportStatus: "tracking",
    accountId,
    accountNickname,
    accountAvatarUrl,
    track: { ...track },
    totalListenedSeconds: 0,
    pendingSeconds: 0,
    pendingPlayCount: 0,
    playCountRecorded: false,
    lastMediaTime: null,
    lastWallTimeMs: null,
    inFlight: null
  };
}

export interface QqRecentPlayReportPayload {
  accountId: string;
  trackId: string;
  sessionId: string;
  listenedSeconds: number;
  totalSeconds: number;
}

export function beginQqRecentPlayReport(session: QqListeningSession): {
  session: QqListeningSession; payload: QqRecentPlayReportPayload | null;
} {
  const totalSeconds = Math.floor(session.track.duration || 0);
  if (session.recentReportStatus !== "tracking" || session.totalListenedSeconds < 30
    || totalSeconds < 30 || !session.track.id.startsWith("qq:")) return { session, payload: null };
  return {
    session: { ...session, recentReportStatus: "reporting" },
    payload: {
      accountId: session.accountId, trackId: session.track.id, sessionId: session.recentReportSessionId,
      listenedSeconds: Math.min(Math.floor(session.totalListenedSeconds), totalSeconds), totalSeconds
    }
  };
}

export function pauseQqListeningSession(session: QqListeningSession): QqListeningSession {
  return { ...session, lastMediaTime: null, lastWallTimeMs: null };
}

export function sampleQqListeningPlayback(
  session: QqListeningSession,
  mediaTime: number,
  wallTimeMs: number
): QqListeningSession {
  if (!Number.isFinite(mediaTime) || !Number.isFinite(wallTimeMs)) return session;
  if (session.lastMediaTime === null || session.lastWallTimeMs === null) {
    return { ...session, lastMediaTime: mediaTime, lastWallTimeMs: wallTimeMs };
  }

  const mediaDelta = mediaTime - session.lastMediaTime;
  const wallDelta = (wallTimeMs - session.lastWallTimeMs) / 1_000;
  const next = { ...session, lastMediaTime: mediaTime, lastWallTimeMs: wallTimeMs };
  if (
    mediaDelta <= 0
    || wallDelta <= 0
    || mediaDelta > MAX_SAMPLE_GAP_SECONDS
    || wallDelta > MAX_SAMPLE_GAP_SECONDS
    || Math.abs(mediaDelta - wallDelta) > 2
  ) {
    return next;
  }

  const elapsed = Math.min(mediaDelta, wallDelta);
  const totalListenedSeconds = session.totalListenedSeconds + elapsed;
  const reachedThreshold = !session.playCountRecorded
    && totalListenedSeconds >= PLAY_COUNT_THRESHOLD_SECONDS;
  return {
    ...next,
    totalListenedSeconds,
    pendingSeconds: session.pendingSeconds + elapsed,
    pendingPlayCount: reachedThreshold ? 1 : session.pendingPlayCount,
    playCountRecorded: session.playCountRecorded || reachedThreshold
  };
}

export function prepareQqListeningFlush(
  session: QqListeningSession,
  force = false
): { session: QqListeningSession; payload: QqListeningDeltaPayload | null } {
  if (session.inFlight) return { session, payload: null };
  if (!force && session.pendingSeconds < FLUSH_THRESHOLD_SECONDS && session.pendingPlayCount === 0) {
    return { session, payload: null };
  }
  if (session.pendingSeconds <= 0 && session.pendingPlayCount === 0) {
    return { session, payload: null };
  }

  const listenedSeconds = Math.min(session.pendingSeconds, MAX_DELTA_SECONDS);
  const payload: QqListeningDeltaPayload = {
    accountId: session.accountId,
    accountNickname: session.accountNickname,
    accountAvatarUrl: session.accountAvatarUrl,
    track: { ...session.track },
    listenedSeconds,
    playCount: session.pendingPlayCount
  };
  return {
    payload,
    session: {
      ...session,
      pendingSeconds: session.pendingSeconds - listenedSeconds,
      pendingPlayCount: 0,
      inFlight: payload
    }
  };
}

export function acknowledgeQqListeningFlush(session: QqListeningSession): QqListeningSession {
  return { ...session, inFlight: null };
}

export function failQqListeningFlush(session: QqListeningSession): QqListeningSession {
  if (!session.inFlight) return session;
  return {
    ...session,
    pendingSeconds: session.pendingSeconds + session.inFlight.listenedSeconds,
    pendingPlayCount: session.inFlight.playCount === 1 ? 1 : session.pendingPlayCount,
    inFlight: null
  };
}
