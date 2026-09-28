export const MIN_FADE_DURATION_MS = 10;
export const MAX_FADE_DURATION_MS = 2000;
export const DEFAULT_FADE_DURATION_MS = 500;

function clampVolume(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(1, value));
}

export function normalizeFadeDurationMs(value: number) {
  if (!Number.isFinite(value)) {
    return DEFAULT_FADE_DURATION_MS;
  }
  return Math.max(MIN_FADE_DURATION_MS, Math.min(MAX_FADE_DURATION_MS, Math.round(value)));
}

export function boundFadeDurationMs(requestedMs: number, availableSeconds?: number) {
  const normalizedMs = normalizeFadeDurationMs(requestedMs);
  if (!Number.isFinite(availableSeconds)) {
    return normalizedMs;
  }
  return Math.max(0, Math.min(normalizedMs, Math.round(Math.max(0, availableSeconds ?? 0) * 1000)));
}

export function interpolateFadeVolume(from: number, to: number, progress: number) {
  const start = clampVolume(from);
  const end = clampVolume(to);
  const ratio = Number.isFinite(progress) ? Math.max(0, Math.min(1, progress)) : 0;
  return clampVolume(start + (end - start) * ratio);
}
