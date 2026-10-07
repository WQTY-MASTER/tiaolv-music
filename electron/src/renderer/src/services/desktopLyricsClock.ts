export function projectDesktopLyricsTime(
  anchorTime: number,
  anchorTimestampMs: number,
  timestampMs: number,
  isPlaying: boolean
) {
  const safeAnchorTime = Number.isFinite(anchorTime) ? Math.max(0, anchorTime) : 0;
  if (!isPlaying) {
    return safeAnchorTime;
  }

  const elapsedMs = Number.isFinite(anchorTimestampMs) && Number.isFinite(timestampMs)
    ? Math.max(0, timestampMs - anchorTimestampMs)
    : 0;
  return safeAnchorTime + elapsedMs / 1000;
}

export function reconcileDesktopLyricsTime(
  renderedTime: number,
  synchronizedTime: number,
  isPlaying: boolean,
  allowRewind: boolean
) {
  const safeRenderedTime = Number.isFinite(renderedTime) ? Math.max(0, renderedTime) : 0;
  const safeSynchronizedTime = Number.isFinite(synchronizedTime)
    ? Math.max(0, synchronizedTime)
    : safeRenderedTime;
  if (allowRewind || !isPlaying) {
    return safeSynchronizedTime;
  }
  return Math.max(safeRenderedTime, safeSynchronizedTime);
}
