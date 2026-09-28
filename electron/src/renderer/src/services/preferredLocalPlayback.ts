export interface PreferredPlaybackTrack {
  id: string;
  source?: string;
  title: string;
  artist: string;
  duration?: number;
  audioUrl?: string;
  codec?: string;
  sampleRate?: number;
  bitDepth?: number;
}

const ONLINE_SOURCES = new Set(["netease", "qq"]);
const LOSSLESS_CODECS = new Set(["aiff", "alac", "ape", "dff", "dsd", "dsf", "flac", "wav"]);
const UNRELIABLE_METADATA = new Set(["", "未知歌曲", "未知歌手"]);
const MAX_DURATION_DIFFERENCE_SECONDS = 3;

function normalizeComparableText(value: string | undefined) {
  return (value ?? "")
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[\p{P}\p{S}\s]+/gu, "");
}

function finitePositive(value: number | undefined) {
  return Number.isFinite(value) && Number(value) > 0 ? Number(value) : 0;
}

function durationDistance(left: PreferredPlaybackTrack, right: PreferredPlaybackTrack) {
  const leftDuration = finitePositive(left.duration);
  const rightDuration = finitePositive(right.duration);
  return leftDuration && rightDuration ? Math.abs(leftDuration - rightDuration) : 0;
}

function isLossless(codec: string | undefined) {
  return LOSSLESS_CODECS.has((codec ?? "").trim().toLocaleLowerCase());
}

export function selectPreferredLocalPlaybackTrack(
  onlineTrack: PreferredPlaybackTrack,
  localTracks: PreferredPlaybackTrack[]
) {
  if (!ONLINE_SOURCES.has(onlineTrack.source ?? "")) {
    return undefined;
  }

  const title = normalizeComparableText(onlineTrack.title);
  const artist = normalizeComparableText(onlineTrack.artist);
  if (UNRELIABLE_METADATA.has(title) || UNRELIABLE_METADATA.has(artist)) {
    return undefined;
  }

  const candidates = localTracks.filter((candidate) => {
    if (candidate.source !== "local" || !candidate.audioUrl?.trim()) {
      return false;
    }
    if (
      normalizeComparableText(candidate.title) !== title
      || normalizeComparableText(candidate.artist) !== artist
    ) {
      return false;
    }
    const distance = durationDistance(onlineTrack, candidate);
    return distance <= MAX_DURATION_DIFFERENCE_SECONDS;
  });

  return candidates.sort((left, right) => {
    const losslessDifference = Number(isLossless(right.codec)) - Number(isLossless(left.codec));
    if (losslessDifference) return losslessDifference;

    const bitDepthDifference = finitePositive(right.bitDepth) - finitePositive(left.bitDepth);
    if (bitDepthDifference) return bitDepthDifference;

    const sampleRateDifference = finitePositive(right.sampleRate) - finitePositive(left.sampleRate);
    if (sampleRateDifference) return sampleRateDifference;

    const durationDifference = durationDistance(onlineTrack, left) - durationDistance(onlineTrack, right);
    if (durationDifference) return durationDifference;

    return left.id.localeCompare(right.id);
  })[0];
}
