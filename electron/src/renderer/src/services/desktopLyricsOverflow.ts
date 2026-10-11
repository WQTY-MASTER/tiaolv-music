const SCROLL_START = 0.08;
const SCROLL_END = 0.92;

export function getDesktopLyricPlaybackProgress(
  currentTime: number,
  startTime: number,
  endTime: number,
  characterProgress?: number,
  characterCount?: number
) {
  if (Number.isFinite(characterProgress) && Number.isFinite(characterCount) && (characterCount ?? 0) > 0) {
    return clamp01((characterProgress ?? 0) / (characterCount ?? 1));
  }
  if (!Number.isFinite(currentTime) || !Number.isFinite(startTime) || !Number.isFinite(endTime) || endTime <= startTime) {
    return 0;
  }
  return clamp01((currentTime - startTime) / (endTime - startTime));
}

export function getDesktopLyricScrollProgress(playbackProgress: number, animationEnabled: boolean) {
  const progress = clamp01(playbackProgress);
  if (!animationEnabled) {
    return progress >= 0.5 ? 1 : 0;
  }
  const normalized = clamp01((progress - SCROLL_START) / (SCROLL_END - SCROLL_START));
  return normalized * normalized * (3 - 2 * normalized);
}

function clamp01(value: number) {
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
}
