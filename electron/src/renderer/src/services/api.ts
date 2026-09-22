const backendBaseUrl = "http://127.0.0.1:17890";

export interface CatalogLyrics {
  lyrics: string;
  translation?: string;
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
  lyricsSource?: string;
}

export interface PlaybackState {
  trackId: string | null;
  positionSeconds: number;
  volume: number;
  playMode: "shuffle" | "sequence" | "single" | "loop";
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

const jsonHeaders = { "Content-Type": "application/json" };

export function resolveBackendUrl(path: string | null | undefined) {
  if (!path) {
    return "";
  }
  return /^(?:https?:|file:|data:|blob:)/i.test(path) ? path : `${backendBaseUrl}${path}`;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${backendBaseUrl}${path}`, init);
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
    throw new Error(message || `Request failed: ${response.status}`);
  }
  return response.json() as Promise<T>;
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

export function loadPlaylistCategories() {
  return request<PlaylistCategoryData>("/catalog/playlist-categories");
}

export function loadDiscoveredPlaylists(category: string, order: "hot" | "new", limit: number, offset: number) {
  const params = new URLSearchParams({ category, order, limit: String(limit), offset: String(offset) });
  return request<PlaylistDiscoveryPage>(`/catalog/playlists?${params.toString()}`);
}

export function loadHighQualityPlaylists(category: string, limit: number, before?: string) {
  const params = new URLSearchParams({ category, limit: String(limit) });
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

export function loadAccountListeningRank(provider = "netease") {
  return request<unknown[]>(`/account/${encodeURIComponent(provider)}/listening-rank`);
}

export function loadAccountPlaylists(provider = "netease") {
  return request<unknown[]>(`/account/${encodeURIComponent(provider)}/playlists`);
}

export function loadFeaturedPlaylists(provider = "netease") {
  return request<unknown[]>(`/account/${encodeURIComponent(provider)}/featured-playlists`);
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

export function loadCatalogTrack(id: string) {
  return request<unknown>(`/catalog/tracks/${encodeURIComponent(id)}`);
}

export function loadCatalogPlaylist(id: string) {
  return request<unknown[]>(`/catalog/playlists/${encodeURIComponent(id)}`);
}

export function loadCatalogAudio(id: string) {
  return `${backendBaseUrl}/catalog/tracks/${encodeURIComponent(id)}/audio`;
}

export function loadCatalogLyrics(id: string) {
  return request<CatalogLyrics>(`/catalog/tracks/${encodeURIComponent(id)}/lyrics`);
}

export function scanLibrary(directory: string) {
  return window.listenMusic
    ? request<unknown[]>("/library/scan", {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify({ directory })
      })
    : request<unknown[]>("/library/scan", {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify({ directory })
      });
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
  const response = await fetch(`${backendBaseUrl}/auth/current`);
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
