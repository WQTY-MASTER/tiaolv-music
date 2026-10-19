import type { PlaylistCoverReferences } from "../../../shared/playlistCoverStorage";

type CoverStorage = Pick<Storage, "length" | "key" | "getItem">;
const LOCAL = "tiaolv-music-local-playlists";
const COVERS = "tiaolv-music-playlist-cover-paths";
const FAVORITES = "tiaolv-music-favorites-playlist-metadata";
const AGGREGATE = "tiaolv-music-aggregate-playlists";
const LEGACY = "listen-music-aggregate-playlists";
const MIGRATED = "tiaolv-music-aggregate-playlists-legacy-migrated-v1";
const KNOWN = new Set([LOCAL, COVERS, FAVORITES, AGGREGATE, LEGACY]);
const MANAGED = /tiaolv-cover:/i;
const FILE = /^[a-f0-9]{64}\.(png|jpg|webp)$/;

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function optionalCovers(value: Record<string, unknown>) {
  return ["coverUrl", "coverPath", "imageUrl"].every(key => value[key] === undefined || typeof value[key] === "string");
}

function validKnown(key: string, value: unknown) {
  if (key === COVERS) return record(value) && Object.values(value).every(item => typeof item === "string");
  if (key === FAVORITES) return record(value) && (value.title === undefined || typeof value.title === "string") && optionalCovers(value);
  if (!Array.isArray(value)) return false;
  if (key === LOCAL) return value.every(item => record(item) && record(item.playlist)
    && typeof item.playlist.id === "string" && typeof item.playlist.title === "string" && optionalCovers(item.playlist)
    && Array.isArray(item.tracks) && item.tracks.every(track => record(track) && typeof track.id === "string" && optionalCovers(track)));
  return value.every(item => record(item) && typeof item.id === "string" && typeof item.name === "string"
    && typeof item.identifier === "string" && optionalCovers(item) && Array.isArray(item.tracks)
    && item.tracks.every(track => record(track) && ["id", "title", "artist", "source", "sourceLabel"].every(field => typeof track[field] === "string") && optionalCovers(track)));
}

export function collectPlaylistCoverReferences(
  storage: CoverStorage,
  activeRoots: readonly unknown[],
  legacyBridgeAvailable = false
): PlaylistCoverReferences {
  if (legacyBridgeAvailable && storage.getItem(MIGRATED) !== "1") throw new Error("旧歌单迁移尚未完成，无法安全清理原始封面。");
  const urls = new Set<string>();
  const seen = new WeakSet<object>();
  let visited = 0;
  const collect = (value: unknown): void => {
    if (++visited > 1000000) throw new Error("封面引用数据过多，无法确认完整性。");
    if (typeof value === "string" && MANAGED.test(value)) {
      const prefix = "tiaolv-cover://cache/";
      let parsed: URL;
      try { parsed = new URL(value); } catch { throw new Error("原始封面引用无效，清理已停止。"); }
      const name = parsed.pathname.slice(1);
      if (parsed.protocol !== "tiaolv-cover:" || parsed.host !== "cache" || parsed.username || parsed.password || parsed.search || parsed.hash
        || !FILE.test(name) || !/^tiaolv-cover:\/\/cache\/[a-f0-9]{64}\.(png|jpg|webp)$/i.test(value)) {
        throw new Error("原始封面引用无效，清理已停止。");
      }
      urls.add(`${prefix}${name}`);
      if (urls.size > 100000) throw new Error("封面引用数据过多，无法确认完整性。");
    } else if (value && typeof value === "object" && !seen.has(value)) {
      seen.add(value);
      for (const child of Object.values(value)) collect(child);
    }
  };
  const initialLength = storage.length;
  if (!Number.isSafeInteger(initialLength) || initialLength < 0 || initialLength > 100000) throw new Error("存储枚举失败，清理已停止。");
  const keys = new Set<string>();
  for (let index = 0; index < initialLength; index++) {
    const key = storage.key(index);
    if (key === null || keys.has(key)) throw new Error("存储枚举不完整，清理已停止。");
    keys.add(key);
    const raw = storage.getItem(key);
    if (raw === null) throw new Error("存储读取不完整，清理已停止。");
    let parsed: unknown;
    try { parsed = JSON.parse(raw); } catch {
      if (!KNOWN.has(key) && !MANAGED.test(raw) && !/^\s*[\[{\"]/.test(raw)) continue;
      throw new Error(`歌单存储损坏（${key}），无法安全清理原始封面。`);
    }
    if (KNOWN.has(key) && !validKnown(key, parsed)) throw new Error(`歌单存储结构无效（${key}），无法安全清理原始封面。`);
    collect(parsed);
  }
  if (storage.length !== initialLength) throw new Error("存储枚举期间发生变化，清理已停止。");
  collect(activeRoots);
  return { complete: true, urls: [...urls] };
}
