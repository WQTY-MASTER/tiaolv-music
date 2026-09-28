export interface PlaybackMedia {
  currentTime: number;
  paused: boolean;
  ended: boolean;
  seeking?: boolean;
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

    if (!initialized || media.paused || media.ended || media.seeking || playbackRate !== anchorPlaybackRate) {
      reset(media, wallTime);
      return mediaTime;
    }

    const elapsed = Math.max(0, wallTime - anchorWallTime) / 1000;
    const estimatedTime = anchorMediaTime + elapsed * anchorPlaybackRate;

    return Math.max(0, estimatedTime);
  }

  function synchronize(media: PlaybackMedia, now: number) {
    const mediaTime = Number.isFinite(media.currentTime) ? Math.max(0, media.currentTime) : anchorMediaTime;
    const wallTime = Number.isFinite(now) ? now : anchorWallTime;
    const playbackRate = Number.isFinite(media.playbackRate) && media.playbackRate > 0
      ? media.playbackRate
      : 1;

    if (!initialized || media.paused || media.ended || media.seeking || playbackRate !== anchorPlaybackRate) {
      reset(media, wallTime);
      return mediaTime;
    }

    const estimatedTime = read(media, wallTime);
    // Browser timeupdate values can trail the animation clock; only re-anchor forward during playback.
    if (mediaTime > estimatedTime) {
      reset(media, wallTime);
      return mediaTime;
    }

    return estimatedTime;
  }

  return { reset, read, synchronize };
}
