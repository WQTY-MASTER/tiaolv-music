export interface PlaybackMedia {
  currentTime: number;
  paused: boolean;
  ended: boolean;
  seeking?: boolean;
  readyState?: number;
  playbackRate: number;
}

export function getPlaybackDuration(catalogDuration: number, mediaDuration?: number) {
  return catalogDuration > 0
    ? catalogDuration
    : Number.isFinite(mediaDuration) && (mediaDuration ?? 0) > 0
      ? mediaDuration as number
      : 0;
}

export function getSeekablePlaybackDuration(catalogDuration: number, mediaDuration?: number) {
  return Number.isFinite(mediaDuration) && (mediaDuration ?? 0) > 0
    ? mediaDuration as number
    : Math.max(0, catalogDuration);
}

export function isPreviewPlayback(catalogDuration: number, mediaDuration?: number) {
  return Number.isFinite(mediaDuration)
    && (mediaDuration ?? 0) > 0
    && catalogDuration > 0
    && (mediaDuration as number) < catalogDuration * 0.85;
}

export function createPlaybackClock() {
  const maximumLeadSeconds = 0.15;
  let anchorMediaTime = 0;
  let anchorWallTime = 0;
  let anchorPlaybackRate = 1;
  let initialized = false;

  function reset(media: PlaybackMedia, now: number) {
    anchorMediaTime = Number.isFinite(media.currentTime) ? Math.max(0, media.currentTime) : 0;
    anchorWallTime = Number.isFinite(now) ? now : 0;
    anchorPlaybackRate = Number.isFinite(media.playbackRate) && media.playbackRate > 0
      ? media.playbackRate
      : 1;
    initialized = true;
  }

  function read(media: PlaybackMedia, now: number) {
    const mediaTime = Number.isFinite(media.currentTime) ? Math.max(0, media.currentTime) : anchorMediaTime;
    const wallTime = Number.isFinite(now) ? now : anchorWallTime;
    const playbackRate = Number.isFinite(media.playbackRate) && media.playbackRate > 0
      ? media.playbackRate
      : 1;

    if (!initialized || media.paused || media.ended || media.seeking || (media.readyState !== undefined && media.readyState < 3) || playbackRate !== anchorPlaybackRate) {
      reset(media, wallTime);
      return mediaTime;
    }

    const elapsed = Math.max(0, wallTime - anchorWallTime) / 1000;
    const estimatedTime = anchorMediaTime + elapsed * anchorPlaybackRate;

    return Math.max(mediaTime, Math.min(estimatedTime, mediaTime + maximumLeadSeconds));
  }

  function synchronize(media: PlaybackMedia, now: number) {
    const mediaTime = Number.isFinite(media.currentTime) ? Math.max(0, media.currentTime) : anchorMediaTime;
    const wallTime = Number.isFinite(now) ? now : anchorWallTime;
    const playbackRate = Number.isFinite(media.playbackRate) && media.playbackRate > 0
      ? media.playbackRate
      : 1;

    if (!initialized || media.paused || media.ended || media.seeking || (media.readyState !== undefined && media.readyState < 3) || playbackRate !== anchorPlaybackRate) {
      reset(media, wallTime);
      return mediaTime;
    }

    const estimatedTime = anchorMediaTime + Math.max(0, wallTime - anchorWallTime) / 1000 * anchorPlaybackRate;
    // Ignore small timeupdate jitter, but correct stalls and accumulated drift.
    if (mediaTime > estimatedTime || estimatedTime - mediaTime > maximumLeadSeconds) {
      reset(media, wallTime);
      return mediaTime;
    }

    return estimatedTime;
  }

  return { reset, read, synchronize };
}
