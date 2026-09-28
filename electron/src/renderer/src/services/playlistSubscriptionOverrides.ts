import type { AccountPlaylistView } from "./api";

interface PlaylistSubscriptionOverride {
  subscribed: boolean;
  playlist: AccountPlaylistView;
  updatedAt: number;
}

const STORAGE_KEY_PREFIX = "listenmusic.account-playlist-subscriptions.v1";

function storageKey(provider: string, userId: string) {
  return `${STORAGE_KEY_PREFIX}.${encodeURIComponent(provider)}.${encodeURIComponent(userId)}`;
}

function readOverrides(provider: string, userId: string): PlaylistSubscriptionOverride[] {
  if (!provider || !userId || typeof localStorage === "undefined") return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey(provider, userId)) ?? "[]") as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry): entry is PlaylistSubscriptionOverride => {
      if (!entry || typeof entry !== "object") return false;
      const candidate = entry as Partial<PlaylistSubscriptionOverride>;
      return typeof candidate.subscribed === "boolean"
        && typeof candidate.playlist?.id === "string"
        && typeof candidate.playlist?.title === "string";
    });
  } catch {
    return [];
  }
}

export function savePlaylistSubscriptionOverride(
  provider: string,
  userId: string,
  playlist: AccountPlaylistView,
  subscribed: boolean
) {
  if (!provider || !userId || typeof localStorage === "undefined") return;
  const overrides = readOverrides(provider, userId).filter((entry) => entry.playlist.id !== playlist.id);
  overrides.push({
    subscribed,
    playlist: { ...playlist, createdByAccount: false },
    updatedAt: Date.now()
  });
  try {
    localStorage.setItem(storageKey(provider, userId), JSON.stringify(overrides));
  } catch {
    // A platform-synced mutation still remains valid when local persistence is unavailable.
  }
}

export function mergePlaylistSubscriptionOverrides(
  provider: string,
  userId: string,
  remotePlaylists: AccountPlaylistView[]
) {
  const merged = new Map(remotePlaylists.map((playlist) => [playlist.id, playlist]));
  for (const override of readOverrides(provider, userId)) {
    if (override.subscribed) {
      if (!merged.has(override.playlist.id)) merged.set(override.playlist.id, override.playlist);
    } else {
      merged.delete(override.playlist.id);
    }
  }
  return [...merged.values()];
}
