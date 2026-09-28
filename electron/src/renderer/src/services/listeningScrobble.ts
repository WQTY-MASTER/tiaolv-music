export const LISTENING_SCROBBLE_THRESHOLD_SECONDS = 30;

export interface ListeningScrobbleSession {
  sessionId: number;
  trackId: string;
  listenedSeconds: number;
  lastMediaTime?: number;
  status: "tracking" | "reporting" | "reported" | "failed";
}

export function createScrobbleSession(sessionId: number, trackId: string): ListeningScrobbleSession {
  return {
    sessionId,
    trackId,
    listenedSeconds: 0,
    status: "tracking"
  };
}

export function resetScrobbleSample(session: ListeningScrobbleSession): ListeningScrobbleSession {
  return { ...session, lastMediaTime: undefined };
}

export function sampleScrobblePlayback(
  session: ListeningScrobbleSession,
  mediaTime: number
): ListeningScrobbleSession {
  if (session.status !== "tracking" || !Number.isFinite(mediaTime) || mediaTime < 0) {
    return session;
  }

  if (session.lastMediaTime === undefined) {
    return { ...session, lastMediaTime: mediaTime };
  }

  const delta = mediaTime - session.lastMediaTime;
  if (delta <= 0 || delta > 6) {
    return { ...session, lastMediaTime: mediaTime };
  }

  return {
    ...session,
    listenedSeconds: Math.round((session.listenedSeconds + delta) * 100) / 100,
    lastMediaTime: mediaTime
  };
}

export function beginScrobbleReport(session: ListeningScrobbleSession) {
  if (session.status !== "tracking" || session.listenedSeconds < LISTENING_SCROBBLE_THRESHOLD_SECONDS) {
    return { session, shouldReport: false };
  }

  return {
    session: { ...session, status: "reporting" as const },
    shouldReport: true
  };
}
