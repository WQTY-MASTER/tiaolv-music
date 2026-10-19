export const LOCAL_PLAYLIST_STORAGE_KEY = "tiaolv-music-local-playlists";
export const PLAYLIST_OVERVIEW_ORDER_STORAGE_KEY = "tiaolv-music-playlist-overview-order";
export const PLAYLIST_TRACK_ORDER_STORAGE_KEY = "tiaolv-music-playlist-track-order";
export const PLAYLIST_COVER_PATH_STORAGE_KEY = "tiaolv-music-playlist-cover-paths";
export const FAVORITES_PLAYLIST_METADATA_STORAGE_KEY = "tiaolv-music-favorites-playlist-metadata";

type PlaylistStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export interface PlaylistStorageChange {
  key: string;
  value: unknown;
  raw?: boolean;
}

export interface FavoritesPlaylistMetadata {
  title?: string;
}

export function playlistPersistenceError(error: unknown, fallback = "歌单保存失败，请重试。") {
  if (error instanceof Error) {
    if (error.name === "QuotaExceededError") return `本地存储空间不足，请释放空间后重试。${error.message}`;
    return error.message || fallback;
  }
  return fallback;
}

export function savePlaylistStorageChanges(
  changes: readonly PlaylistStorageChange[],
  storage: PlaylistStorage = window.localStorage
) {
  // Serialize and read every old value before starting the first write.
  const entries = changes.map(change => {
    const value = change.raw ? String(change.value) : JSON.stringify(change.value);
    if (typeof value !== "string") throw new TypeError("歌单数据无法序列化，请重新加载后重试。");
    return { key: change.key, value, previous: storage.getItem(change.key) };
  });
  const written: typeof entries = [];
  try {
    for (const entry of entries) {
      storage.setItem(entry.key, entry.value);
      written.push(entry);
    }
  } catch (error) {
    let rollbackFailed = false;
    for (const entry of written.reverse()) {
      try {
        if (entry.previous === null) storage.removeItem(entry.key);
        else storage.setItem(entry.key, entry.previous);
      } catch {
        rollbackFailed = true;
      }
    }
    if (rollbackFailed) {
      throw new Error(`${playlistPersistenceError(error)} 部分存储未能恢复，请重新加载并检查歌单后再重试。`, { cause: error });
    }
    throw error;
  }
}

export function saveLocalPlaylistSnapshot<Playlist extends { id: string }, Track, StoredTrack>(
  snapshot: {
    playlists: readonly Playlist[];
    tracks: Readonly<Record<string, readonly Track[]>>;
    overviewOrder?: readonly string[];
    coverPaths?: Readonly<Record<string, string>>;
  },
  toTrackSnapshot: (track: Track) => StoredTrack,
  storage: PlaylistStorage = window.localStorage
) {
  const changes: PlaylistStorageChange[] = [{
    key: LOCAL_PLAYLIST_STORAGE_KEY,
    value: snapshot.playlists.map(playlist => ({
      playlist: { ...playlist },
      tracks: (snapshot.tracks[playlist.id] ?? []).map(toTrackSnapshot)
    }))
  }];
  if (snapshot.overviewOrder !== undefined) changes.push({ key: PLAYLIST_OVERVIEW_ORDER_STORAGE_KEY, value: snapshot.overviewOrder });
  if (snapshot.coverPaths !== undefined) changes.push({ key: PLAYLIST_COVER_PATH_STORAGE_KEY, value: snapshot.coverPaths });
  savePlaylistStorageChanges(changes, storage);
}

export function readFavoritesPlaylistMetadata(
  storage: Pick<Storage, "getItem"> = window.localStorage
): FavoritesPlaylistMetadata {
  try {
    const raw = storage.getItem(FAVORITES_PLAYLIST_METADATA_STORAGE_KEY);
    const metadata = raw ? JSON.parse(raw) : null;
    return metadata && typeof metadata.title === "string" && metadata.title.trim()
      ? { title: metadata.title.trim() }
      : {};
  } catch {
    return {};
  }
}
