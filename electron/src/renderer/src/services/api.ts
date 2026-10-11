import { createPageDataCache } from "./pageDataCache";
import type { QqRecentPlayReportPayload } from "./qqListeningSession";
import {
  LOCAL_BACKEND_ORIGIN,
  resolveStandaloneBackendResourceUrl,
  standaloneBackendRequestUrl
} from "../../../shared/backendRoutes";

const backendBaseUrl = LOCAL_BACKEND_ORIGIN;

function previewBackendOrigin() {
  const preview = typeof window !== "undefined" && !window.listenMusic && window.location?.protocol === "http:";
  return preview ? window.location.origin : undefined;
}

function backendRequestUrl(path: string) {
  return standaloneBackendRequestUrl(path, previewBackendOrigin());
}

export interface CatalogLyrics {
  lyrics: string;
  translation?: string;
  phonetic?: string;
  format: string;
  source: string;
  credits?: Array<{
    label: string;
    value: string;
  }>;
}

export interface PersistedTrack {
  id: string;
  queueKey?: string;
  title: string;
  artist?: string;
  album?: string;
  duration?: number;
  source?: string;
  filePath?: string;
  url?: string;
  coverUrl?: string;
  lyrics?: string;
  translation?: string;
  phonetic?: string;
  credits?: CatalogLyrics["credits"];
  lyricsPhonetic?: string;
  lyricsSource?: string;
  lyricsFormat?: string;
  metaSource?: "embedded" | "filename";
}

export interface LocalLyricsMatchResponse {
  matched: boolean;
  track: PersistedTrack;
  message: string;
  lyricData?: CatalogLyrics;
}

export interface LibraryScanResult {
  tracks: PersistedTrack[];
  total: number;
  added: number;
  removed: number;
}

export interface LibraryMetadataReparseResult {
  tracks: PersistedTrack[];
  total: number;
  filenameResolved: number;
}

export interface PlaybackState {
  trackId: string | null;
  positionSeconds: number;
  volume: number;
  playMode: "shuffle" | "sequence" | "single" | "loop";
}

export interface ListeningScrobblePayload {
  trackId: string;
  title: string;
  artist: string;
  listenedSeconds: number;
  totalSeconds: number;
}

export type QqListeningRankPeriod = "week" | "all";

export interface QqListeningRankOptions {
  period?: QqListeningRankPeriod;
  from?: string;
  to?: string;
  refresh?: boolean;
}

export interface QqListeningRankEntry {
  track: PersistedTrack;
  playCount: number;
  listenedSeconds: number;
  lastListenedAt: string;
}

export interface QqListeningDeltaPayload {
  accountId: string;
  accountNickname?: string;
  accountAvatarUrl?: string;
  track: PersistedTrack;
  listenedSeconds: number;
  playCount: 0 | 1;
}

export interface QqListeningDataSummary {
  accountId: string;
  nickname?: string;
  avatarUrl?: string;
  trackCount: number;
  listenedSeconds: number;
  firstDate: string;
  lastDate: string;
}

export interface AccountView {
  provider: string;
  userId: string;
  nickname: string;
  avatarUrl?: string;
}

export interface AccountProfileView extends AccountView {
  signature: string;
  follows: number;
  followers: number;
}

export interface AccountSocialUserView extends AccountView {
  signature: string;
  type?: "user" | "artist";
  albumCount?: number;
  trackCount?: number;
}

export interface AccountPlaylistView {
  id: string;
  title: string;
  subtitle: string;
  imageUrl?: string;
  count: number;
  createdByAccount: boolean;
  deletable?: boolean;
  favorite?: boolean;
}

export interface RecentTracksDeleteResult {
  deletedTrackIds: string[];
  tracks: unknown[];
}

export interface CloudTrackView {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
  originalFileName: string;
  format: string;
  sizeBytes: number;
  uploadedAt: string;
  audioUrl: string;
  coverUrl?: string;
}

export interface QrLoginStartResponse {
  sessionId: string;
  provider: string;
  status: "WAITING";
  qrimg?: string;
  qrurl?: string;
  expiresInSeconds: number;
}

export type QrLoginStatus = "EXPIRED" | "WAITING" | "CONFIRMING" | "SUCCESS";

export interface QrLoginStatusResponse {
  sessionId: string;
  provider: string;
  status: QrLoginStatus;
  userId?: string;
  nickname?: string;
  avatarUrl?: string;
  message?: string;
}

export interface HomepageData {
  banners: unknown[];
  playlists: unknown[];
  songs: unknown[];
  cursor?: string;
  hasMore: boolean;
}

export interface PlaylistCategoryData {
  hotTags: string[];
  groups: Record<string, string[]>;
  highQualityTags: string[];
}

export interface PlaylistDiscoveryPage {
  playlists: unknown[];
  total: number;
  hasMore: boolean;
  cursor?: string;
}

export type CatalogSearchType = "song" | "playlist" | "artist";

export interface CatalogSearchArtist {
  id: string;
  name: string;
  imageUrl?: string;
  albumCount: number;
  trackCount: number;
  source: string;
}

export interface CatalogSearchPage {
  songs: unknown[];
  playlists: unknown[];
  artists: CatalogSearchArtist[];
  total: number;
  hasMore: boolean;
}

export interface CatalogArtistDetail {
  provider: string;
  id: string;
  name: string;
  avatarUrl?: string;
  signature?: string;
  albumCount: number;
  trackCount: number;
}

export interface CatalogArtistAlbum {
  id: string;
  title: string;
  imageUrl?: string;
  trackCount: number;
  releaseDate?: string;
}

export interface CatalogArtistSongPage {
  songs: unknown[];
  total: number;
  hasMore: boolean;
}

export interface CacheSettings {
  directory: string;
  coverEnabled: boolean;
  lyricsEnabled: boolean;
  metadataEnabled: boolean;
}

export interface CacheCategoryStatistics {
  bytes: number;
  entries: number;
}

export interface CacheStatistics {
  totalBytes: number;
  totalEntries: number;
  cover: CacheCategoryStatistics;
  lyrics: CacheCategoryStatistics;
  metadata: CacheCategoryStatistics;
}

export interface CacheSnapshot {
  settings: CacheSettings;
  statistics: CacheStatistics;
}

export interface ListeningStatsPayload {
  revision: number;
  tracks: Record<string, {
    trackId: string;
    playCount: number;
    listenedSeconds: number;
    lastListenedAt: string;
    lastListenedDate: string;
  }>;
  days: Record<string, {
    date: string;
    listenedSeconds: number;
  }>;
}

export interface ListeningStatsSummaryPayload {
  revision: number;
  trackCount: number;
  activeDays: number;
  listenedSeconds: number;
  years: number[];
  months: string[];
  rangeTrackCount: number;
  rangeActiveDays: number;
  rangeListenedSeconds: number;
}

export class ApiRequestError extends Error {
  public readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
  }
}

const jsonHeaders = { "Content-Type": "application/json" };
const REQUEST_TIMEOUT_MS = 12_000;
const pageDataCache = createPageDataCache({ ttlMs: 300_000, maxEntries: 100 });
const pageDataCacheAccountScopes = new Map<string, string>();

function normalizeProvider(provider: string) {
  return provider.trim().toLowerCase();
}

function accountScope(provider: string, userId?: string) {
  const normalizedProvider = normalizeProvider(provider);
  const normalizedUserId = userId?.trim() || pageDataCacheAccountScopes.get(normalizedProvider) || "anonymous";
  return `account:${normalizedProvider}:${normalizedUserId}`;
}

function accountProviderFromRequest(path: string) {
  const match = /^\/account\/([^/?]+)(?:\/|$)/.exec(path);
  if (match) return decodeURIComponent(match[1]);
  const provider = new URL(path, backendBaseUrl).searchParams.get("provider");
  return provider ? decodeURIComponent(provider) : null;
}

function isPageDataRequest(path: string, method: string) {
  if (method !== "GET") return false;
  return ![
    "/health",
    "/auth",
    "/account/current",
    "/cache",
    "/playback",
    "/library/select-directory"
  ].some((prefix) => path === prefix || path.startsWith(`${prefix}/`) || path.startsWith(`${prefix}?`));
}

function pageDataCacheKey(path: string) {
  const provider = accountProviderFromRequest(path);
  const url = new URL(path, backendBaseUrl);
  url.searchParams.delete("refresh");
  const normalizedPath = `${url.pathname}${url.search}`;
  return `${provider ? accountScope(provider) : "public"}|${normalizedPath}`;
}

function invalidateAfterMutation(path: string) {
  const provider = accountProviderFromRequest(path);
  if (provider) {
    pageDataCache.clearScope(accountScope(provider));
    return;
  }
  pageDataCache.clear();
}

function mutationChangesPageData(path: string, method: string) {
  if (/^\/account\/[^/?]+\/listening-scrobbles(?:\/|\?|$)/.test(path)) return false;
  if (method === "POST" && /^\/account\/qq\/listening-stats(?:\?|$)/.test(path)) return false;
  if (method === "POST" && path === "/account/qq/recent-play-reports") return false;
  if (/^\/catalog\/playlists\/[^/?]+\/play-count(?:\/|\?|$)/.test(path)) return false;
  return !["/auth", "/cache", "/playback"].some((prefix) => (
    path === prefix || path.startsWith(`${prefix}/`) || path.startsWith(`${prefix}?`)
  ));
}

export function setPageDataCacheAccountScope(provider: string, userId: string) {
  const normalizedProvider = normalizeProvider(provider);
  if (!normalizedProvider || !userId.trim()) return;
  pageDataCacheAccountScopes.set(normalizedProvider, userId.trim());
}

export function clearPageDataCacheAccountScope(provider: string, userId?: string) {
  const normalizedProvider = normalizeProvider(provider);
  const currentUserId = pageDataCacheAccountScopes.get(normalizedProvider);
  const targetUserId = userId?.trim() || currentUserId;
  if (targetUserId) pageDataCache.clearScope(accountScope(normalizedProvider, targetUserId));
  if (!userId || currentUserId === targetUserId) pageDataCacheAccountScopes.delete(normalizedProvider);
}

export function invalidatePageDataCache(match?: string | ((key: string) => boolean)) {
  if (!match) {
    pageDataCache.clear();
    return;
  }
  pageDataCache.invalidate(match);
}

export function invalidatePageDataCacheForProvider(provider: string) {
  pageDataCache.clearScope(accountScope(provider));
}

export function resolveBackendUrl(path: string | null | undefined) {
  if (!path) {
    return "";
  }
  return resolveStandaloneBackendResourceUrl(path, previewBackendOrigin());
}

async function performRequest<T>(path: string, init?: RequestInit, timeoutMs = REQUEST_TIMEOUT_MS): Promise<T> {
  const controller = new AbortController();
  let timedOut = false;
  const abortFromCaller = () => controller.abort();
  if (init?.signal?.aborted) {
    controller.abort();
  } else {
    init?.signal?.addEventListener("abort", abortFromCaller, { once: true });
  }
  const timeoutId = globalThis.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  let response: Response;
  try {
    response = await fetch(backendRequestUrl(path), { ...init, signal: controller.signal });
  } catch (error) {
    if (timedOut) {
      throw new Error("请求超时，请稍后重试。");
    }
    throw error;
  } finally {
    globalThis.clearTimeout(timeoutId);
    init?.signal?.removeEventListener("abort", abortFromCaller);
  }
  if (!response.ok) {
    let message = "";
    try {
      const detail = await response.json() as { message?: unknown; code?: unknown };
      message = typeof detail.message === "string"
        ? detail.message
        : typeof detail.code === "string" ? detail.code : "";
    } catch {
      // Keep the HTTP status when the server did not return JSON.
    }
    throw new ApiRequestError(message || `Request failed: ${response.status}`, response.status);
  }
  return response.json() as Promise<T>;
}

async function request<T>(path: string, init?: RequestInit, timeoutMs = REQUEST_TIMEOUT_MS): Promise<T> {
  const method = (init?.method || "GET").toUpperCase();
  if (isPageDataRequest(path, method)) {
    const force = new URL(path, backendBaseUrl).searchParams.get("refresh") === "true";
    return pageDataCache.load(pageDataCacheKey(path), () => performRequest<T>(path, init, timeoutMs), { force });
  }
  const result = await performRequest<T>(path, init, timeoutMs);
  if (method !== "GET" && mutationChangesPageData(path, method)) invalidateAfterMutation(path);
  return result;
}

export function pingBackend() {
  return window.listenMusic
    ? window.listenMusic.ping()
    : request<{ ok: boolean }>("/health");
}

export function loadLibrary() {
  return window.listenMusic
    ? window.listenMusic.getLibrary()
    : request<unknown[]>("/library/tracks");
}

export function loadLocalLibraryRoots() {
  return request<string[]>("/library/roots");
}

export function removeLocalLibraryRoot(directory: string) {
  const query = new URLSearchParams({ directory });
  return request<unknown[]>(`/library/roots?${query}`, { method: "DELETE" });
}

export function loadIgnoredLocalFiles() {
  return request<string[]>("/library/ignored");
}

export function resetLocalLibrary() {
  return request<{ ok: boolean }>("/library/tracks", { method: "DELETE" });
}

export function loadPlaylists() {
  return window.listenMusic
    ? window.listenMusic.getPlaylists()
    : request<unknown[]>("/library/playlists");
}

export function loadHomepage(refresh = false, cursor?: string) {
  const params = new URLSearchParams({ refresh: String(refresh) });
  if (cursor) {
    params.set("cursor", cursor);
  }
  return request<HomepageData>(`/catalog/homepage?${params.toString()}`);
}

export function loadDiscovery(refresh = false, cursor?: string) {
  const params = new URLSearchParams({ refresh: String(refresh) });
  if (cursor) {
    params.set("cursor", cursor);
  }
  return request<HomepageData>(`/catalog/discovery?${params.toString()}`);
}

export function loadPlaylistCategories(provider = "netease") {
  const params = new URLSearchParams({ provider });
  return request<PlaylistCategoryData>(`/catalog/playlist-categories?${params.toString()}`);
}

export function loadDiscoveredPlaylists(category: string, order: "hot" | "new", limit: number, offset: number, provider = "netease") {
  const params = new URLSearchParams({ provider, category, order, limit: String(limit), offset: String(offset) });
  return request<PlaylistDiscoveryPage>(`/catalog/playlists?${params.toString()}`);
}

export function loadHighQualityPlaylists(category: string, limit: number, before?: string, provider = "netease") {
  const params = new URLSearchParams({ provider, category, limit: String(limit) });
  if (before) params.set("before", before);
  return request<PlaylistDiscoveryPage>(`/catalog/playlists/high-quality?${params.toString()}`);
}

export function updatePlaylistPlayCount(id: string) {
  return request<{ ok: boolean }>(`/catalog/playlists/${encodeURIComponent(id)}/play-count`, { method: "POST" });
}

export function loadDailyRecommendations() {
  return request<unknown[]>("/catalog/daily-recommendations");
}

export function loadAccountRecommendations(provider = "netease") {
  return request<unknown[]>(`/account/${encodeURIComponent(provider)}/recommendations`);
}

export function loadPrivateRadar(provider = "netease") {
  return request<unknown[]>(`/account/${encodeURIComponent(provider)}/private-radar`);
}

export function loadPrivateRoaming(mode: string, scene?: string) {
  const params = new URLSearchParams({ mode });
  if (scene) {
    params.set("scene", scene);
  }
  return request<unknown[]>(`/account/netease/roaming?${params.toString()}`);
}

export function loadAccountFavorites(provider = "netease") {
  return request<unknown[]>(`/account/${encodeURIComponent(provider)}/favorites`);
}

export function loadAccountProfile(provider = "netease") {
  return request<AccountProfileView>(`/account/${encodeURIComponent(provider)}/profile`);
}

export function loadAccountUserProfile(userId: string, provider = "netease") {
  return request<AccountProfileView>(
    `/account/${encodeURIComponent(provider)}/users/${encodeURIComponent(userId)}`
  );
}

export function loadAccountFollowing(provider = "netease", limit = 30, offset = 0) {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  return request<AccountSocialUserView[]>(`/account/${encodeURIComponent(provider)}/following?${params.toString()}`);
}

export function loadAccountFollowers(provider = "netease", limit = 30, offset = 0) {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  return request<AccountSocialUserView[]>(`/account/${encodeURIComponent(provider)}/followers?${params.toString()}`);
}

export function loadAccountRecentTracks(provider = "netease") {
  return request<unknown[]>(`/account/${encodeURIComponent(provider)}/recent-tracks`);
}

export async function reportQqRecentPlay(payload: QqRecentPlayReportPayload) {
  if (pageDataCacheAccountScopes.get("qq") !== payload.accountId) {
    throw new Error("QQ 账号已切换，本次播放不会上报到其他账号");
  }
  const key = `${accountScope("qq", payload.accountId)}|/account/qq/recent-tracks`;
  const result = await request<{ ok: boolean; tracks: unknown[] }>("/account/qq/recent-play-reports", {
    method: "POST", headers: jsonHeaders, body: JSON.stringify(payload)
  }, 30_000);
  if (result.ok !== true || !Array.isArray(result.tracks)) throw new Error("QQ 音乐未确认云端最近播放");
  pageDataCache.set(key, result.tracks);
  return result;
}

export function deleteAccountRecentTracks(trackIds: string[], provider = "netease") {
  return request<RecentTracksDeleteResult>(`/account/${encodeURIComponent(provider)}/recent-tracks`, {
    method: "DELETE",
    headers: jsonHeaders,
    body: JSON.stringify({ trackIds })
  });
}

export function loadAccountListeningRank(provider = "netease", options: QqListeningRankOptions = {}) {
  const path = `/account/${encodeURIComponent(provider)}/listening-rank`;
  const params = new URLSearchParams({ period: options.period || "week" });
  if (options.from) params.set("from", options.from);
  if (options.to) params.set("to", options.to);
  if (options.refresh) params.set("refresh", "true");
  return request<unknown[]>(`${path}?${params.toString()}`);
}

export async function reportQqListeningDelta(payload: QqListeningDeltaPayload) {
  const result = await request<{ ok: boolean }>("/account/qq/listening-stats", {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify(payload)
  });
  const prefix = `${accountScope("qq", payload.accountId)}|/account/qq/featured-playlists`;
  pageDataCache.invalidate(key => key === prefix || key.startsWith(`${prefix}?`));
  return result;
}

export function loadQqListeningDataSummaries(refresh = false) {
  const params = refresh ? "?refresh=true" : "";
  return request<QqListeningDataSummary[]>(`/account/qq/listening-stats/accounts${params}`);
}

export function deleteQqListeningStats(
  accountId: string,
  options: { all?: boolean; from?: string; to?: string }
) {
  const params = new URLSearchParams();
  if (options.all) params.set("all", "true");
  if (options.from) params.set("from", options.from);
  if (options.to) params.set("to", options.to);
  const query = params.size ? `?${params.toString()}` : "";
  return request<{ ok: boolean }>(
    `/account/qq/listening-stats/${encodeURIComponent(accountId)}${query}`,
    { method: "DELETE" }
  );
}

export function reportListeningScrobble(provider: string, payload: ListeningScrobblePayload) {
  return request<{ ok: boolean }>(`/account/${encodeURIComponent(provider)}/listening-scrobbles`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify(payload)
  });
}

export function loadAccountPlaylists(provider = "netease") {
  return request<AccountPlaylistView[]>(`/account/${encodeURIComponent(provider)}/playlists`);
}

export function deleteAccountPlaylist(id: string, provider: string) {
  return request<{ ok: boolean }>(`/account/${encodeURIComponent(provider)}/playlists/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export function removeAccountPlaylistTrack(id: string, trackId: string, provider: string) {
  return request<{ ok: boolean }>(`/account/${encodeURIComponent(provider)}/playlists/${encodeURIComponent(id)}/tracks/${encodeURIComponent(trackId)}`, { method: "DELETE" });
}

export function addAccountPlaylistTracks(id: string, trackIds: string[], provider: string) {
  return request<{ ok: boolean }>(`/account/${encodeURIComponent(provider)}/playlists/${encodeURIComponent(id)}/tracks`, {
    method: "POST", headers: jsonHeaders, body: JSON.stringify({ trackIds })
  });
}

export function reorderAccountPlaylistTracks(id: string, trackIds: string[], previousTrackIds: string[], provider: string) {
  return request<{ ok: boolean }>(`/account/${encodeURIComponent(provider)}/playlists/${encodeURIComponent(id)}/order`, {
    method: "POST", headers: jsonHeaders, body: JSON.stringify({ trackIds, previousTrackIds })
  });
}

export function setAccountPlaylistSubscription(playlistId: string, subscribed: boolean, provider = "netease") {
  const params = new URLSearchParams({ subscribed: String(subscribed) });
  return request<{ subscribed: boolean; synced: boolean }>(
    `/account/${encodeURIComponent(provider)}/playlists/${encodeURIComponent(playlistId)}/subscription?${params.toString()}`,
    { method: "POST", signal: AbortSignal.timeout(5_000) }
  );
}

export function loadCloudTracks(provider = "netease") {
  return request<CloudTrackView[]>(`/account/${encodeURIComponent(provider)}/cloud/tracks`);
}

export function loadCloudLyrics(id: string) {
  return request<CatalogLyrics>(
    `/account/netease/cloud/tracks/${encodeURIComponent(id)}/lyrics`
  );
}

export async function uploadCloudAudio() {
  if (!window.listenMusic) {
    throw new Error("音乐云盘上传需要在桌面客户端中使用");
  }
  return window.listenMusic.uploadCloudAudio() as Promise<CloudTrackView[]>;
}

export async function downloadCloudTrack(track: CloudTrackView) {
  if (!window.listenMusic) {
    throw new Error("音乐云盘下载需要在桌面客户端中使用");
  }
  if (!track.audioUrl) {
    throw new Error("网易云暂未返回这首歌曲的下载地址");
  }
  return window.listenMusic.downloadCloudTrack(track.audioUrl, track.originalFileName);
}

export function createAccountPlaylist(name: string, provider = "netease") {
  return request<AccountPlaylistView>(`/account/${encodeURIComponent(provider)}/playlists`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ name })
  });
}

export function loadFeaturedPlaylists(provider = "netease", refresh = false) {
  const query = refresh ? "?refresh=true" : "";
  return request<unknown[]>(`/account/${encodeURIComponent(provider)}/featured-playlists${query}`,
    undefined, provider === "qq" ? 35_000 : REQUEST_TIMEOUT_MS);
}

export function loadAccountPlaylist(playlistId: string, provider = "netease") {
  return request<unknown[]>(
    `/account/${encodeURIComponent(provider)}/playlists/${encodeURIComponent(playlistId)}`
  );
}

export function saveAccountFavorite(track: PersistedTrack, provider = "netease") {
  return request<{ ok: boolean }>(`/account/${encodeURIComponent(provider)}/favorites`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify(track)
  });
}

export function removeAccountFavorite(id: string, provider = "netease") {
  return request<{ ok: boolean }>(
    `/account/${encodeURIComponent(provider)}/favorites/${encodeURIComponent(id)}`,
    { method: "DELETE" }
  );
}

export function loadFavorites() {
  return request<unknown[]>("/library/favorites");
}

export function saveFavorite(track: PersistedTrack) {
  return request<{ ok: boolean }>("/library/favorites", {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify(track)
  });
}

export function removeFavorite(id: string) {
  return request<{ ok: boolean }>(`/library/favorites/${encodeURIComponent(id)}`, {
    method: "DELETE"
  });
}

export function loadHistory() {
  return request<unknown[]>("/library/history");
}

export function recordHistory(track: PersistedTrack) {
  return request<{ ok: boolean }>("/library/history", {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify(track)
  });
}

export function loadListeningStats() {
  return request<ListeningStatsPayload>("/library/listening-stats");
}

export function saveListeningStats(stats: ListeningStatsPayload) {
  return request<{ ok: boolean }>("/library/listening-stats", {
    method: "PUT",
    headers: jsonHeaders,
    body: JSON.stringify(stats)
  });
}

export function loadListeningStatsSummary(from?: string, to?: string) {
  const query = new URLSearchParams();
  if (from) query.set("from", from);
  if (to) query.set("to", to);
  const suffix = query.size > 0 ? `?${query}` : "";
  return request<ListeningStatsSummaryPayload>(`/library/listening-stats/summary${suffix}`);
}

export function deleteListeningStatsRange(from: string, to: string) {
  const query = new URLSearchParams({ from, to });
  return request<ListeningStatsPayload>(`/library/listening-stats?${query}`, { method: "DELETE" });
}

export function deleteAllListeningStats() {
  return request<ListeningStatsPayload>("/library/listening-stats?all=true", { method: "DELETE" });
}

export function loadPlaybackQueue() {
  return request<unknown[]>("/playback/queue");
}

export function savePlaybackQueue(tracks: PersistedTrack[]) {
  return request<{ ok: boolean }>("/playback/queue", {
    method: "PUT",
    headers: jsonHeaders,
    body: JSON.stringify(tracks)
  });
}

export function loadPlaybackState() {
  return request<PlaybackState>("/playback/state");
}

export function savePlaybackState(state: PlaybackState) {
  return request<{ ok: boolean }>("/playback/state", {
    method: "PUT",
    headers: jsonHeaders,
    body: JSON.stringify(state)
  });
}

export function searchCatalog(
  keywords: string,
  provider: "netease" | "qq",
  type: CatalogSearchType,
  limit: number,
  offset: number
) {
  const typeMap: Record<CatalogSearchType, string> = { song: "1", playlist: "1000", artist: "100" };
  const params = new URLSearchParams();
  params.set("keywords", keywords);
  params.set("provider", provider);
  params.set("type", typeMap[type]);
  params.set("limit", String(limit));
  params.set("offset", String(offset));
  return request<CatalogSearchPage>(`/catalog/cloudsearch?${params.toString()}`);
}

function artistParams(id: string, provider: "netease" | "qq") {
  return new URLSearchParams({ id, provider });
}

export function loadCatalogArtistDetail(id: string, provider: "netease" | "qq") {
  return request<CatalogArtistDetail>(`/catalog/artist/detail?${artistParams(id, provider).toString()}`);
}

export function loadCatalogArtistTopSongs(id: string, provider: "netease" | "qq") {
  return request<unknown[]>(`/catalog/artist/top-songs?${artistParams(id, provider).toString()}`);
}

export function loadCatalogArtistSongs(
  id: string,
  provider: "netease" | "qq",
  order = "hot",
  limit = 50,
  offset = 0
) {
  const params = artistParams(id, provider);
  params.set("order", order);
  params.set("limit", String(limit));
  params.set("offset", String(offset));
  return request<CatalogArtistSongPage>(`/catalog/artist/songs?${params.toString()}`);
}

export function loadCatalogArtistAlbums(id: string, provider: "netease" | "qq", limit = 30, offset = 0) {
  const params = artistParams(id, provider);
  params.set("limit", String(limit));
  params.set("offset", String(offset));
  return request<CatalogArtistAlbum[]>(`/catalog/artist/albums?${params.toString()}`);
}

export function loadCatalogArtistSubscription(id: string, provider: "netease" | "qq") {
  return request<{ subscribed: boolean }>(
    `/account/${encodeURIComponent(provider)}/artists/${encodeURIComponent(id)}/subscription`
  );
}

export function toggleCatalogArtistSubscription(id: string, provider: "netease" | "qq", subscribed: boolean) {
  const params = new URLSearchParams({ subscribed: String(subscribed) });
  return request<{ subscribed: boolean }>(
    `/account/${encodeURIComponent(provider)}/artists/${encodeURIComponent(id)}/subscription?${params.toString()}`,
    { method: "POST" }
  );
}

export function loadCatalogTrack(id: string) {
  return request<unknown>(`/catalog/tracks/${encodeURIComponent(id)}`);
}

export function loadCatalogPlaylist(id: string) {
  return request<unknown[]>(`/catalog/playlists/${encodeURIComponent(id)}`);
}

export function loadCatalogAudio(id: string, quality = "auto") {
  const params = new URLSearchParams({ quality });
  return backendRequestUrl(`/catalog/tracks/${encodeURIComponent(id)}/audio?${params.toString()}`);
}

export function loadCatalogLyrics(id: string) {
  return request<CatalogLyrics>(`/catalog/tracks/${encodeURIComponent(id)}/lyrics`);
}

export function scanLibrary(directory: string, useFilenameMetadata = true) {
  return window.listenMusic
    ? request<unknown[]>("/library/scan", {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify({ directory, useFilenameMetadata })
      })
    : request<unknown[]>("/library/scan", {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify({ directory, useFilenameMetadata })
      });
}

export function scanLibraryIncrementally(directory: string, useFilenameMetadata = true) {
  return request<LibraryScanResult>("/library/scan/incremental", {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ directory, useFilenameMetadata })
  }, 120_000);
}

export function scanAllLibrariesIncrementally(useFilenameMetadata = true) {
  return request<LibraryScanResult>("/library/scan/all/incremental", {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ useFilenameMetadata })
  }, 120_000);
}

export function ignoreLocalLibraryTracks(trackIds: string[]) {
  return request<PersistedTrack[]>("/library/tracks/ignore", {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ trackIds })
  });
}

export function restoreIgnoredLocalFiles() {
  return request<{ restored: number }>("/library/ignored", { method: "DELETE" });
}

export function reparseLibraryMetadata(directory: string, useFilenameMetadata = true) {
  return request<LibraryMetadataReparseResult>("/library/metadata/reparse", {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ directory, useFilenameMetadata })
  }, 120_000);
}

export function matchLocalTrackLyrics(id: string, saveBesideAudio = false, force = false) {
  const params = new URLSearchParams({
    saveBesideAudio: String(saveBesideAudio),
    force: String(force)
  });
  return request<LocalLyricsMatchResponse>(
    `/library/tracks/${encodeURIComponent(id)}/lyrics/match?${params.toString()}`,
    { method: "POST" }
  );
}

export function loadLyrics(path: string) {
  return request<string>(path);
}

export async function selectMusicDirectory() {
  if (window.listenMusic) {
    return window.listenMusic.selectDirectory();
  }
  const result = await request<{ directory?: string | null }>("/library/select-directory");
  return typeof result.directory === "string" && result.directory.trim()
    ? result.directory
    : null;
}

export async function loadCacheSnapshot() {
  return request<CacheSnapshot>("/cache");
}

export async function updateCacheSettings(settings: CacheSettings) {
  return request<CacheSnapshot>("/cache/settings", {
    method: "PUT",
    headers: jsonHeaders,
    body: JSON.stringify(settings)
  });
}

export async function restoreDefaultCacheDirectory() {
  return request<CacheSnapshot>("/cache/default-directory", { method: "POST" });
}

export async function clearManagedCache() {
  return request<CacheSnapshot>("/cache", { method: "DELETE" });
}

function selectPlaylistCoverImageFromBrowser() {
  return new Promise<string | null>((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/jpeg,image/png,image/webp";
    input.addEventListener("change", () => {
      const file = input.files?.[0];
      if (!file) {
        resolve(null);
        return;
      }
      const reader = new FileReader();
      reader.addEventListener("load", () => resolve(typeof reader.result === "string" ? reader.result : null));
      reader.addEventListener("error", () => resolve(null));
      reader.readAsDataURL(file);
    }, { once: true });
    input.click();
  });
}

export async function selectPlaylistCoverImage() {
  if (window.listenMusic) {
    try {
      return await window.listenMusic.selectCoverImage();
    } catch {
      return selectPlaylistCoverImageFromBrowser();
    }
  }
  return selectPlaylistCoverImageFromBrowser();
}

export async function loadCurrentAccount(): Promise<AccountView | null> {
  const response = await fetch(backendRequestUrl("/auth/current"));
  if (response.status === 204 || response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }
  return response.json() as Promise<AccountView>;
}

export function loadCurrentAccounts() {
  return request<AccountView[]>("/auth/accounts");
}

export function loginQqWithCookie(cookie: string) {
  return request<AccountView>("/auth/qq/cookie", {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ cookie })
  });
}

export function sendNeteaseSmsCode(phone: string) {
  return request<{ ok: boolean; message: string }>("/auth/netease/sms/send", {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ phone })
  });
}

export function loginNeteaseWithSms(phone: string, captcha: string) {
  return request<AccountView>("/auth/netease/sms/login", {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ phone, captcha })
  });
}

export function loginNeteaseWithPassword(account: string, password: string) {
  return request<AccountView>("/auth/netease/password/login", {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ account, password })
  });
}

export function startQrLogin(provider = "netease") {
  return request<QrLoginStartResponse>(`/auth/${encodeURIComponent(provider)}/qr/start`);
}

export function pollQrLogin(sessionId: string, provider = "netease") {
  return request<QrLoginStatusResponse>(
    `/auth/${encodeURIComponent(provider)}/qr/status?sessionId=${encodeURIComponent(sessionId)}`
  );
}

export function logoutProvider(provider = "netease") {
  return request<{ ok: boolean }>(`/auth/${encodeURIComponent(provider)}/logout`, { method: "POST" });
}
