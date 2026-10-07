export type OnlineAudioProvider = "netease" | "qq";

export interface AudioMatchTrack {
  id: string;
  source?: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
}

export interface LocalAudioSourceGroup {
  provider: OnlineAudioProvider;
  state: "loading" | "matched" | "empty" | "error";
  track?: AudioMatchTrack;
}

export interface LocalAudioSelection {
  provider: "local" | OnlineAudioProvider;
  quality: string;
}

function normalized(value: string) {
  return value.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
}

function artists(value: string) {
  return value.split(/[/、,，;&＆]+/).map(normalized)
    .filter((name) => name && !["未知歌手", "未知艺术家", "unknown", "unknownartist"].includes(name));
}

// Keep version words (Live, Remix, etc.) in the title comparison.
export function matchLocalAudioSource<T extends AudioMatchTrack>(local: AudioMatchTrack, candidates: T[], provider: OnlineAudioProvider): T | null {
  const title = normalized(local.title);
  const names = artists(local.artist);
  if (!title || !names.length || !(local.duration > 0)) return null;
  const matches = candidates.filter((track) =>
    track.source === provider && track.id.startsWith(`${provider}:`)
    && normalized(track.title) === title
    && artists(track.artist).some((name) => names.includes(name))
    && track.duration > 0 && Math.abs(track.duration - local.duration) <= 4
  ).map((track) => ({
    track,
    score: (normalized(track.album) === normalized(local.album) && local.album ? 10 : 0)
      + (normalized(track.artist) === normalized(local.artist) ? 5 : 0)
      - Math.abs(track.duration - local.duration)
  })).sort((a, b) => b.score - a.score);
  if (matches.length > 1 && matches[0].score === matches[1].score
    && matches[0].track.id !== matches[1].track.id) return null;
  return matches[0]?.track ?? null;
}
