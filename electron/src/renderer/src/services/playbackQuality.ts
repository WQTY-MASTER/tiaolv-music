export type NeteasePlaybackQuality = "auto" | "hires" | "lossless" | "exhigh" | "standard";
export type QqPlaybackQuality = "auto" | "lossless" | "high" | "standard";
export type PlaybackQualitySource = "netease" | "qq" | "local";

export interface PlaybackQualityOption<T extends string = string> {
  value: T;
  label: string;
  description: string;
}

export interface PlaybackQualityPreferences {
  netease: NeteasePlaybackQuality;
  qq: QqPlaybackQuality;
  reloadCurrent: boolean;
}

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

interface PlaybackTrackLike {
  source?: string;
  codec?: string;
  filePath?: string;
  audioUrl?: string;
  preferredLocalPlayback?: boolean;
  playbackFormat?: string;
}

export const NETEASE_QUALITY_OPTIONS: readonly PlaybackQualityOption<NeteasePlaybackQuality>[] = [
  { value: "auto", label: "自动", description: "从 Hi-Res 开始，资源不可用时自动降级" },
  { value: "hires", label: "Hi-Res", description: "优先请求 Hi-Res，必要时向下兼容" },
  { value: "lossless", label: "无损", description: "优先请求无损，必要时向下兼容" },
  { value: "exhigh", label: "极高", description: "优先请求极高，必要时回退标准" },
  { value: "standard", label: "标准", description: "固定从标准音质开始请求" }
];

export const QQ_QUALITY_OPTIONS: readonly PlaybackQualityOption<QqPlaybackQuality>[] = [
  { value: "auto", label: "自动", description: "从无损开始，资源不可用时自动降级" },
  { value: "lossless", label: "无损", description: "优先请求 FLAC，必要时向下兼容" },
  { value: "high", label: "高清", description: "优先请求 320 kbps，必要时回退标准" },
  { value: "standard", label: "标准", description: "固定从 128 kbps 开始请求" }
];

export const PLAYBACK_QUALITY_STORAGE_KEYS = {
  netease: "tiaolv-playback-quality-netease",
  qq: "tiaolv-playback-quality-qq",
  reloadCurrent: "tiaolv-playback-quality-reload-current"
} as const;

const NETEASE_VALUES = new Set(NETEASE_QUALITY_OPTIONS.map((option) => option.value));
const QQ_VALUES = new Set(QQ_QUALITY_OPTIONS.map((option) => option.value));

export function readPlaybackQualityPreferences(storage: StorageLike): PlaybackQualityPreferences {
  const netease = storage.getItem(PLAYBACK_QUALITY_STORAGE_KEYS.netease);
  const qq = storage.getItem(PLAYBACK_QUALITY_STORAGE_KEYS.qq);
  return {
    netease: NETEASE_VALUES.has(netease as NeteasePlaybackQuality)
      ? netease as NeteasePlaybackQuality
      : "auto",
    qq: QQ_VALUES.has(qq as QqPlaybackQuality) ? qq as QqPlaybackQuality : "auto",
    reloadCurrent: storage.getItem(PLAYBACK_QUALITY_STORAGE_KEYS.reloadCurrent) === "true"
  };
}

export function writePlaybackQualityPreferences(
  storage: StorageLike,
  preferences: PlaybackQualityPreferences
) {
  storage.setItem(PLAYBACK_QUALITY_STORAGE_KEYS.netease, preferences.netease);
  storage.setItem(PLAYBACK_QUALITY_STORAGE_KEYS.qq, preferences.qq);
  storage.setItem(PLAYBACK_QUALITY_STORAGE_KEYS.reloadCurrent, String(preferences.reloadCurrent));
}

export function playbackQualitySource(track: PlaybackTrackLike): PlaybackQualitySource {
  if (track.preferredLocalPlayback) {
    return "local";
  }
  const source = (track.source ?? "").toLowerCase();
  if (source === "netease" || source === "ncm") {
    return "netease";
  }
  if (source === "qq" || source === "qqmusic") {
    return "qq";
  }
  return "local";
}

export function localPlaybackFormat(track: PlaybackTrackLike) {
  const explicitFormat = track.playbackFormat?.trim() || track.codec?.trim();
  if (explicitFormat) {
    return explicitFormat.toUpperCase();
  }
  const path = track.filePath ?? track.audioUrl ?? "";
  const match = path.match(/\.([a-z0-9]+)(?:$|[?#])/i);
  return match ? match[1].toUpperCase() : "本地音频";
}
