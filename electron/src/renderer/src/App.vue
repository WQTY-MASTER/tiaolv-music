<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from "vue";
import { setDiagnosticContext } from "./services/diagnostics";
import { runTrackBatch, type TrackBatchAction, type TrackBatchResult } from "./services/streamingTrackManagement";
import { matchLocalAudioSource, type LocalAudioSelection, type LocalAudioSourceGroup } from "./services/localAudioSources";
import {
  AppWindow,
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronRight,
  Cloud,
  Compass,
  Database,
  Filter,
  FolderOpen,
  Headphones,
  Heart,
  House,
  ListEnd,
  ListMusic,
  Network,
  PanelBottom,
  Pause,
  Play,
  Power,
  RefreshCw,
  Search,
  Shuffle,
  Sparkles,
  Trash2,
  UserRound,
  X
} from "lucide-vue-next";
import PlayerBar from "./components/PlayerBar.vue";
import MiniPlayer from "./components/MiniPlayer.vue";
import WindowTitlebar from "./components/WindowTitlebar.vue";
import FirstRunOnboarding from "./components/FirstRunOnboarding.vue";
import DesktopLyricsSettings from "./components/DesktopLyricsSettings.vue";
import AppearanceSettings from "./components/AppearanceSettings.vue";
import ShortcutSettings from "./components/ShortcutSettings.vue";
import AboutSettings from "./components/AboutSettings.vue";
import type { ShortcutAction } from "../../shared/shortcuts";
import type { MiniPlayerAction, MiniPlayerSnapshot, MiniPlayerTrack } from "../../shared/miniPlayer";
import PlaylistCard from "./components/PlaylistCard.vue";
import SidebarNav from "./components/SidebarNav.vue";
import AccountMenu from "./components/AccountMenu.vue";
import AggregatePlaylistPage from "./components/AggregatePlaylistPage.vue";
import StreamingDailyMixPage from "./components/StreamingDailyMixPage.vue";
import StreamingPlaylistDiscoveryPage from "./components/StreamingPlaylistDiscoveryPage.vue";
import StreamingSearchPage from "./components/StreamingSearchPage.vue";
import StreamingArtistDetailPage from "./components/StreamingArtistDetailPage.vue";
import StreamingLibraryPage from "./components/StreamingLibraryPage.vue";
import StreamingCloudPage from "./components/StreamingCloudPage.vue";
import StreamingSocialPage from "./components/StreamingSocialPage.vue";
import StreamingUserProfilePage from "./components/StreamingUserProfilePage.vue";
import StreamingQqLoginPage from "./components/StreamingQqLoginPage.vue";
import StreamingQqRankingCards from "./components/StreamingQqRankingCards.vue";
import StreamingQqCuratedPlaylists from "./components/StreamingQqCuratedPlaylists.vue";
import {
  loadFavorites,
  loadHistory,
  loadListeningStats,
  loadListeningStatsSummary,
  loadLibrary,
  loadLocalLibraryRoots,
  loadIgnoredLocalFiles,
  loadCatalogLyrics,
  loadCatalogPlaylist,
  loadCatalogAudio,
  loadCatalogTrack,
  loadCacheSnapshot,
  loadPlaybackQueue,
  loadPlaybackState,
  loadPlaylists,
  pingBackend,
  recordHistory,
  removeFavorite,
  removeLocalLibraryRoot,
  resetLocalLibrary,
  resolveBackendUrl,
  saveFavorite,
  savePlaybackQueue,
  savePlaybackState,
  saveListeningStats,
  deleteListeningStatsRange,
  deleteAllListeningStats,
  loadHomepage,
  loadDiscovery,
  loadPlaylistCategories,
  loadDiscoveredPlaylists,
  loadHighQualityPlaylists,
  updatePlaylistPlayCount,
  loadAccountRecommendations,
  loadPrivateRadar,
  loadPrivateRoaming,
  loadAccountFavorites,
  loadAccountProfile,
  loadAccountUserProfile,
  loadAccountFollowing,
  loadAccountFollowers,
  loadAccountRecentTracks,
  deleteAccountRecentTracks,
  loadAccountListeningRank,
  reportQqListeningDelta,
  reportQqRecentPlay,
  loadQqListeningDataSummaries,
  deleteQqListeningStats,
  reportListeningScrobble,
  loadAccountPlaylists,
  deleteAccountPlaylist,
  setAccountPlaylistSubscription,
  createAccountPlaylist,
  loadCloudTracks,
  loadCloudLyrics,
  uploadCloudAudio,
  downloadCloudTrack,
  loadFeaturedPlaylists,
  loadAccountPlaylist,
  loadCatalogArtistDetail,
  loadCatalogArtistTopSongs,
  loadCatalogArtistSongs,
  loadCatalogArtistAlbums,
  loadCatalogArtistSubscription,
  toggleCatalogArtistSubscription,
  saveAccountFavorite,
  removeAccountFavorite,
  removeAccountPlaylistTrack,
  addAccountPlaylistTracks,
  reorderAccountPlaylistTracks,
  restoreDefaultCacheDirectory,
  logoutProvider,
  matchLocalTrackLyrics,
  reparseLibraryMetadata,
  restoreIgnoredLocalFiles,
  scanLibrary,
  scanAllLibrariesIncrementally,
  scanLibraryIncrementally,
  ignoreLocalLibraryTracks,
  searchCatalog,
  selectMusicDirectory,
  selectPlaylistCoverImage,
  updateCacheSettings,
  clearManagedCache,
  loadCurrentAccounts,
  loadCurrentAccount,
  setPageDataCacheAccountScope,
  clearPageDataCacheAccountScope,
  invalidatePageDataCache,
  invalidatePageDataCacheForProvider,
  type AccountPlaylistView,
  type AccountProfileView,
  type AccountSocialUserView,
  type AccountView,
  type CloudTrackView,
  type CatalogSearchArtist,
  type CatalogArtistDetail,
  type CatalogArtistAlbum,
  type CatalogSearchType,
  type CacheSettings,
  type CacheSnapshot,
  ApiRequestError,
  type ListeningStatsSummaryPayload,
  type PersistedTrack,
  type QqListeningRankEntry,
  type QqListeningRankPeriod,
  type QqListeningDataSummary,
  type PlaybackState
} from "./services/api";
import {
  acknowledgeQqListeningFlush,
  beginQqRecentPlayReport,
  createQqListeningSession,
  failQqListeningFlush,
  pauseQqListeningSession,
  prepareQqListeningFlush,
  sampleQqListeningPlayback,
  type QqListeningSession
} from "./services/qqListeningSession";
import { readAppMode, writeAppMode, type AppMode } from "./services/appMode";
import {
  readStartupHome,
  resolveStartupMode,
  writeStartupHome,
  type StartupHome
} from "./services/startupHome";
import {
  applyOnlineAudioCachePolicy,
  readOnlineAudioCachePolicy,
  writeOnlineAudioCachePolicy,
  type OnlineAudioCachePolicy
} from "./services/onlineAudioCache";
import AuthPanel from "./components/AuthPanel.vue";
import {
  findActiveLyricIndex,
  createPrefaceLineTimes,
  getLyricCharacterProgress,
  getLyricHighlightState,
  getPrefaceHighlightState,
  getPreludeEndTime,
  stabilizeLyricCharacterProgress
} from "./services/lyricSync";
import {
  parseLyricContent,
  getLeadingLyricQuote,
  splitLyricCharacters,
  type LyricLine
} from "./services/lyricParser";
import {
  createPlaybackClock,
  getPlaybackDuration,
  getSeekablePlaybackDuration,
  isPreviewPlayback
} from "./services/playbackClock";
import {
  DEFAULT_FADE_DURATION_MS,
  boundFadeDurationMs,
  interpolateFadeVolume,
  normalizeFadeDurationMs
} from "./services/playbackFade";
import {
  normalizeSleepTimerMinutes,
  sleepTimerRemainingSeconds as calculateSleepTimerRemainingSeconds,
  type SleepTimerMinutes
} from "./services/sleepTimer";
import { selectPreferredLocalPlaybackTrack } from "./services/preferredLocalPlayback";
import {
  NETEASE_QUALITY_OPTIONS,
  QQ_QUALITY_OPTIONS,
  localPlaybackFormat,
  playbackQualitySource,
  readPlaybackQualityPreferences,
  writePlaybackQualityPreferences,
  type NeteasePlaybackQuality,
  type QqPlaybackQuality
} from "./services/playbackQuality";
import {
  AudioOutputController,
  applyAudioOutputDevice,
  enumerateAudioOutputDevices,
  readAudioOutputPreferences,
  resolveAudioOutputDeviceId,
  supportsAudioOutputSelection,
  writeAudioOutputPreferences,
  type AudioOutputDevice,
  type AudioOutputPreferences
} from "./services/audioOutput";
import type {
  DesktopLyricsAction,
  DesktopLyricsPlaybackState
} from "../../shared/desktopLyrics";
import {
  normalizeLyricCredits,
  parseLyricCredits,
  type LyricCredit
} from "./services/lyricMetadata";
import {
  createSoftCoverPalette,
  extractCoverPalette,
  type CoverPalette
} from "./services/coverPalette";
import {
  readAppearancePreferences,
  resolveAppearanceFont,
  resolveDarkTheme,
  resolvePageBackground,
  resolveReducedMotion,
  writeAppearancePreferences,
  type AppearancePage,
  type PlayerBarPresentation
} from "./services/appearanceSettings";
import { hasCompletedOnboarding, markOnboardingCompleted } from "./services/onboarding";
import { createStreamingHomeCache } from "./services/streamingHomeCache";
import {
  readDesktopIntegrationPreferences,
  writeDesktopIntegrationPreferences
} from "../../shared/desktopIntegration";
import {
  addListeningSeconds,
  getCalendarIntensity,
  getMonthListeningSummary,
  getTrackListeningMinutes,
  mergeListeningStats,
  readListeningStats,
  recordListeningPlay,
  secondsToDisplayMinutes,
  toLocalDateKey,
  writeListeningStats,
  type ListeningStatsState
} from "./services/listeningStats";
import {
  createListeningStatsRange,
  describeListeningStatsRange,
  formatListeningDuration,
  type ListeningStatsRetentionMode
} from "./services/listeningStatsRetention";
import {
  beginScrobbleReport,
  createScrobbleSession,
  resetScrobbleSample,
  sampleScrobblePlayback,
  type ListeningScrobbleSession
} from "./services/listeningScrobble";
import {
  LEGACY_AGGREGATE_PLAYLIST_MIGRATION_KEY,
  addTrackToAggregatePlaylist,
  createAggregatePlaylist,
  mergeAggregatePlaylistCollections,
  mergeAggregateTracks,
  readAggregatePlaylists,
  removeAggregateTrackGroup,
  reorderAggregateTrackGroups,
  writeAggregatePlaylists,
  type AggregatePlaylist,
  type AggregateTrackSource
} from "./services/aggregatePlaylists";
import { applyTrackOrder, reorderVisibleKeys, trackOrderKey } from "./services/playlistOrder";
import { mediaPathToUrl as filePathToUrl, resolvePlaylistCover } from "./services/playlistCovers";
import {
  mergePlaylistSubscriptionOverrides,
  savePlaylistSubscriptionOverride
} from "./services/playlistSubscriptionOverrides";

type ViewKey =
  | "home"
  | "discover"
  | "playlist"
  | "library"
  | "liked"
  | "history"
  | "daily"
  | "artists"
  | "albums"
  | "playlists"
  | "aggregate"
  | "folders"
  | "streaming-library"
  | "account-following"
  | "account-followers"
  | "account-user-profile"
  | "streaming-recent"
  | "listening-ranking"
  | "cloud"
  | "settings";
type PlayMode = "shuffle" | "sequence" | "single" | "loop";
type SettingsSection = "general" | "playback" | "appearance" | "desktop-lyrics" | "cache" | "shortcuts" | "about";
type TrackPlaylistPickerMode = "regular" | "aggregate" | "streaming";
type HistorySource = "all" | "local" | "netease" | "qq";
type AccountProvider = "netease" | "qq";
type SearchTab = CatalogSearchType;
type RoamingMode = "DEFAULT" | "FAMILIAR" | "EXPLORE" | "PUZZLE_MODE_RCMD" | "SCENE_RCMD";
type HistorySortMode = "recent" | "oldest" | "title";
type LocalAlbumSortMode = "default" | "title" | "duration";
type DuplicateRecognitionMode = "path" | "metadata";
type TrayMediaAction = "previous" | "toggle" | "next" | "favorite" | "desktop-lyrics" | "mini-player" | "settings"
  | `play-mode:${PlayMode}`;
const historySourceOptions = [
  { value: "all", label: "全部" },
  { value: "local", label: "本地音乐" },
  { value: "netease", label: "网易云" },
  { value: "qq", label: "QQ 音乐" }
];

interface Playlist {
  id: string;
  title: string;
  subtitle: string;
  count: number;
  primary: string;
  secondary: string;
  mark: string;
  imageUrl?: string;
  coverPath?: string;
  source?: string;
  accountScoped?: boolean;
  createdByAccount?: boolean;
  deletable?: boolean;
  favorite?: boolean;
  streamingTemplate?: boolean;
  playCount?: number;
  userManaged?: boolean;
  recommendationSource?: string;
  recommendationReason?: string;
}

interface Track {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
  primary: string;
  secondary: string;
  mark: string;
  liked: boolean;
  history: boolean;
  source?: string;
  filePath?: string;
  audioUrl?: string;
  coverUrl?: string;
  coverFallbackUrl?: string;
  codec?: string;
  sampleRate?: number;
  bitDepth?: number;
  genre?: string;
  lyrics?: string;
  lyricsTranslation?: string;
  lyricsPhonetic?: string;
  lyricsFormat?: string;
  lyricsSource?: string;
  metaSource?: "embedded" | "filename";
  lyricCredits?: LyricCredit[];
  hasLyrics?: boolean;
  hasCover?: boolean;
  createdAt?: string;
  updatedAt?: string;
  queueKey?: string;
  preferredLocalPlayback?: boolean;
  playbackFallbackUrl?: string;
  playbackFormat?: string;
}

interface PlayTrackOptions {
  fadeIn?: boolean;
  transitionToken?: number;
}

interface LocalDuplicateGroup {
  key: string;
  title: string;
  artist: string;
  tracks: Track[];
}

type QqHomeRankingKey = "rising" | "hot";

interface QqHomeRanking {
  key: QqHomeRankingKey;
  playlistId: string;
  title: string;
  eyebrow: string;
  description: string;
  count: number;
  primary: string;
  secondary: string;
  tracks: Track[];
  state: "idle" | "loading" | "success" | "error";
  error: string;
}

type StreamingHomeAsyncState = "idle" | "loading" | "success" | "error";

interface StreamingHomeSnapshot {
  tracks: Track[];
  playlists: Playlist[];
  radarTracks: Track[];
  radarState: StreamingHomeAsyncState;
  radarError: string;
  roamingTracks: Track[];
  roamingState: StreamingHomeAsyncState;
  roamingError: string;
}

const QQ_HOME_RANKING_DEFINITIONS = [
  {
    key: "rising",
    playlistId: "qq:rank-62",
    title: "巅峰 · 飙升榜",
    eyebrow: "RISING NOW",
    description: "正在被更多人听见的好歌，每日更新。",
    primary: "#ddf4e7",
    secondary: "#edf9f4"
  },
  {
    key: "hot",
    playlistId: "qq:rank-26",
    title: "巅峰 · 热歌榜",
    eyebrow: "MOST PLAYED",
    description: "QQ 音乐的人气之选，找到值得循环的那一首。",
    primary: "#deedf6",
    secondary: "#f0f6fa"
  }
] as const;

function createInitialQqHomeRankings(): QqHomeRanking[] {
  return QQ_HOME_RANKING_DEFINITIONS.map((ranking) => ({
    ...ranking,
    count: 30,
    tracks: [],
    state: "idle",
    error: ""
  }));
}

interface LocalAlbum {
  id: string;
  title: string;
  artistText: string;
  coverUrl?: string;
  primary: string;
  secondary: string;
  mark: string;
  tracks: Track[];
}

interface LocalFolder {
  id: string;
  path: string;
  name: string;
  tracks: Track[];
  coverUrl?: string;
  coverTrack: Track;
  primary: string;
  secondary: string;
  mark: string;
}

interface LocalArtist {
  id: string;
  name: string;
  trackCount: number;
  tracks: Track[];
  albums: LocalAlbum[];
  genres: string[];
  coverUrl?: string;
  primary: string;
  secondary: string;
  mark: string;
  letter: string;
}

interface HomepageBanner {
  title: string;
  subtitle: string;
  imageUrl: string;
  targetId?: string;
  targetType?: number;
  targetUrl?: string;
}

interface HomepageData {
  banners: HomepageBanner[];
  playlists: Playlist[];
  songs: Track[];
  cursor?: string;
  hasMore: boolean;
}

interface NavigationEntry {
  view: ViewKey;
  playlist?: Playlist;
}

interface StoredPlaylist {
  playlist: Playlist;
  tracks: PersistedTrack[];
}

const demoPlaylists: Playlist[] = [
  { id: "focus", title: "专注时刻", subtitle: "安静工作，也安静生活", count: 24, primary: "#9cc9d5", secondary: "#d8a9bd", mark: "专" },
  { id: "night", title: "夜色漫游", subtitle: "给晚风留一段旋律", count: 18, primary: "#1d293c", secondary: "#6c8ea9", mark: "夜" },
  { id: "city", title: "城市心跳", subtitle: "适合一边走路一边听", count: 32, primary: "#ec9c6b", secondary: "#db4d65", mark: "城" },
  { id: "acoustic", title: "木吉他下午", subtitle: "清爽、松弛、慢一点", count: 16, primary: "#d1ad78", secondary: "#73845d", mark: "木" },
  { id: "favorites", title: "我喜欢的音乐", subtitle: "把喜欢的歌放在一起", count: 56, primary: "#eadff6", secondary: "#ffe3ef", mark: "♡", userManaged: true },
  { id: "local", title: "本地音乐", subtitle: "来自这台设备的声音", count: 12, primary: "#83bba4", secondary: "#318b82", mark: "本" }
];

const demoTracks: Track[] = [
  { id: "track-1", title: "晚风经过", artist: "陈婧霏", album: "春潮", duration: 254, primary: "#a8c7d4", secondary: "#6d789c", mark: "风", liked: true, history: true, lyrics: "" },
  { id: "track-2", title: "平凡的一天", artist: "毛不易", album: "平凡的一天", duration: 238, primary: "#e5b487", secondary: "#b65d55", mark: "日", liked: true, history: true, lyrics: "" },
  { id: "track-3", title: "旅行的意义", artist: "陈绮贞", album: "华丽的冒险", duration: 221, primary: "#d58d8b", secondary: "#7c526d", mark: "旅", liked: false, history: true, lyrics: "" },
  { id: "track-4", title: "春日漫步", artist: "The Paper Kites", album: "On the Train Ride Home", duration: 198, primary: "#a4ca9d", secondary: "#467a68", mark: "春", liked: false, history: false, lyrics: "" },
  { id: "track-5", title: "一直很安静", artist: "阿桑", album: "寂寞在唱歌", duration: 270, primary: "#b8a1c9", secondary: "#5d557f", mark: "静", liked: true, history: false, lyrics: "" }
];

const DEFAULT_TRACK_ID = "__default__";
const defaultTrack: Track = {
  id: DEFAULT_TRACK_ID,
  title: "调律音乐",
  artist: "暂无歌曲",
  album: "",
  duration: 0,
  primary: "#d9efeb",
  secondary: "#a8d8d1",
  mark: "律",
  liked: false,
  history: false,
  source: "local",
  lyrics: ""
};

const LEGACY_STORAGE_PREFIX = "listen-music-";
const STORAGE_PREFIX = "tiaolv-music-";
const STORED_SETTING_NAMES = [
  "local-playlists",
  "playlist-overview-order",
  "playlist-track-order",
  "playlist-cover-paths",
  "streaming-source",
  "local-lyrics-online-match",
  "save-matched-lyrics-beside-audio",
  "use-filename-metadata",
  "local-library-directory",
  "auto-scan-local-library",
  "duplicate-recognition-mode",
  "startup-home",
  "taskbar-thumbnail-buttons",
  "system-tray-enabled",
  "playback-fade-enabled",
  "playback-fade-duration-ms",
  "prefer-local-download-playback",
  "aggregate-playlists"
] as const;

function migrateLegacyStorage() {
  STORED_SETTING_NAMES.forEach((name) => {
    const currentKey = `${STORAGE_PREFIX}${name}`;
    if (window.localStorage.getItem(currentKey) !== null) return;
    const legacyValue = window.localStorage.getItem(`${LEGACY_STORAGE_PREFIX}${name}`);
    if (legacyValue !== null) window.localStorage.setItem(currentKey, legacyValue);
  });
}

migrateLegacyStorage();

const LOCAL_PLAYLIST_STORAGE_KEY = `${STORAGE_PREFIX}local-playlists`;
const PLAYLIST_OVERVIEW_ORDER_STORAGE_KEY = `${STORAGE_PREFIX}playlist-overview-order`;
const PLAYLIST_TRACK_ORDER_STORAGE_KEY = `${STORAGE_PREFIX}playlist-track-order`;
const PLAYLIST_COVER_PATH_STORAGE_KEY = `${STORAGE_PREFIX}playlist-cover-paths`;
const STREAMING_SOURCE_STORAGE_KEY = `${STORAGE_PREFIX}streaming-source`;
const LOCAL_LYRICS_MATCH_STORAGE_KEY = `${STORAGE_PREFIX}local-lyrics-online-match`;
const SAVE_MATCHED_LYRICS_BESIDE_AUDIO_STORAGE_KEY = `${STORAGE_PREFIX}save-matched-lyrics-beside-audio`;
const USE_FILENAME_METADATA_STORAGE_KEY = `${STORAGE_PREFIX}use-filename-metadata`;
const LOCAL_LIBRARY_DIRECTORY_STORAGE_KEY = `${STORAGE_PREFIX}local-library-directory`;
const AUTO_SCAN_LOCAL_LIBRARY_STORAGE_KEY = `${STORAGE_PREFIX}auto-scan-local-library`;
const DUPLICATE_RECOGNITION_MODE_STORAGE_KEY = `${STORAGE_PREFIX}duplicate-recognition-mode`;
const TASKBAR_THUMBNAIL_BUTTONS_STORAGE_KEY = `${STORAGE_PREFIX}taskbar-thumbnail-buttons`;
const SYSTEM_TRAY_ENABLED_STORAGE_KEY = `${STORAGE_PREFIX}system-tray-enabled`;
const PLAYBACK_FADE_ENABLED_STORAGE_KEY = `${STORAGE_PREFIX}playback-fade-enabled`;
const PLAYBACK_FADE_DURATION_STORAGE_KEY = `${STORAGE_PREFIX}playback-fade-duration-ms`;
const PREFER_LOCAL_DOWNLOAD_PLAYBACK_STORAGE_KEY = `${STORAGE_PREFIX}prefer-local-download-playback`;

function readStreamingSource(): AccountProvider {
  return window.localStorage.getItem(STREAMING_SOURCE_STORAGE_KEY) === "qq" ? "qq" : "netease";
}

function readLocalLyricsOnlineMatchEnabled() {
  return window.localStorage.getItem(LOCAL_LYRICS_MATCH_STORAGE_KEY) === "true";
}

function readSaveMatchedLyricsBesideAudio() {
  return window.localStorage.getItem(SAVE_MATCHED_LYRICS_BESIDE_AUDIO_STORAGE_KEY) === "true";
}

function readUseFilenameMetadataEnabled() {
  return window.localStorage.getItem(USE_FILENAME_METADATA_STORAGE_KEY) !== "false";
}

function readLocalLibraryDirectory() {
  return window.localStorage.getItem(LOCAL_LIBRARY_DIRECTORY_STORAGE_KEY)?.trim() || "G:\\本地音乐";
}

function readAutoScanLocalLibraryEnabled() {
  return window.localStorage.getItem(AUTO_SCAN_LOCAL_LIBRARY_STORAGE_KEY) === "true";
}

function readDuplicateRecognitionMode(): DuplicateRecognitionMode {
  if (window.localStorage.getItem(DUPLICATE_RECOGNITION_MODE_STORAGE_KEY) === "metadata") {
    return "metadata";
  }
  return "path";
}

function readTaskbarThumbnailButtonsEnabled() {
  return window.localStorage.getItem(TASKBAR_THUMBNAIL_BUTTONS_STORAGE_KEY) !== "false";
}

function readSystemTrayEnabled() {
  return window.localStorage.getItem(SYSTEM_TRAY_ENABLED_STORAGE_KEY) !== "false";
}

function readPlaybackFadeEnabled() {
  return window.localStorage.getItem(PLAYBACK_FADE_ENABLED_STORAGE_KEY) !== "false";
}

function readPlaybackFadeDurationMs() {
  const storedValue = window.localStorage.getItem(PLAYBACK_FADE_DURATION_STORAGE_KEY);
  return storedValue === null ? DEFAULT_FADE_DURATION_MS : normalizeFadeDurationMs(Number(storedValue));
}

function readPreferLocalDownloadPlayback() {
  return window.localStorage.getItem(PREFER_LOCAL_DOWNLOAD_PLAYBACK_STORAGE_KEY) !== "false";
}

function trackFromPersisted(track: PersistedTrack, index: number): Track {
  const colors = [
    ["#a8c7d4", "#6d789c"],
    ["#e5b487", "#b65d55"],
    ["#d58d8b", "#7c526d"],
    ["#a4ca9d", "#467a68"]
  ][index % 4];
  const title = String(track.title || "未知歌曲");
  return {
    id: track.id,
    title,
    artist: String(track.artist || "未知歌手"),
    album: String(track.album || "未知专辑"),
    duration: Number(track.duration || 0),
    primary: colors[0],
    secondary: colors[1],
    mark: title.slice(0, 1),
    liked: false,
    history: false,
    source: track.source || "local",
    filePath: track.filePath,
    audioUrl: track.url,
    coverUrl: track.coverUrl,
    lyrics: track.lyrics,
    lyricsSource: track.lyricsSource,
    lyricsFormat: track.lyricsFormat,
    metaSource: track.metaSource
  };
}

function readPersistedLocalPlaylists() {
  try {
    const raw = window.localStorage.getItem(LOCAL_PLAYLIST_STORAGE_KEY);
    if (!raw) {
      return { playlists: [] as Playlist[], tracks: {} as Record<string, Track[]> };
    }
    const parsed = JSON.parse(raw) as StoredPlaylist[];
    const playlists: Playlist[] = [];
    const tracks: Record<string, Track[]> = {};
    parsed.forEach((entry) => {
      if (!entry?.playlist?.id || !entry.playlist.title) {
        return;
      }
      playlists.push({ ...entry.playlist, userManaged: true });
      tracks[entry.playlist.id] = Array.isArray(entry.tracks)
        ? entry.tracks.map(trackFromPersisted)
        : [];
    });
    return { playlists, tracks };
  } catch {
    return { playlists: [] as Playlist[], tracks: {} as Record<string, Track[]> };
  }
}

function readPersistedPlaylistOverviewOrder() {
  try {
    const raw = window.localStorage.getItem(PLAYLIST_OVERVIEW_ORDER_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [] as string[];
  }
}

function readPersistedPlaylistTrackOrder() {
  try {
    const raw = window.localStorage.getItem(PLAYLIST_TRACK_ORDER_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {} as Record<string, string[]>;
    }
    return Object.fromEntries(
      Object.entries(parsed).filter((entry): entry is [string, string[]] => (
        Array.isArray(entry[1]) && entry[1].every((key) => typeof key === "string")
      ))
    );
  } catch {
    return {} as Record<string, string[]>;
  }
}

function readPersistedPlaylistCoverPaths() {
  try {
    const raw = window.localStorage.getItem(PLAYLIST_COVER_PATH_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {} as Record<string, string>;
    }
    return Object.fromEntries(
      Object.entries(parsed).filter((entry): entry is [string, string] => typeof entry[1] === "string" && Boolean(entry[1]))
    );
  } catch {
    return {} as Record<string, string>;
  }
}

function toPlaylistTrackSnapshot(track: Track): PersistedTrack {
  return {
    id: track.id,
    title: track.title,
    artist: track.artist,
    album: track.album,
    duration: track.duration,
    source: track.source,
    filePath: track.filePath,
    url: track.audioUrl,
    coverUrl: track.coverUrl,
    lyrics: track.lyrics,
    lyricsSource: track.lyricsSource,
    lyricsFormat: track.lyricsFormat
  };
}

const persistedLocalPlaylistState = readPersistedLocalPlaylists();

const startupHome = ref<StartupHome>(readStartupHome(window.localStorage));
const appMode = ref<AppMode>(resolveStartupMode(startupHome.value, readAppMode()));
const sidebarCollapsed = ref(false);
const account = ref<AccountView | null>(null);
const accounts = ref<AccountView[]>([]);
const accountMenuVisible = ref(false);
const authPanelVisible = ref(false);
const selectedAuthProvider = ref<AccountProvider>("netease");
const streamingSource = ref<AccountProvider>(readStreamingSource());
const streamingSourceMenuVisible = ref(false);
const streamingHomeTracks = ref<Track[]>([]);
const streamingHomePlaylists = ref<Playlist[]>([]);
const qqHomeRankings = ref<QqHomeRanking[]>(createInitialQqHomeRankings());
const streamingDailyTrackCache = ref<Record<AccountProvider, Track[]>>({ netease: [], qq: [] });
const streamingRadarTracks = ref<Track[]>([]);
const streamingRadarState = ref<"idle" | "loading" | "success" | "error">("idle");
const streamingRadarError = ref("");
const privateRoamingTracks = ref<Track[]>([]);
const privateRoamingState = ref<"idle" | "loading" | "success" | "error">("idle");
const privateRoamingError = ref("");
const privateRoamingMode = ref<RoamingMode>("FAMILIAR");
const privateRoamingScene = ref("FOCUS");
const privateRoamingActive = ref(false);
const streamingHomeState = ref<"idle" | "loading" | "success" | "error">("idle");
const streamingHomeError = ref("");
const streamingHomeCache = createStreamingHomeCache<StreamingHomeSnapshot>();
const qqHomePlaylistsRefreshing = ref(false);
const qqHomePlaylistsError = ref("");
const selectedAuthAccount = computed(() =>
  accounts.value.find((candidate) => candidate.provider === selectedAuthProvider.value) ?? null
);
const selectedStreamingAccount = computed(() =>
  accounts.value.find((candidate) => candidate.provider === streamingSource.value) ?? null
);
const neteaseAccount = computed(() =>
  accounts.value.find((candidate) => candidate.provider === "netease") ?? account.value
);
const qqAccount = computed(() =>
  accounts.value.find((candidate) => candidate.provider === "qq") ?? null
);
const streamingProviderName = computed(() => streamingSource.value === "qq" ? "QQ 音乐" : "网易云音乐");
const streamingGreeting = computed(() => {
  const hour = new Date().getHours();
  if (hour < 11) return "早上好，开启今天的声音";
  if (hour < 18) return "下午好，听点喜欢的";
  return "晚上好，放松一下";
});
const streamingDailyDate = computed(() => {
  const today = new Date();
  const weekdays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  return {
    day: String(today.getDate()).padStart(2, "0"),
    label: `${today.getMonth() + 1}月${today.getDate()}日 · ${weekdays[today.getDay()]}`
  };
});
const streamingDailyCoverTracks = computed(() => streamingHomeTracks.value.slice(0, 3));
const streamingDailyPreviewTracks = computed(() => streamingHomeTracks.value.slice(0, 8));
const streamingRadarCoverUrls = computed(() => {
  const urls = streamingRadarTracks.value
    .map((track) => track.coverUrl)
    .filter((url): url is string => Boolean(url));
  return [...new Set(urls)].slice(0, 3);
});
const streamingRoamingCoverUrls = computed(() => {
  const urls = privateRoamingTracks.value
    .map((track) => track.coverUrl)
    .filter((url): url is string => Boolean(url));
  return [...new Set(urls)].slice(0, 3);
});
const activeView = ref<ViewKey>("home");
const activeSettingsSection = ref<SettingsSection>("general");
const settingsSearchKeyword = ref("");
const appearancePreferences = ref(readAppearancePreferences(window.localStorage));
const showFirstRunOnboarding = ref(!hasCompletedOnboarding(window.localStorage));
const onboardingExitImmediately = ref(false);
const onboardingLoginPreference = ref<"after-guide" | "later">("later");
const onlineAudioCachePolicy = ref<OnlineAudioCachePolicy>(readOnlineAudioCachePolicy(window.localStorage));
const systemDarkMediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
const systemReducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
const systemPrefersDark = ref(systemDarkMediaQuery.matches);
const systemPrefersReducedMotion = ref(systemReducedMotionQuery.matches);
const cacheSettings = reactive<CacheSettings>({
  directory: "",
  coverEnabled: true,
  lyricsEnabled: true,
  metadataEnabled: true
});
const cacheStatistics = ref<CacheSnapshot["statistics"]>({
  totalBytes: 0,
  totalEntries: 0,
  cover: { bytes: 0, entries: 0 },
  lyrics: { bytes: 0, entries: 0 },
  metadata: { bytes: 0, entries: 0 }
});
const cacheSettingsPending = ref(false);
const backgroundCacheStatistics = ref({ directory: "", bytes: 0, entries: 0 });
const totalCacheBytes = computed(() => cacheStatistics.value.totalBytes + backgroundCacheStatistics.value.bytes);
const totalCacheEntries = computed(() => cacheStatistics.value.totalEntries + backgroundCacheStatistics.value.entries);
const cacheSettingsLoaded = ref(false);
const cacheSettingsNotice = ref("");
const cacheSettingsError = ref("");
const listeningDataSummary = ref<ListeningStatsSummaryPayload | null>(null);
const listeningDataSummaryPending = ref(false);
const listeningDataDeletePending = ref(false);
const listeningDataNotice = ref("");
const listeningDataError = ref("");
const listeningDataDeleteMode = ref<ListeningStatsRetentionMode>("month");
const listeningDataDeleteYear = ref(new Date().getFullYear());
const listeningDataDeleteMonth = ref(new Date().getMonth() + 1);
let listeningDataSummaryRequestId = 0;
const qqListeningDataSummaries = ref<QqListeningDataSummary[]>([]);
const selectedQqListeningDataAccountId = ref("");
const qqListeningDataPending = ref(false);
const qqListeningDataDeletePending = ref(false);
const qqListeningDataDeleteMode = ref<"range" | "all">("range");
const qqListeningDataDeleteFrom = ref(toLocalDateKey(new Date(Date.now() - 6 * 24 * 60 * 60 * 1_000)));
const qqListeningDataDeleteTo = ref(toLocalDateKey(new Date()));
const qqListeningDataNotice = ref("");
const qqListeningDataError = ref("");
const localLibrarySearchKeyword = ref("");
const localFolderSearchKeyword = ref("");
const selectedLocalFolderPath = ref<string | null>(null);
const historySearchKeyword = ref("");
const historySourceFilter = ref<HistorySource>("all");
const historySortMode = ref<HistorySortMode>("recent");
const historyRefreshing = ref(false);
const localLyricsOnlineMatchEnabled = ref(readLocalLyricsOnlineMatchEnabled());
const saveMatchedLyricsBesideAudio = ref(readSaveMatchedLyricsBesideAudio());
const useFilenameMetadataEnabled = ref(readUseFilenameMetadataEnabled());
const duplicateRecognitionMode = ref<DuplicateRecognitionMode>(readDuplicateRecognitionMode());
const localLibraryRoots = ref<string[]>([]);
const ignoredLocalFiles = ref<string[]>([]);
const duplicateFinderVisible = ref(false);
const duplicateRemovalPending = ref(false);
const selectedDuplicateTrackIds = ref(new Set<string>());
const localLibraryNetworkSearchEnabled = computed({
  get: () => localLyricsOnlineMatchEnabled.value,
  set: (enabled: boolean) => {
    localLyricsOnlineMatchEnabled.value = enabled;
  }
});
const localLyricsMatchPending = ref(false);
let localLyricsMatchRequestId = 0;
const localLyricsMatchNotice = ref("");
const selectedLocalTrackIds = ref(new Set<string>());
const localTrackContextMenu = ref<{ track: Track; queue: Track[]; x: number; y: number } | null>(null);
const trackPlaylistPicker = ref<{ tracks: Track[]; mode: TrackPlaylistPickerMode } | null>(null);
const localArtistSearchKeyword = ref("");
const localArtistSortMode = ref<"name-asc" | "name-desc" | "count-desc" | "count-asc">("name-asc");
const localArtistGenreFilter = ref("全部流派");
const selectedLocalArtist = ref<LocalArtist | null>(null);
const selectedLocalArtistLetter = ref("");
const keyword = ref("");
const streamingSearchInput = ref<HTMLInputElement | null>(null);
const streamingSearchFocused = ref(false);
const playlistOverviewKeyword = ref("");
const playlistOverviewDraggedId = ref<string | null>(null);
const playlistOverviewOrder = ref<string[]>(readPersistedPlaylistOverviewOrder());
const submittedKeyword = ref("");
const backendStatus = ref<"未连接" | "已连接" | "离线">("未连接");
const isPlaying = ref(false);
const taskbarThumbnailButtonsEnabled = ref(readTaskbarThumbnailButtonsEnabled());
const systemTrayEnabled = ref(readSystemTrayEnabled());
const desktopIntegrationPreferences = ref(readDesktopIntegrationPreferences(window.localStorage));
const launchAtStartup = ref(false);
const launchAtStartupPending = ref(false);
const globalShortcutsState = ref(true);
const globalShortcutsPending = ref(false);
const desktopIntegrationError = ref("");
const globalShortcutsEnabled = computed({
  get: () => globalShortcutsState.value,
  set: (enabled: boolean) => { void setGlobalShortcutsPreference(enabled); }
});
const taskbarThumbnailButtonsSupported = window.listenMusic?.isWindows === true;
const isPlaybackStarting = ref(false);
const progress = ref(0);
const volume = ref(72);
const playbackFadeEnabled = ref(readPlaybackFadeEnabled());
const playbackFadeDurationMs = ref(readPlaybackFadeDurationMs());
const sleepTimerPreset = ref<SleepTimerMinutes>(0);
const sleepTimerEndsAt = ref<number | null>(null);
const sleepTimerRemainingSeconds = ref(0);
const preferLocalDownloadPlayback = ref(readPreferLocalDownloadPlayback());
const initialPlaybackQualityPreferences = readPlaybackQualityPreferences(window.localStorage);
const neteasePlaybackQuality = ref<NeteasePlaybackQuality>(initialPlaybackQualityPreferences.netease);
const qqPlaybackQuality = ref<QqPlaybackQuality>(initialPlaybackQualityPreferences.qq);
const reloadCurrentTrackOnQualityChange = ref(initialPlaybackQualityPreferences.reloadCurrent);
const audioOutputPreferences = ref<AudioOutputPreferences>(readAudioOutputPreferences(window.localStorage));
const audioOutputDevices = ref<AudioOutputDevice[]>([
  { deviceId: "default", label: "系统默认", isDefault: true }
]);
const audioOutputSupported = ref(true);
const audioOutputError = ref("");
const currentTrack = ref<Track>(defaultTrack);
const remoteTracks = ref<Track[]>([]);
const remotePlaylists = ref<Playlist[]>([]);
const catalogResults = ref<Track[]>([]);
const homepageState = ref<"idle" | "loading" | "success" | "error">("idle");
const homepageError = ref("");
const homepageData = ref<HomepageData>({ banners: [], playlists: [], songs: [], hasMore: false });
const discoveryData = ref<HomepageData>({ banners: [], playlists: [], songs: [], hasMore: false });
const discoveryState = ref<"idle" | "loading" | "success" | "error">("idle");
const discoveryError = ref("");
const PLAYLIST_DISCOVERY_PAGE_SIZE = 30;
interface PlaylistDiscoveryProviderState {
  mode: "all" | "highquality";
  order: "hot" | "new";
  category: string;
  playlists: Playlist[];
  hotTags: string[];
  qualityTags: string[];
  categoryGroups: Record<string, string[]>;
  total: number;
  hasMore: boolean;
  page: number;
  status: "idle" | "loading" | "success" | "error";
  error: string;
}
function createPlaylistDiscoveryState(provider: AccountProvider): PlaylistDiscoveryProviderState {
  return {
    mode: "all",
    order: "hot",
    category: "全部",
    playlists: [],
    hotTags: provider === "netease"
      ? ["全部", "华语", "流行", "摇滚", "民谣", "电子", "另类/独立", "轻音乐", "综艺", "影视原声", "ACG"]
      : ["全部"],
    qualityTags: ["全部"],
    categoryGroups: {},
    total: 0,
    hasMore: true,
    page: 1,
    status: "idle",
    error: ""
  };
}
const playlistDiscoveryStates = reactive<Record<AccountProvider, PlaylistDiscoveryProviderState>>({
  netease: createPlaylistDiscoveryState("netease"),
  qq: createPlaylistDiscoveryState("qq")
});
const playlistDiscoveryPageCursors: Record<AccountProvider, Map<number, string | undefined>> = {
  netease: new Map([[1, undefined]]),
  qq: new Map([[1, undefined]])
};
const playlistDiscoveryRequestIds: Record<AccountProvider, number> = { netease: 0, qq: 0 };
const activePlaylistDiscovery = computed(() => playlistDiscoveryStates[streamingSource.value]);
const playlistDiscoveryMode = computed({ get: () => activePlaylistDiscovery.value.mode, set: (value: "all" | "highquality") => { activePlaylistDiscovery.value.mode = value; } });
const playlistDiscoveryOrder = computed({ get: () => activePlaylistDiscovery.value.order, set: (value: "hot" | "new") => { activePlaylistDiscovery.value.order = value; } });
const playlistDiscoveryCategory = computed({ get: () => activePlaylistDiscovery.value.category, set: (value: string) => { activePlaylistDiscovery.value.category = value; } });
const playlistDiscoveryPlaylists = computed(() => activePlaylistDiscovery.value.playlists);
const playlistDiscoveryHotTags = computed(() => activePlaylistDiscovery.value.hotTags);
const playlistDiscoveryQualityTags = computed(() => activePlaylistDiscovery.value.qualityTags);
const playlistDiscoveryCategoryGroups = computed(() => activePlaylistDiscovery.value.categoryGroups);
const playlistDiscoveryTotal = computed(() => activePlaylistDiscovery.value.total);
const playlistDiscoveryHasMore = computed(() => activePlaylistDiscovery.value.hasMore);
const playlistDiscoveryPage = computed(() => activePlaylistDiscovery.value.page);
const playlistDiscoveryState = computed(() => activePlaylistDiscovery.value.status);
const playlistDiscoveryError = computed(() => activePlaylistDiscovery.value.error);
const selectedPlaylist = ref<Playlist | null>(null);
const isStreamingDailyPlaylist = computed(() => selectedPlaylist.value?.id.startsWith("streaming-daily-") ?? false);
const isStreamingTemplatePlaylist = computed(() => isStreamingDailyPlaylist.value || selectedPlaylist.value?.streamingTemplate === true);
const selectedLocalAlbum = ref<LocalAlbum | null>(null);
const localAlbumSearchKeyword = ref("");
const localAlbumSortMode = ref<LocalAlbumSortMode>("default");
const localAlbumFilterOpen = ref(false);
const userPlaylists = ref<Playlist[]>(persistedLocalPlaylistState.playlists);
const localPlaylistTrackMap = ref<Record<string, Track[]>>(persistedLocalPlaylistState.tracks);
const playlistTrackOrder = ref<Record<string, string[]>>(readPersistedPlaylistTrackOrder());
const playlistCoverPaths = ref<Record<string, string>>(readPersistedPlaylistCoverPaths());
const playlistTrackDraggedKey = ref<string | null>(null);
const aggregatePlaylists = ref<AggregatePlaylist[]>(readAggregatePlaylists());

async function migrateLegacyAggregatePlaylists() {
  if (
    window.localStorage.getItem(LEGACY_AGGREGATE_PLAYLIST_MIGRATION_KEY) === "1"
    || !window.listenMusic?.getLegacyAggregatePlaylists
  ) {
    return;
  }
  try {
    const legacyPlaylists = await window.listenMusic.getLegacyAggregatePlaylists();
    const merged = mergeAggregatePlaylistCollections(aggregatePlaylists.value, legacyPlaylists);
    if (merged.length !== aggregatePlaylists.value.length) {
      aggregatePlaylists.value = merged;
      writeAggregatePlaylists(merged);
    }
    window.localStorage.setItem(LEGACY_AGGREGATE_PLAYLIST_MIGRATION_KEY, "1");
  } catch {
    // Leave the migration unmarked so a later startup can retry safely.
  }
}
const mainScrollElement = ref<HTMLElement | null>(null);
const playlistFilterOpen = ref(false);
const localToolMenuOpen = ref<"library" | "filter" | null>(null);
const localLibraryToolsRef = ref<HTMLElement | null>(null);
const playlistFilter = ref({
  folder: "全部",
  source: "全部"
});
const playlistNameDialogVisible = ref(false);
const playlistNameDialogMode = ref<"rename" | "create" | "streaming-create">("rename");
const playlistNameInput = ref("");
const playlistNameError = ref("");
const playlistNameSubmitting = ref(false);
const playlistState = ref<"idle" | "loading" | "success" | "error">("idle");
const playlistError = ref("");
const dailyRecommendationTracks = ref<Track[]>([]);
const dailyRecommendationState = ref<"idle" | "loading" | "success" | "error">("idle");
const dailyRecommendationError = ref("");
const accountFavoriteTracks = ref<Track[]>([]);
const accountPlaylists = ref<Playlist[]>([]);
const streamingPlaylistTargets = computed(() => accountPlaylists.value.filter(playlist => (
  playlist.source === streamingSource.value
  && playlist.accountScoped
  && playlist.createdByAccount
  && playlist.deletable
  && !playlist.favorite
)));
const playlistDeletionPending = ref(false);
const playlistMutationPending = ref(false);
const playlistOrderMessage = ref("");
const playlistOrderCooling = ref(false);
let playlistOrderCooldownTimer: ReturnType<typeof setTimeout> | undefined;
const selectedPlaylistBatchMode = computed<"favorites" | "playlist" | undefined>(() => {
  const playlist = selectedPlaylist.value;
  if ((playlist?.source !== "qq" && playlist?.source !== "netease") || !playlist.accountScoped) return undefined;
  if (playlist.favorite || playlist.id.startsWith("account-favorites-detail-")) return "favorites";
  return playlist.createdByAccount && playlist.deletable ? "playlist" : undefined;
});

async function deleteStreamingPlaylist(entry: { id: string }) {
  const playlist = accountPlaylists.value.find(item => item.id === entry.id);
  const provider = streamingSource.value;
  if (!playlist?.createdByAccount || !playlist.deletable || (provider !== 'qq' && provider !== 'netease') || playlistDeletionPending.value) return;
  const providerName = provider === 'qq' ? 'QQ 音乐' : '网易云音乐';
  if (!window.confirm(`删除歌单「${playlist.title}」？这会同步删除${providerName}中的该歌单，无法撤销。`)) return;
  playlistDeletionPending.value = true;
  try {
    await deleteAccountPlaylist(playlist.id, provider);
    if (streamingSource.value !== provider) return;
    accountPlaylists.value = accountPlaylists.value.filter(item => item.id !== playlist.id);
    if (selectedPlaylist.value?.id === playlist.id) selectedPlaylist.value = null;
  } catch (error) {
    scanError.value = accountContentErrorMessage(error, '删除歌单失败，请稍后重试。');
  } finally {
    playlistDeletionPending.value = false;
  }
}
const playlistCollectionPending = ref(false);
const selectedPlaylistAccountEntry = computed(() => {
  const playlistId = selectedPlaylist.value?.id;
  return playlistId
    ? accountPlaylists.value.find((playlist) => playlist.id === playlistId) ?? null
    : null;
});
const selectedPlaylistCollected = computed(() => (
  Boolean(selectedPlaylistAccountEntry.value && !selectedPlaylistAccountEntry.value.createdByAccount)
));
const selectedPlaylistCollectable = computed(() => {
  const playlist = selectedPlaylist.value;
  if (!playlist || appMode.value !== "streaming" || !playlist.streamingTemplate) return false;
  if (playlist.source !== "netease" && playlist.source !== "qq") return false;
  if (isStreamingDailyPlaylist.value || playlist.id.startsWith("account-favorites-detail-")) return false;
  return !playlist.createdByAccount && !selectedPlaylistAccountEntry.value?.createdByAccount;
});
const cloudTracks = ref<CloudTrackView[]>([]);
const cloudState = ref<"idle" | "loading" | "success" | "error">("idle");
const cloudUploading = ref(false);
const cloudError = ref("");
const accountProfile = ref<AccountProfileView | null>(null);
const accountFollowing = ref<AccountSocialUserView[]>([]);
const accountFollowers = ref<AccountSocialUserView[]>([]);
const accountSocialState = ref<"idle" | "loading" | "success" | "error">("idle");
const accountSocialError = ref("");
const accountSocialPage = ref(1);
const accountSocialHasMore = ref(false);
const selectedSocialProfile = ref<AccountProfileView | null>(null);
const selectedSocialProfileState = ref<"idle" | "loading" | "success" | "error">("idle");
const selectedSocialProfileError = ref("");
const accountRecentTracks = ref<Track[]>([]);
const accountListeningRank = ref<Track[]>([]);
const qqListeningRankPeriod = ref<QqListeningRankPeriod>("week");
const qqListeningRankPending = ref(false);
const qqListeningRankError = ref("");
const accountContentState = ref<"idle" | "loading" | "success" | "error">("idle");
const accountContentError = ref("");
const searchTab = ref<SearchTab>("song");
const searchPage = ref(1);
const searchTotal = ref(0);
const searchPlaylists = ref<Playlist[]>([]);
const searchArtists = ref<CatalogSearchArtist[]>([]);
const searchState = ref<"idle" | "loading" | "success" | "error">("idle");
const searchError = ref("");
const searchToast = ref("");
const SEARCH_PAGE_SIZE = 30;
const SEARCH_DEBOUNCE_MS = 500;
const selectedStreamingArtist = ref<CatalogSearchArtist | null>(null);
const streamingArtistDetail = ref<CatalogArtistDetail | null>(null);
const streamingArtistTracks = ref<Track[]>([]);
const streamingArtistAlbums = ref<CatalogArtistAlbum[]>([]);
const streamingArtistPlaylists = ref<Array<{ id: string; title: string; imageUrl?: string; count: number }>>([]);
const streamingArtistTracksOffset = ref(0);
const streamingArtistTracksTotal = ref(0);
const streamingArtistTracksHasMore = ref(false);
const streamingArtistTracksLoading = ref(false);
const streamingArtistAlbumsOffset = ref(0);
const streamingArtistAlbumsTotal = ref(0);
const streamingArtistAlbumsHasMore = ref(false);
const streamingArtistAlbumsLoading = ref(false);
const streamingArtistTab = ref<"songs" | "albums" | "playlists">("songs");
const streamingArtistState = ref<"idle" | "loading" | "success" | "error">("idle");
const streamingArtistError = ref("");
const streamingArtistFollowed = ref(false);
const streamingArtistFollowPending = ref(false);
let streamingArtistRequestId = 0;
const ACCOUNT_SOCIAL_PAGE_SIZE = 30;
const queuePanelVisible = ref(false);
const musicFolder = ref(readLocalLibraryDirectory());
const scanNotice = ref("");
const scanError = ref("");
const localLibraryScanPending = ref(false);
const localLibraryScanToastVisible = ref(false);
const autoScanLocalLibraryEnabled = ref(readAutoScanLocalLibraryEnabled());
let localLibraryScanToastTimer: number | undefined;
let removeTaskbarMediaActionListener: (() => void) | undefined;
let removeTrayMediaActionListener: (() => void) | undefined;
let removeDesktopLyricsActionListener: (() => void) | undefined;
let removeShortcutActionListener: (() => void) | undefined;
let removeShortcutsChangedListener: (() => void) | undefined;
let removeWindowCloseBehaviorListener: (() => void) | undefined;
let removeDesktopLyricsVisibilityListener: (() => void) | undefined;
let removeMiniPlayerActionListener: (() => void) | undefined;
let removeMiniModeVisibilityListener: (() => void) | undefined;
let miniSnapshotTimer: ReturnType<typeof window.setTimeout> | undefined;
const hasScannedLocalLibrary = ref(false);
const localLibraryHydrated = ref(false);
const audioElement = ref<HTMLAudioElement | null>(null);
let audioOutputController: AudioOutputController | undefined;
const currentTime = ref(0);
const mediaDuration = ref<number | undefined>();
const lyricLines = ref<LyricLine[]>([]);
const failedCoverIds = ref(new Set<string>());
const currentCoverFailedKey = ref("");
const currentCoverFallbackActive = ref(false);
const showSongDetail = ref(false);
const appearanceDarkMode = computed(() => resolveDarkTheme(
  appearancePreferences.value.themeMode,
  systemPrefersDark.value
));
watch(() => ({
  themeMode: appearancePreferences.value.themeMode,
  effectiveTheme: appearanceDarkMode.value ? "dark" : "light",
  lightAccent: appearancePreferences.value.lightAccent,
  darkAccent: appearancePreferences.value.darkAccent,
  density: appearancePreferences.value.density,
  fontFamily: appearancePreferences.value.fontFamily,
  backgroundMode: appearancePreferences.value.background.unified.mode,
  activeView: activeView.value
}), value => setDiagnosticContext(value), { immediate: true });
const appearanceReducedMotion = computed(() => resolveReducedMotion(
  appearancePreferences.value.animationMode,
  systemPrefersReducedMotion.value
));
const appearancePage = computed<AppearancePage>(() => {
  if (showSongDetail.value) return "player";
  if (activeView.value === "settings") return "settings";
  return appMode.value === "streaming" ? "streaming" : "local";
});
const activeAppearanceBackground = computed(() => resolvePageBackground(
  appearancePreferences.value,
  appearancePage.value
));
const hasConfiguredBackgroundImage = computed(() => (
  activeAppearanceBackground.value.mode === "image"
  && Boolean(activeAppearanceBackground.value.imagePath)
));
const windowTitlebarDark = computed(() => appearanceDarkMode.value
  && (!showSongDetail.value || hasConfiguredBackgroundImage.value));
const appearanceAccent = computed(() => appearanceDarkMode.value
  ? appearancePreferences.value.darkAccent
  : appearancePreferences.value.lightAccent);
const appearanceImageUrl = ref("");
const appearanceImageError = ref("");
watch(
  () => activeAppearanceBackground.value.mode === "image" ? activeAppearanceBackground.value.imagePath : "",
  async (imagePath, _previous, onCleanup) => {
    let cancelled = false;
    onCleanup(() => { cancelled = true; });
    appearanceImageUrl.value = "";
    appearanceImageError.value = "";
    if (!imagePath) return;
    try {
      const url = /^(data:|blob:|https?:)/i.test(imagePath)
        ? imagePath
        : await window.listenMusic?.readAppearanceBackground(imagePath);
      if (!url) {
        if (!cancelled) {
          appearanceImageError.value = "背景图片读取失败。请确认文件仍然存在；更新软件后请完全退出并重新启动。";
        }
        return;
      }
      if (cancelled) return;
      appearanceImageUrl.value = url;
      const image = new Image();
      image.src = url;
      await image.decode();
      if (!cancelled) {
        appearanceImageUrl.value = url;
        if (url !== imagePath && url.startsWith("tiaolv-background:")) {
          const backgrounds = appearancePreferences.value.background;
          for (const background of [backgrounds.unified, ...Object.values(backgrounds.pages)]) {
            if (background.imagePath === imagePath) background.imagePath = url;
          }
        }
      }
    } catch (error) {
      if (!cancelled) {
        appearanceImageUrl.value = "";
        appearanceImageError.value = error instanceof Error && error.name === "EncodingError"
          ? "背景图片无法解码，请检查图片是否完整。"
          : "背景图片读取失败。请确认文件仍然存在；更新软件后请完全退出并重新启动。";
      }
    }
  },
  { immediate: true }
);
const appearanceBackgroundImage = computed(() => {
  const imageUrl = appearanceImageUrl.value;
  if (!imageUrl) return "none";
  const safeUrl = imageUrl.replace(/["\r\n]/g, (character) => encodeURIComponent(character));
  const shade = appearanceDarkMode.value ? "rgba(8,10,14,.34)" : "rgba(255,255,255,.18)";
  return `linear-gradient(${shade}, ${shade}), url("${safeUrl}")`;
});
const appearanceClassNames = computed(() => [
  appearanceDarkMode.value ? "theme-dark" : "theme-light",
  `density-${appearancePreferences.value.density}`,
  {
    "animations-reduced": appearanceReducedMotion.value,
    "has-custom-background-image": hasConfiguredBackgroundImage.value,
    "lyrics-no-word-highlight": !appearancePreferences.value.lyrics.wordHighlight
  }
]);
const appearanceStyle = computed(() => {
  const lyrics = appearancePreferences.value.lyrics;
  const customLyricColors = lyrics.colorMode === "custom";
  return {
    "--appearance-accent": appearanceAccent.value,
    "--appearance-font-family": resolveAppearanceFont(appearancePreferences.value.fontFamily),
    "--app-page-background": appearanceDarkMode.value
      ? activeAppearanceBackground.value.darkColor
      : activeAppearanceBackground.value.lightColor,
    "--appearance-background-image": appearanceBackgroundImage.value,
    "--lyric-font-family": resolveAppearanceFont(lyrics.fontFamily === "inherit"
      ? appearancePreferences.value.fontFamily : lyrics.fontFamily),
    "--lyric-font-size": `${lyrics.fontSize}px`,
    "--lyric-font-weight": String(lyrics.fontWeight),
    "--lyric-line-height": String(lyrics.lineHeight),
    "--lyric-inactive-opacity": String(lyrics.inactiveOpacity),
    "--lyric-sweep-color": customLyricColors ? lyrics.sweepColor : "#2f9fc8",
    "--lyric-active-color": customLyricColors ? lyrics.activeColor : "#2f9fc8",
    "--lyric-inactive-color": customLyricColors
      ? lyrics.inactiveColor
      : appearanceDarkMode.value ? "#cbd4dc" : "#405d63"
  };
});
const miniPlayerVisible = ref(false);
const miniQueueVisible = ref(false);
const miniQueueShellOpen = ref(false);
const nativeMiniMode = ref(false);
const playerBarPointerNearby = ref(false);
const desktopLyricsVisible = ref(false);
const detailLyricsRef = ref<HTMLElement | null>(null);
const manualLyricsScroll = ref(false);
const lyricAnchorVisible = ref(false);
const lyricsDragging = ref(false);
const playMode = ref<PlayMode>("sequence");
const systemTrayState = computed(() => ({
  title: currentTrack.value.title,
  artist: currentTrack.value.artist,
  isPlaying: isPlaying.value,
  liked: currentTrack.value.liked,
  playMode: playMode.value,
  desktopLyricsVisible: desktopLyricsVisible.value,
  miniPlayerVisible: miniPlayerVisible.value || nativeMiniMode.value
}));
const playbackQueue = ref<Track[]>([]);
const privateRoamingCurrentIndex = computed(() => privateRoamingTracks.value.findIndex((track) => track.id === currentTrack.value.id));
const privateRoamingBufferedCount = computed(() => {
  const index = privateRoamingCurrentIndex.value;
  return index < 0 ? privateRoamingTracks.value.length : Math.max(0, privateRoamingTracks.value.length - index - 1);
});
const currentQueueDisplayIndex = computed(() => {
  const index = findCurrentQueueIndex();
  return index >= 0 ? index + 1 : 0;
});
const draggedQueueKey = ref<string | null>(null);
const favoriteTracks = ref<Track[]>([]);
const historyTracks = ref<Track[]>([]);
const listeningStats = ref<ListeningStatsState>(readListeningStats());
const listeningCalendarMonth = ref(new Date());
const selectedListeningDateKey = ref(toLocalDateKey(new Date()));
const navigationHistory = ref<NavigationEntry[]>([{ view: "home" }]);
const navigationIndex = ref(0);
const pageTransitionDirection = ref<"fade" | "forward" | "backward">("fade");
const pageTransitionName = computed(() => pageTransitionDirection.value === "forward"
  ? "app-page-slide-forward"
  : pageTransitionDirection.value === "backward" ? "app-page-slide-backward" : "app-page");
let resumeLyricsFollowTimer: ReturnType<typeof window.setTimeout> | undefined;
let lyricAnchorHideTimer: ReturnType<typeof window.setTimeout> | undefined;
let lyricDragPointerId: number | undefined;
let lyricResizeFrame: number | undefined;
let lyricAutoScrollFrame: number | undefined;
let lyricAnchorScrollFrame: number | undefined;
let lyricAutoScrollActive = false;
let lyricDragStartY = 0;
let lyricDragStartScrollTop = 0;
let playbackFrameId: number | undefined;
let pendingSeekTime: number | undefined;
let qualityReloadToken = 0;
const localAudioGroups = ref<LocalAudioSourceGroup[]>([]);
const localAudioSelection = ref<LocalAudioSelection>({ provider: "local", quality: "local" });
const localAudioOverride = ref("");
const localAudioOwnerId = ref("");
const localSourceBusy = ref(false);
const localSourceSession = ref(0);
const localSourceNotice = ref("");
let localSourceAbort: AbortController | undefined;
let localMatchRequest = 0;
const localAudioMatchCache = new Map<string, { expires: number; groups: LocalAudioSourceGroup[] }>();
const hasLocalAudioSources = computed(() => currentTrack.value.source === "local" && Boolean(currentTrack.value.audioUrl));
let isQualityReloading = false;
const isSeeking = ref(false);
let wasPlayingBeforeSeek = false;
let searchRequestId = 0;
let searchDebounceTimer: ReturnType<typeof window.setTimeout> | undefined;
let searchToastTimer: ReturnType<typeof window.setTimeout> | undefined;
const favoriteMutationPending = new Set<string>();
let lyricClockTime = 0;
let lastDesktopLyricsTimeSentAt = 0;
let lastMiniPlayerTimeSentAt = 0;
let renderedLyricIndex = -1;
let renderedCharacterCount = 0;
let renderedCharacterProgress = 0;
let renderedCharacterElements: HTMLElement[] = [];
let renderedProgressCharacter: HTMLElement | undefined;
let renderedSongInfoLineIndex = -1;
let renderedSongInfoCharacterCount = 0;
let renderedSongInfoLineElements: HTMLElement[][] = [];
let playbackStateSaveTimer: ReturnType<typeof window.setTimeout> | undefined;
let sleepTimerTimeout: ReturnType<typeof window.setTimeout> | undefined;
let sleepTimerInterval: ReturnType<typeof window.setInterval> | undefined;
let listeningStatsSaveTimer: ReturnType<typeof window.setTimeout> | undefined;
let listeningStatsSaveChain: Promise<void> = Promise.resolve();
let listeningStatsSyncPromise: Promise<void> | undefined;
let listeningSampleTrackId: string | undefined;
let listeningSampleTime: number | undefined;
let listeningScrobbleSession: ListeningScrobbleSession | undefined;
let listeningScrobbleSessionSerial = 0;
let qqListeningSessionSerial = 0;
let activeQqListeningSessionId: number | undefined;
let qqRecentPlaybackSession: QqListeningSession | undefined;
const qqListeningSessions = new Map<number, QqListeningSession>();
const qqListeningFlushes = new Map<number, Promise<void>>();
let qqListeningRetryTimer: ReturnType<typeof window.setTimeout> | undefined;
let lastPlaybackStateSaveSecond = -Infinity;
let sessionRestored = false;
let queueSaveChain: Promise<void> = Promise.resolve();
let queueItemSerial = 0;
let stateSaveChain: Promise<void> = Promise.resolve();
let accountContentRequestId = 0;
let accountRecentRevision = 0;
let accountSocialRequestId = 0;
let socialProfileRequestId = 0;
let streamingHomeRequestId = 0;
let qqHomeRankingRequestId = 0;
let streamingRadarRequestId = 0;
let privateRoamingRequestId = 0;
const lyricAnchorIndex = ref(-1);
const prefaceAnchorActive = ref(false);
const prefaceAnchorLineIndex = ref(-1);
const lyricStartSpacerHeight = ref(0);
const lyricEndSpacerHeight = ref(0);
let lastAutoFollowItemId = "";
const playbackClock = createPlaybackClock();

function orderedPlaylistTracksForCover(playlistId: string, tracks: Track[]) {
  return applyTrackOrder(tracks, playlistTrackOrder.value[playlistId] ?? []);
}

function playlistWithDefaultCover(playlist: Playlist, tracks: Track[]) {
  const orderedTracks = orderedPlaylistTracksForCover(playlist.id, tracks);
  return {
    ...playlist,
    imageUrl: resolvePlaylistCover(
      playlist,
      orderedTracks,
      playlistCoverPaths.value[playlist.id],
      resolveBackendUrl
    )
  };
}

const allPlaylists = computed(() => [
  playlistWithDefaultCover(
    { ...demoPlaylists.find((playlist) => playlist.id === "favorites")!, count: favoriteTracks.value.length },
    favoriteTracks.value
  ),
  playlistWithDefaultCover(
    { ...demoPlaylists.find((playlist) => playlist.id === "local")!, count: remoteTracks.value.length },
    remoteTracks.value
  ),
  ...userPlaylists.value.map((playlist) => playlistWithDefaultCover({
    ...playlist,
    count: localPlaylistTrackMap.value[playlist.id]?.length ?? playlist.count
  }, localPlaylistTrackMap.value[playlist.id] ?? [])),
  ...remotePlaylists.value
]);
const playlistOverviewSource = computed(() => [
  playlistWithDefaultCover(
    { ...demoPlaylists.find((playlist) => playlist.id === "favorites")!, count: favoriteTracks.value.length },
    favoriteTracks.value
  ),
  ...userPlaylists.value.map((playlist) => playlistWithDefaultCover({
    ...playlist,
    count: localPlaylistTrackMap.value[playlist.id]?.length ?? playlist.count
  }, localPlaylistTrackMap.value[playlist.id] ?? []))
]);
const playlistOverviewPlaylists = computed(() => {
  const query = playlistOverviewKeyword.value.trim().toLowerCase();
  const orderedIds = new Map(playlistOverviewOrder.value.map((id, index) => [id, index]));
  return playlistOverviewSource.value
    .map((playlist, index) => ({ playlist, index }))
    .filter(({ playlist }) => {
      if (!query) {
        return true;
      }
      return `${playlist.title} ${playlist.subtitle}`.toLowerCase().includes(query);
    })
    .sort((left, right) => {
      const leftOrder = orderedIds.has(left.playlist.id) ? orderedIds.get(left.playlist.id)! : Number.MAX_SAFE_INTEGER;
      const rightOrder = orderedIds.has(right.playlist.id) ? orderedIds.get(right.playlist.id)! : Number.MAX_SAFE_INTEGER;
      return leftOrder === rightOrder ? left.index - right.index : leftOrder - rightOrder;
    })
    .map(({ playlist }) => playlist);
});
const homepagePlaylists = computed(() => homepageData.value.playlists);
const homepageSongs = computed(() => homepageData.value.songs);
const localHomeTrack = computed(() => {
  if (currentTrack.value.id !== DEFAULT_TRACK_ID) {
    return currentTrack.value;
  }
  return historyTracks.value[0] ?? currentLibrary.value[0] ?? defaultTrack;
});
const localHomeProgress = computed(() => {
  return localHomeTrack.value.id === currentTrack.value.id ? progress.value : 0;
});
const localHomeCurrentTime = computed(() => {
  return localHomeTrack.value.id === currentTrack.value.id ? currentTime.value : 0;
});
const localHomeDuration = computed(() => {
  return localHomeTrack.value.id === currentTrack.value.id
    ? playbackDuration.value
    : localHomeTrack.value.duration;
});
const localHomeCoverUrl = computed(() => {
  if (localHomeTrack.value.id === currentTrack.value.id) {
    return currentCoverUrl.value;
  }
  return resolveBackendUrl(localHomeTrack.value.coverUrl);
});
const localHomeDateLabel = computed(() => {
  const now = new Date();
  const weekdays = ["日", "一", "二", "三", "四", "五", "六"];
  return `${now.getMonth() + 1}月${now.getDate()}日 · 周${weekdays[now.getDay()]}`;
});
const localHomeGreeting = computed(() => {
  const hour = new Date().getHours();
  if (hour < 6) {
    return "夜深了";
  }
  if (hour < 12) {
    return "早上好";
  }
  if (hour < 18) {
    return "下午好";
  }
  return "晚上好";
});
const localHomeTrackFormat = computed(() => {
  return getLocalTrackFormat(localHomeTrack.value);
});
function getLocalTrackFormat(track: Track) {
  if (track.source === "netease") {
    return "在线音乐";
  }
  const path = track.filePath ?? track.audioUrl ?? "";
  const match = path.match(/\.([a-z0-9]+)(?:$|[?#])/i);
  return match ? match[1].toUpperCase() : "本地音频";
}

function localTrackAudioInfo(track: Track) {
  const parts = [
    track.codec?.trim() || getLocalTrackFormat(track),
    track.sampleRate ? `${Math.round(track.sampleRate / 1000)} kHz` : "",
    track.bitDepth ? `${track.bitDepth} bit` : ""
  ].filter(Boolean);
  return parts.join("・");
}

function requestedPlaybackQuality(track: Track) {
  return track.source === "qq" || track.source === "qqmusic"
    ? qqPlaybackQuality.value
    : neteasePlaybackQuality.value;
}

const currentPlaybackQualitySource = computed(() => playbackQualitySource(currentTrack.value));
const currentPlaybackQualityOptions = computed(() => {
  if (currentPlaybackQualitySource.value === "netease") {
    return NETEASE_QUALITY_OPTIONS;
  }
  if (currentPlaybackQualitySource.value === "qq") {
    return QQ_QUALITY_OPTIONS;
  }
  return [];
});
const currentPlaybackQualityValue = computed(() => {
  if (currentPlaybackQualitySource.value === "netease") {
    return neteasePlaybackQuality.value;
  }
  if (currentPlaybackQualitySource.value === "qq") {
    return qqPlaybackQuality.value;
  }
  return "local";
});
const currentPlaybackQualityLabel = computed(() => {
  if (currentPlaybackQualitySource.value === "local") {
    return localPlaybackFormat(currentTrack.value);
  }
  return currentPlaybackQualityOptions.value.find(
    (option) => option.value === currentPlaybackQualityValue.value
  )?.label ?? "自动";
});

function getArtistIndexLetter(name: string) {
  const matched = name.trim().match(/[A-Za-z]/u);
  return matched ? matched[0].toUpperCase() : "";
}

const localLibraryStats = computed(() => {
  const tracks = currentLibrary.value;
  const albums = new Set(tracks.map((track) => track.album.trim()).filter(Boolean));
  const artists = new Set(tracks.map((track) => track.artist.trim()).filter(Boolean));
  const totalDurationSeconds = tracks.reduce((total, track) => total + Math.max(0, track.duration || 0), 0);
  const totalMinutes = Math.max(1, Math.round(totalDurationSeconds / 60));
  return [
    { value: tracks.length, label: "首歌曲" },
    { value: albums.size, label: "张专辑" },
    { value: artists.size, label: "位艺术家" },
    { value: `${totalMinutes} 分钟`, label: "喜欢总时长" }
  ];
});
const localRecentlyAddedTracks = computed(() => {
  return currentLibrary.value
    .map((track, index) => ({
      track,
      index,
      time: Date.parse(track.createdAt ?? track.updatedAt ?? "")
    }))
    .sort((left, right) => {
      const leftTime = Number.isFinite(left.time) ? left.time : 0;
      const rightTime = Number.isFinite(right.time) ? right.time : 0;
      if (rightTime !== leftTime) {
        return rightTime - leftTime;
      }
      return left.index - right.index;
    })
    .slice(0, 6)
    .map((item) => item.track);
});
const isLocalHomeCurrentTrack = computed(() => localHomeTrack.value.id === currentTrack.value.id);
const localHomeTrackLabel = computed(() => {
  if (localHomeTrack.value.id === DEFAULT_TRACK_ID) {
    return "还没有播放记录";
  }
  return localHomeTrack.value.title;
});
const canGoBack = computed(() => navigationIndex.value > 0);
const canGoForward = computed(() => navigationIndex.value < navigationHistory.value.length - 1);
const isLocalMode = computed(() => appMode.value === "local");
const isStreamingMode = computed(() => appMode.value === "streaming");
const availableAggregateSources = computed(() => {
  const providers = accounts.value.map((candidate) => normalizedAggregateSource(candidate.provider));
  return [...new Set(["local", ...providers])];
});
const hasLocalLibraryContent = computed(() => remoteTracks.value.length > 0);
const shouldShowLocalEmptyRoom = computed(() => (
  isLocalMode.value
  && activeView.value === "home"
  && !submittedKeyword.value
  && localLibraryHydrated.value
  && !hasLocalLibraryContent.value
));
const shouldHidePlayerBar = computed(() => (
  shouldShowLocalEmptyRoom.value
  || activeView.value === "settings"
  || appearancePreferences.value.playerControls.visibility === "hidden"
  || (
    appearancePreferences.value.playerControls.visibility === "hover"
    && !playerBarPointerNearby.value
  )
  || (
    appMode.value === "streaming"
    && streamingSource.value === "netease"
    && !account.value
  )
));
const accountFavoritePlaylist = computed<Playlist>(() => ({
  id: "account-favorites",
  title: "我喜欢的音乐",
  subtitle: `${streamingProviderName.value}喜欢`,
  count: accountFavoriteTracks.value.length,
  primary: "#c899b8",
  secondary: "#765d92",
  mark: "爱",
  source: selectedStreamingAccount.value?.provider || streamingSource.value,
  accountScoped: true,
  favorite: true
}));
const accountLibraryPlaylists = computed<Playlist[]>(() => {
  const playlists = accountPlaylists.value;
  if (streamingSource.value !== "qq" || !selectedStreamingAccount.value || playlists.some(playlist => playlist.favorite)) return playlists;
  return [{
    ...accountFavoritePlaylist.value,
    title: "我的喜欢",
    imageUrl: accountFavoriteTracks.value[0]?.coverUrl,
    createdByAccount: true,
    deletable: false,
    streamingTemplate: true
  }, ...playlists];
});
const sidebarPlaylists = computed(() => (
  isStreamingMode.value
    ? [accountFavoritePlaylist.value, ...accountPlaylists.value]
    : allPlaylists.value
).slice(0, 5));
const discoveryPlaylists = computed(() => discoveryData.value.playlists);
const discoverySongs = computed(() => discoveryData.value.songs);
const isBackendConnected = computed(() => backendStatus.value === "已连接");
const currentLibrary = computed(() => {
  if (remoteTracks.value.length > 0) {
    return remoteTracks.value;
  }
  return hasScannedLocalLibrary.value ? [] : demoTracks;
});

function normalizeDuplicateMetadata(value: string) {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

function isUsableDuplicateMetadata(value: string, kind: "title" | "artist") {
  const normalized = normalizeDuplicateMetadata(value);
  const placeholders = kind === "artist"
    ? new Set(["未知歌手", "未知艺术家", "unknown artist", "unknown"])
    : new Set(["未知歌曲", "未知标题", "unknown title", "unknown"]);
  return Boolean(normalized) && !placeholders.has(normalized) && !normalized.includes("�");
}

const localDuplicateGroups = computed<LocalDuplicateGroup[]>(() => {
  const groups = new Map<string, Track[]>();
  currentLibrary.value
    .filter((track) => isLocalLibraryTrack(track))
    .filter((track) => (
      isUsableDuplicateMetadata(track.title, "title")
      && isUsableDuplicateMetadata(track.artist, "artist")
    ))
    .forEach((track) => {
      const key = `${normalizeDuplicateMetadata(track.title)}\u0000${normalizeDuplicateMetadata(track.artist)}`;
      groups.set(key, [...(groups.get(key) ?? []), track]);
    });
  return Array.from(groups.entries())
    .filter(([, tracks]) => tracks.length > 1)
    .map(([key, tracks]) => ({
      key,
      title: tracks[0].title,
      artist: tracks[0].artist,
      tracks
    }))
    .sort((left, right) => right.tracks.length - left.tracks.length || left.title.localeCompare(right.title, "zh-Hans-CN"));
});

const duplicateTrackIds = computed(() => duplicateRecognitionMode.value === "metadata"
  ? new Set(localDuplicateGroups.value.flatMap((group) => group.tracks.map((track) => track.id)))
  : new Set<string>()
);

function getTrackFolderPath(track: Track) {
  const fallback = musicFolder.value.trim() || "未知文件夹";
  if (!track.filePath?.trim()) return fallback;
  const normalized = track.filePath.replace(/\//g, "\\").replace(/\\+$/, "");
  const separatorIndex = normalized.lastIndexOf("\\");
  return separatorIndex > 0 ? normalized.slice(0, separatorIndex) : fallback;
}

function getLocalFolderName(path: string) {
  const normalized = path.replace(/[\\/]+$/, "");
  return normalized.split(/[\\/]/).filter(Boolean).at(-1) || "未知文件夹";
}

const localFolders = computed<LocalFolder[]>(() => {
  const folderMap = new Map<string, Track[]>();
  currentLibrary.value
    .filter((track) => isLocalLibraryTrack(track))
    .forEach((track) => {
      const path = getTrackFolderPath(track);
      folderMap.set(path, [...(folderMap.get(path) ?? []), track]);
    });

  return Array.from(folderMap.entries())
    .map(([path, tracks]) => {
      const name = getLocalFolderName(path);
      const coverTrack = tracks.find((track) => Boolean(track.coverUrl)) ?? tracks[0];
      return {
        id: `local-folder:${path.toLocaleLowerCase()}`,
        path,
        name,
        tracks,
        coverUrl: coverTrack?.coverUrl,
        coverTrack,
        primary: coverTrack?.primary ?? "#b8c9d0",
        secondary: coverTrack?.secondary ?? "#7e9199",
        mark: name.slice(0, 1) || "文"
      };
    })
    .sort((left, right) => left.name.localeCompare(right.name, "zh-Hans-CN"));
});
const selectedLocalFolder = computed(() => (
  localFolders.value.find((folder) => folder.path === selectedLocalFolderPath.value) ?? null
));
const filteredLocalFolders = computed(() => {
  const query = localFolderSearchKeyword.value.trim().toLocaleLowerCase();
  if (!query) return localFolders.value;
  return localFolders.value.filter((folder) => [
    folder.name,
    folder.path,
    ...folder.tracks.map((track) => `${track.title} ${track.artist} ${track.album} ${track.filePath ?? ""}`)
  ].join(" ").toLocaleLowerCase().includes(query));
});
const localAlbums = computed<LocalAlbum[]>(() => {
  const albumMap = new Map<string, Track[]>();
  currentLibrary.value
    .filter((track) => isLocalLibraryTrack(track))
    .forEach((track) => {
      const albumTitle = track.album.trim() || "未知专辑";
      albumMap.set(albumTitle, [...(albumMap.get(albumTitle) ?? []), track]);
    });

  return Array.from(albumMap.entries())
    .map(([title, tracks]) => {
      const artists = Array.from(new Set(
        tracks
          .map((track) => track.artist.trim())
          .filter(Boolean)
      ));
      const coverTrack = tracks.find((track) => Boolean(track.coverUrl)) ?? tracks[0];
      return {
        id: `local-album:${title}`,
        title,
        artistText: artists.join("/") || "未知艺术家",
        coverUrl: coverTrack?.coverUrl,
        primary: coverTrack?.primary ?? "#a8c7d4",
        secondary: coverTrack?.secondary ?? "#6d789c",
        mark: title.slice(0, 1),
        tracks
      };
    })
    .sort((left, right) => {
      const leftUpdated = Math.max(...left.tracks.map((track) => Date.parse(track.updatedAt ?? track.createdAt ?? "") || 0));
      const rightUpdated = Math.max(...right.tracks.map((track) => Date.parse(track.updatedAt ?? track.createdAt ?? "") || 0));
      if (rightUpdated !== leftUpdated) {
        return rightUpdated - leftUpdated;
      }
      return left.title.localeCompare(right.title, "zh-Hans-CN");
    });
});
const localFeaturedAlbums = computed(() => localAlbums.value.slice(0, 2));
const selectedLocalAlbumSummary = computed(() => {
  const tracks = selectedLocalAlbum.value?.tracks ?? [];
  const totalSeconds = tracks.reduce((total, track) => total + Math.max(0, Number(track.duration) || 0), 0);
  const totalMinutes = tracks.length > 0 ? Math.max(1, Math.ceil(totalSeconds / 60)) : 0;
  return `${tracks.length} 首 · ${totalMinutes} 分钟`;
});
const filteredLocalAlbumTracks = computed(() => {
  const query = localAlbumSearchKeyword.value.trim().toLocaleLowerCase();
  const tracks = [...(selectedLocalAlbum.value?.tracks ?? [])].filter((track) => (
    !query || `${track.title} ${track.artist} ${track.album} ${track.filePath ?? ""}`.toLocaleLowerCase().includes(query)
  ));
  if (localAlbumSortMode.value === "title") {
    return tracks.sort((left, right) => left.title.localeCompare(right.title, "zh-Hans-CN"));
  }
  if (localAlbumSortMode.value === "duration") {
    return tracks.sort((left, right) => left.duration - right.duration);
  }
  return tracks;
});
const filteredLocalLibraryTracks = computed(() => {
  const query = localLibrarySearchKeyword.value.trim().toLocaleLowerCase();
  if (!query) {
    return currentLibrary.value;
  }
  return currentLibrary.value.filter((track) => {
    const folder = track.filePath ?? "";
    return `${track.title} ${track.artist} ${track.album} ${folder}`.toLocaleLowerCase().includes(query);
  });
});

function getHistoryTrackSource(track: Track): HistorySource {
  const source = (track.source || "local").toLocaleLowerCase();
  if (source === "netease" || source === "ncm") {
    return "netease";
  }
  if (source === "qq" || source === "qqmusic") {
    return "qq";
  }
  return "local";
}

const historySourceTracks = computed(() => {
  if (historySourceFilter.value === "all") {
    return historyTracks.value;
  }
  return historyTracks.value.filter(
    (track) => getHistoryTrackSource(track) === historySourceFilter.value
  );
});
const historySourceName = computed(() => (
  historySourceOptions.find((source) => source.value === historySourceFilter.value)?.label ?? "全部"
));

const filteredHistoryTracks = computed(() => {
  const query = historySearchKeyword.value.trim().toLocaleLowerCase();
  const tracks = historySourceTracks.value.filter((track) => {
    if (!query) {
      return true;
    }
    return `${track.title} ${track.artist} ${track.album} ${track.filePath ?? ""}`
      .toLocaleLowerCase()
      .includes(query);
  });

  if (historySortMode.value === "oldest") {
    return [...tracks].reverse();
  }
  if (historySortMode.value === "title") {
    return [...tracks].sort((left, right) => left.title.localeCompare(right.title, "zh-Hans-CN"));
  }
  return tracks;
});

const historyTrackSummary = computed(() => {
  const totalSeconds = filteredHistoryTracks.value.reduce(
    (total, track) => total + Math.max(0, Number(track.duration) || 0),
    0
  );
  const totalMinutes = totalSeconds > 0 ? Math.ceil(totalSeconds / 60) : 0;
  return `${filteredHistoryTracks.value.length} 首 · 总时长 ${totalMinutes} 分钟`;
});

const artistAlphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const localArtists = computed<LocalArtist[]>(() => {
  const artistMap = new Map<string, Track[]>();
  currentLibrary.value
    .filter((track) => isLocalLibraryTrack(track))
    .forEach((track) => {
      const artistName = track.artist.trim() || "未知艺术家";
      artistMap.set(artistName, [...(artistMap.get(artistName) ?? []), track]);
    });

  return Array.from(artistMap.entries()).map(([name, tracks]) => {
    const coverTrack = tracks.find((track) => Boolean(track.coverUrl)) ?? tracks[0];
    const albums = localAlbums.value.filter((album) => album.tracks.some((track) => tracks.some((item) => item.id === track.id)));
    const genres = Array.from(new Set(tracks.map((track) => track.genre?.trim()).filter((genre): genre is string => Boolean(genre))));
    return {
      id: `local-artist:${name}`,
      name,
      trackCount: tracks.length,
      tracks,
      albums,
      genres,
      coverUrl: coverTrack?.coverUrl,
      primary: coverTrack?.primary ?? "#a8c7d4",
      secondary: coverTrack?.secondary ?? "#6d789c",
      mark: name.slice(0, 1),
      letter: getArtistIndexLetter(name)
    };
  });
});
const localArtistGenres = computed(() => {
  const genres = Array.from(new Set(localArtists.value.flatMap((artist) => artist.genres))).sort((left, right) => left.localeCompare(right, "zh-Hans-CN"));
  return ["全部流派", ...genres];
});
const filteredLocalArtists = computed(() => {
  const query = localArtistSearchKeyword.value.trim().toLocaleLowerCase();
  const genre = localArtistGenreFilter.value;
  const filtered = localArtists.value.filter((artist) => {
    const matchesGenre = genre === "全部流派" || artist.genres.includes(genre);
    const matchesQuery = !query || [
      artist.name,
      ...artist.tracks.map((track) => `${track.title} ${track.artist} ${track.album} ${track.filePath ?? ""}`)
    ].join(" ").toLocaleLowerCase().includes(query);
    return matchesGenre && matchesQuery;
  });
  return [...filtered].sort((left, right) => {
    if (localArtistSortMode.value === "name-desc") {
      return right.name.localeCompare(left.name, "zh-Hans-CN");
    }
    if (localArtistSortMode.value === "count-desc") {
      return right.trackCount - left.trackCount || left.name.localeCompare(right.name, "zh-Hans-CN");
    }
    if (localArtistSortMode.value === "count-asc") {
      return left.trackCount - right.trackCount || left.name.localeCompare(right.name, "zh-Hans-CN");
    }
    return left.name.localeCompare(right.name, "zh-Hans-CN");
  });
});
const artistAlphabetIndex = computed(() => artistAlphabet.map((letter) => ({
  letter,
  enabled: filteredLocalArtists.value.some((artist) => artist.letter === letter)
})));
const localArtistGroups = computed(() => {
  return artistAlphabet
    .map((letter) => ({
      letter,
      artists: filteredLocalArtists.value.filter((artist) => artist.letter === letter)
    }))
    .filter((group) => group.artists.length > 0);
});
const localArtistAlbums = computed(() => selectedLocalArtist.value?.albums ?? []);
const localTopListeningTracks = computed(() => {
  const rows = currentLibrary.value
    .filter((track) => isLocalLibraryTrack(track))
    .map((track) => {
      const stat = listeningStats.value.tracks[track.id];
      return {
        track,
        playCount: stat?.playCount ?? 0,
        listenedSeconds: stat?.listenedSeconds ?? 0,
        listenedMinutes: getTrackListeningMinutes(listeningStats.value, track.id)
      };
    })
    .filter((item) => item.playCount > 0 || item.listenedSeconds > 0)
    .sort((left, right) => {
      if (right.listenedSeconds !== left.listenedSeconds) {
        return right.listenedSeconds - left.listenedSeconds;
      }
      return right.playCount - left.playCount;
    })
    .slice(0, 5);
  const maxSeconds = Math.max(1, ...rows.map((item) => item.listenedSeconds));
  return rows.map((item) => ({
    ...item,
    percent: Math.max(8, Math.round((item.listenedSeconds / maxSeconds) * 100))
  }));
});
const listeningCalendarTitle = computed(() => {
  const month = listeningCalendarMonth.value;
  return `${month.getFullYear()}年${month.getMonth() + 1}月`;
});
const listeningCalendarDays = computed(() => {
  const month = listeningCalendarMonth.value;
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const dayCount = new Date(year, monthIndex + 1, 0).getDate();
  const leadingBlankCount = (new Date(year, monthIndex, 1).getDay() + 6) % 7;
  const monthKeys = Array.from({ length: dayCount }, (_, index) => toLocalDateKey(new Date(year, monthIndex, index + 1)));
  const maxSeconds = Math.max(1, ...monthKeys.map((key) => listeningStats.value.days[key]?.listenedSeconds ?? 0));
  return [
    ...Array.from({ length: leadingBlankCount }, (_, index) => ({
      key: `blank-${year}-${monthIndex}-${index}`,
      day: "",
      dateKey: "",
      minutes: 0,
      intensity: 0,
      isSelected: false
    })),
    ...monthKeys.map((dateKey, index) => {
      const seconds = listeningStats.value.days[dateKey]?.listenedSeconds ?? 0;
      return {
        key: dateKey,
        day: `${index + 1}`,
        dateKey,
        minutes: secondsToDisplayMinutes(seconds),
        intensity: getCalendarIntensity(seconds, maxSeconds),
        isSelected: selectedListeningDateKey.value === dateKey
      };
    })
  ];
});
const listeningMonthSummary = computed(() => {
  const month = listeningCalendarMonth.value;
  return getMonthListeningSummary(listeningStats.value, month.getFullYear(), month.getMonth());
});
const selectedListeningDaySummary = computed(() => {
  const day = listeningStats.value.days[selectedListeningDateKey.value];
  return secondsToDisplayMinutes(day?.listenedSeconds ?? 0);
});
function trackCoverKey(track: Track) {
  return `${track.source ?? "local"}:${track.id}`;
}

const currentCoverUrl = computed(() => {
  const track = currentTrack.value;
  if (currentCoverFailedKey.value === trackCoverKey(track)) {
    return "";
  }
  const coverUrl = currentCoverFallbackActive.value
    ? track.coverFallbackUrl
    : track.coverUrl;
  return resolveBackendUrl(coverUrl);
});

const coverPaletteCache = new Map<string, CoverPalette>();
const songDetailPalette = ref(createSoftCoverPalette(defaultTrack.primary, defaultTrack.secondary));
let songDetailPaletteRequestId = 0;
const songDetailThemeStyle = computed(() => {
  if (appearancePreferences.value.coverThemeEnabled) {
    return {
      "--detail-ambient-start": songDetailPalette.value.pageStart,
      "--detail-ambient-end": songDetailPalette.value.pageEnd,
      "--detail-player-start": songDetailPalette.value.playerStart,
      "--detail-player-end": songDetailPalette.value.playerEnd,
      "--player-accent": songDetailPalette.value.accentPrimary,
      "--player-accent-hover": songDetailPalette.value.accentSecondary
    };
  }
  const palette = createSoftCoverPalette("#dce3ea", "#8795a6");
  return {
    "--detail-ambient-start": palette.pageStart,
    "--detail-ambient-end": palette.pageEnd,
    "--detail-player-start": palette.playerStart,
    "--detail-player-end": palette.playerEnd,
    "--player-accent": palette.accentPrimary,
    "--player-accent-hover": palette.accentSecondary
  };
});
const desktopLyricsPlaybackMetadata = computed<Omit<DesktopLyricsPlaybackState, "currentTime">>(() => ({
  trackId: currentTrack.value.id,
  title: currentTrack.value.title,
  artist: currentTrack.value.artist,
  isPlaying: isPlaying.value,
  playMode: playMode.value,
  lyrics: currentTrack.value.lyrics,
  lyricsTranslation: currentTrack.value.lyricsTranslation,
  lyricsPhonetic: currentTrack.value.lyricsPhonetic,
  lyricsFormat: currentTrack.value.lyricsFormat,
  source: currentTrack.value.source,
  coverAccentColor: songDetailPalette.value.accentPrimary
}));
const desktopLyricsPlaybackState = computed<DesktopLyricsPlaybackState>(() => ({
  ...desktopLyricsPlaybackMetadata.value,
  currentTime: currentTime.value
}));

watch(
  [currentCoverUrl, () => currentTrack.value.primary, () => currentTrack.value.secondary],
  async ([coverUrl, primary, secondary]) => {
    const requestId = ++songDetailPaletteRequestId;

    const fallbackPalette = createSoftCoverPalette(String(primary), String(secondary));
    if (!coverUrl) {
      songDetailPalette.value = fallbackPalette;
      return;
    }

    const cachedPalette = coverPaletteCache.get(String(coverUrl));
    if (cachedPalette) {
      songDetailPalette.value = cachedPalette;
      return;
    }

    const extractedPalette = await extractCoverPalette(String(coverUrl));
    if (requestId !== songDetailPaletteRequestId) return;
    if (extractedPalette) {
      coverPaletteCache.set(String(coverUrl), extractedPalette);
    }
    songDetailPalette.value = extractedPalette ?? fallbackPalette;
  },
  { immediate: true }
);

watch([() => currentTrack.value.id, activeView], () => {
  if (privateRoamingActive.value && privateRoamingCurrentIndex.value < 0) {
    privateRoamingActive.value = false;
  }
  if (
    privateRoamingActive.value
    && privateRoamingCurrentIndex.value >= 0
    && privateRoamingBufferedCount.value <= 2
    && privateRoamingState.value !== "loading"
  ) {
    void loadPrivateRoamingBatch(false, false);
  }
});

function markCoverFailed(track: Track) {
  failedCoverIds.value = new Set([...failedCoverIds.value, trackCoverKey(track)]);
}

function handleTrackCoverError(event: Event, track: Track) {
  const image = event.target as HTMLImageElement;
  const fallbackUrl = resolveBackendUrl(track.coverFallbackUrl);
  if (fallbackUrl && image.src !== fallbackUrl) {
    image.src = fallbackUrl;
    return;
  }
  markCoverFailed(track);
}

function handleCurrentCoverError(event: Event) {
  const fallbackUrl = currentTrack.value.coverFallbackUrl;
  const image = event.target as HTMLImageElement;
  const resolvedFallbackUrl = resolveBackendUrl(fallbackUrl);
  if (fallbackUrl && image.currentSrc !== resolvedFallbackUrl) {
    if (!currentCoverFallbackActive.value) {
      currentCoverFallbackActive.value = true;
    }
    return;
  }
  currentCoverFailedKey.value = trackCoverKey(currentTrack.value);
}
const playbackDuration = computed(() => getPlaybackDuration(currentTrack.value.duration, mediaDuration.value));
const seekablePlaybackDuration = computed(() => {
  return getSeekablePlaybackDuration(currentTrack.value.duration, mediaDuration.value);
});
const isCurrentPreview = computed(() => {
  return isPreviewPlayback(currentTrack.value.duration, mediaDuration.value);
});
const previewProgressLimit = computed(() => {
  if (!isCurrentPreview.value || playbackDuration.value <= 0) {
    return 100;
  }
  return Math.min(100, (seekablePlaybackDuration.value / playbackDuration.value) * 100);
});
const activeLyricIndex = computed(() => {
  return getLyricHighlightState(currentTime.value, lyricLines.value).activeIndex;
});
function isLyricLineOutsideFocus(index: number) {
  const focusRows = appearancePreferences.value.lyrics.focusRows;
  if (focusRows === 0 || activeLyricIndex.value < 0) return false;
  return Math.abs(index - activeLyricIndex.value) > Math.floor(focusRows / 2);
}
const anchorLyricLine = computed(() => lyricLines.value[lyricAnchorIndex.value]);
const currentLyricText = computed(() => lyricLines.value[activeLyricIndex.value]?.text ?? lyricLines.value[0]?.text ?? "暂无歌词");
const currentLyricCredits = computed(() => {
  const parsedCredits = parseLyricCredits(currentTrack.value.lyrics);
  if (currentTrack.value.lyricCredits?.length) {
    const combined = [...currentTrack.value.lyricCredits];
    for (const parsed of parsedCredits) {
      if (!combined.some((credit) => credit.label === parsed.label && credit.value === parsed.value)) combined.push(parsed);
    }
    return combined.map((credit) => {
      if (credit.time !== undefined) {
        return credit;
      }
      const parsedCredit = parsedCredits.find((item) => {
        return item.label === credit.label && item.value === credit.value;
      });
      return parsedCredit?.time === undefined ? credit : { ...credit, time: parsedCredit.time };
    });
  }
  return parsedCredits;
});
const preludeEndTime = computed(() => getPreludeEndTime(
  lyricLines.value[0]?.time ?? 0,
  playbackDuration.value,
  lyricLines.value.length > 0
));
const preludeTrackText = computed(() => currentTrack.value.title + ' - ' + currentTrack.value.artist);
const prefaceLineTimes = computed(() => {
  if (preludeEndTime.value <= 0) {
    return [];
  }
  return createPrefaceLineTimes(
    preludeEndTime.value,
    currentLyricCredits.value.map((credit) => credit.time)
  );
});
const anchorPlaybackTime = computed(() => {
  if (prefaceAnchorActive.value) {
    return prefaceLineTimes.value[prefaceAnchorLineIndex.value];
  }
  return anchorLyricLine.value?.time;
});
const playModeOptions: Array<{ mode: PlayMode; title: string }> = [
  { mode: "shuffle", title: "随机播放" },
  { mode: "sequence", title: "顺序播放" },
  { mode: "single", title: "单曲循环" },
  { mode: "loop", title: "列表循环" }
];
const settingsSections: Array<{ id: SettingsSection; title: string; icon: string }> = [
  { id: "general", title: "常规", icon: "☷" },
  { id: "playback", title: "播放", icon: "♩" },
  { id: "appearance", title: "外观", icon: "◌" },
  { id: "desktop-lyrics", title: "桌面歌词", icon: "▱" },
  { id: "cache", title: "缓存与数据", icon: "▤" },
  { id: "shortcuts", title: "快捷键", icon: "⌕" },
  { id: "about", title: "关于", icon: "ⓘ" }
];
const visibleSettingsSections = computed(() => {
  const query = settingsSearchKeyword.value.trim().toLowerCase();
  if (!query) {
    return settingsSections;
  }
  return settingsSections.filter((section) => section.title.toLowerCase().includes(query));
});
const activeSettingsTitle = computed(() => {
  return settingsSections.find((section) => section.id === activeSettingsSection.value)?.title ?? "常规";
});
const listeningDataAvailableYears = computed(() => {
  const years = new Set(listeningDataSummary.value?.years ?? []);
  years.add(new Date().getFullYear());
  years.add(listeningDataDeleteYear.value);
  return [...years].sort((left, right) => right - left);
});
const listeningDataDeleteRange = computed(() => createListeningStatsRange(
  listeningDataDeleteMode.value,
  listeningDataDeleteYear.value,
  listeningDataDeleteMonth.value
));
const listeningDataDeleteRangeLabel = computed(() => describeListeningStatsRange(
  listeningDataDeleteMode.value,
  listeningDataDeleteYear.value,
  listeningDataDeleteMonth.value
));
const listeningDataSelectionEmpty = computed(() => {
  const summary = listeningDataSummary.value;
  return !summary || (summary.rangeTrackCount === 0 && summary.rangeActiveDays === 0);
});
const selectedQqListeningDataSummary = computed(() => (
  qqListeningDataSummaries.value.find((summary) => summary.accountId === selectedQqListeningDataAccountId.value) ?? null
));
const qqListeningDataRangeValid = computed(() => (
  qqListeningDataDeleteMode.value === "all"
  || (Boolean(qqListeningDataDeleteFrom.value)
    && Boolean(qqListeningDataDeleteTo.value)
    && qqListeningDataDeleteFrom.value <= qqListeningDataDeleteTo.value)
));

const pageTitle = computed(() => {
  if (submittedKeyword.value) {
    return `搜索: ${submittedKeyword.value}`;
  }
  if (selectedLocalAlbum.value) {
    return selectedLocalAlbum.value.title;
  }
  if (selectedPlaylist.value) {
    return selectedPlaylist.value.title;
  }
  if (activeView.value === "streaming-library" && !selectedStreamingAccount.value) {
    return streamingProviderName.value;
  }
  const titles: Record<ViewKey, string> = {
    home: appMode.value === "local" ? "我的音乐库" : "主页",
    discover: streamingSource.value === "qq" ? "QQ 音乐" : "发现歌单",
    playlist: "歌单",
    library: "本地音乐",
    liked: "我喜欢的音乐",
    history: "最近播放",
    daily: "每日推荐",
    artists: "艺术家",
    albums: "专辑",
    playlists: "歌单",
    aggregate: "聚合歌单",
    folders: "文件夹",
    "streaming-library": "音乐库",
    "account-following": "关注",
    "account-followers": "粉丝",
    "account-user-profile": "用户主页",
    "streaming-recent": "最近播放",
    "listening-ranking": "听歌排行",
    cloud: "音乐云盘",
    settings: "设置"
  };
  return titles[activeView.value];
});

const pageSubtitle = computed(() => {
  if (submittedKeyword.value) {
    return "从你的曲库与在线目录中找到这些声音";
  }
  if (selectedLocalAlbum.value) {
    return `${selectedLocalAlbum.value.tracks.length} 首歌曲 · ${selectedLocalAlbum.value.artistText}`;
  }
  if (selectedPlaylist.value) {
    return "网易云推荐歌单";
  }
  if (activeView.value === "streaming-library" && !selectedStreamingAccount.value) {
    return "登录后展示全部音乐库";
  }
  const subtitles: Record<ViewKey, string> = {
    home: appMode.value === "local" ? "这台设备上的音乐，都在这里" : streamingGreeting.value,
    discover: streamingSource.value === "qq" ? "已登录账号的音乐库" : "新的歌单，还有一点意外的喜欢",
    playlist: "歌单里的歌曲",
    library: "扫描、整理并播放这台设备上的音乐",
    liked: "把每一次心动留在喜欢里",
    history: "接着上次的播放继续听",
    daily: "根据你的音乐偏好，为今天准备的歌曲",
    artists: "按艺术家浏览你的音乐",
    albums: "按专辑浏览你的音乐",
    playlists: "管理本地歌单",
    aggregate: "把本地和在线歌曲放在一起",
    folders: "管理已扫描的音乐文件夹",
    "streaming-library": "喜欢、足迹与常听音乐",
    "account-following": "你关注的音乐伙伴",
    "account-followers": "关注你的音乐伙伴",
    "account-user-profile": "用户资料与社交信息",
    "streaming-recent": "回顾最近听过的声音",
    "listening-ranking": "最近一周最常播放的歌曲",
    cloud: "网易云音乐云盘",
    settings: "调整本地音乐库和应用偏好"
  };
  return subtitles[activeView.value];
});

const pageTransitionKey = computed(() => [
  appMode.value,
  activeView.value,
  selectedPlaylist.value?.id ?? "",
  selectedLocalAlbum.value?.id ?? "",
  selectedLocalArtist.value?.id ?? "",
  selectedStreamingArtist.value?.id ?? "",
  selectedLocalFolderPath.value ?? "",
  activeSettingsSection.value
].join("::"));

const visiblePlaylists = computed(() => {
  const query = submittedKeyword.value.trim().toLowerCase();
  if (selectedPlaylist.value || activeView.value === "daily") {
    return [];
  }
  const source = activeView.value === "home"
    ? homepagePlaylists.value
    : activeView.value === "discover"
      ? discoveryPlaylists.value
      : activeView.value === "streaming-library"
        ? accountPlaylists.value
    : activeView.value === "liked"
      ? allPlaylists.value.filter((item) => item.id === "favorites")
      : allPlaylists.value;
  if (!query) {
    return source;
  }
  return source.filter((item) => `${item.title} ${item.subtitle}`.toLowerCase().includes(query));
});

const visibleTracks = computed(() => {
  let source = submittedKeyword.value
    ? catalogResults.value
    : selectedLocalAlbum.value
      ? selectedLocalAlbum.value.tracks
    : selectedPlaylist.value && playlistState.value === "success"
      ? catalogResults.value
    : activeView.value === "home"
      ? homepageSongs.value
      : activeView.value === "discover"
        ? discoverySongs.value
        : activeView.value === "daily"
          ? dailyRecommendationTracks.value
          : activeView.value === "streaming-library"
            ? accountFavoriteTracks.value
      : currentLibrary.value;
  if (activeView.value === "liked") {
    source = favoriteTracks.value;
  }
  if (activeView.value === "history") {
    source = historyTracks.value;
  }
  if (activeView.value === "streaming-recent") {
    source = accountRecentTracks.value;
  }
  if (activeView.value === "listening-ranking") {
    source = accountListeningRank.value;
  }

  const query = submittedKeyword.value.trim().toLowerCase();
  if (!query) {
    return source;
  }
  return source.filter((track) => `${track.title} ${track.artist} ${track.album}`.toLowerCase().includes(query));
});

const selectedPlaylistTracks = computed(() => {
  const playlist = selectedPlaylist.value;
  if (!playlist) {
    return [];
  }
  let tracks: Track[];
  if (playlist.id === "favorites") {
    tracks = favoriteTracks.value;
  } else if (playlist.userManaged || playlist.source === "local-user") {
    tracks = localPlaylistTrackMap.value[playlist.id] ?? [];
  } else {
    tracks = playlistState.value === "success" ? catalogResults.value : [];
  }
  // QQ-owned lists use the verified cloud order, including after app restart.
  if (playlist.source === "qq" && playlist.accountScoped) return tracks;
  return applyTrackOrder(tracks, playlistTrackOrder.value[playlist.id] ?? []);
});
const selectedPlaylistTrackSummary = computed(() => {
  const count = selectedPlaylistTracks.value.length;
  const totalSeconds = selectedPlaylistTracks.value.reduce((sum, track) => sum + Math.max(0, Number(track.duration) || 0), 0);
  const minutes = totalSeconds > 0 ? Math.ceil(totalSeconds / 60) : 0;
  return `${count} 首 · ${minutes} 分钟`;
});

const playlistFolderOptions = computed(() => {
  const folders = new Set<string>();
  selectedPlaylistTracks.value.forEach((track) => {
    if (!track.filePath) {
      return;
    }
    const parts = track.filePath.split(/[\\/]/);
    folders.add(parts.slice(0, -1).join("\\") || "未知文件夹");
  });
  return ["全部", ...Array.from(folders)];
});

const playlistSourceOptions = computed(() => {
  const sources = new Set(selectedPlaylistTracks.value.map((track) => track.source || "local"));
  return ["全部", ...Array.from(sources)];
});

const filteredPlaylistTracks = computed(() => {
  let tracks = [...selectedPlaylistTracks.value];
  const query = keyword.value.trim().toLowerCase();
  if (query && selectedPlaylist.value) {
    tracks = tracks.filter((track) => `${track.title} ${track.artist} ${track.album} ${track.filePath ?? ""}`.toLowerCase().includes(query));
  }
  if (playlistFilter.value.folder !== "全部") {
    tracks = tracks.filter((track) => {
      const parts = (track.filePath || "").split(/[\\/]/);
      return (parts.slice(0, -1).join("\\") || "未知文件夹") === playlistFilter.value.folder;
    });
  }
  if (playlistFilter.value.source !== "全部") {
    tracks = tracks.filter((track) => (track.source || "local") === playlistFilter.value.source);
  }
  return tracks;
});

function toTrack(raw: unknown, index: number): Track | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const item = raw as Record<string, unknown>;
  const title = String(item.title ?? item.name ?? "").trim();
  if (!title) {
    return null;
  }
  const colors = [
    ["#a8c7d4", "#6d789c"],
    ["#e5b487", "#b65d55"],
    ["#d58d8b", "#7c526d"],
    ["#a4ca9d", "#467a68"]
  ][index % 4];

  const trackId = String(item.id ?? `remote-track-${index}`);
  const source = String(item.source ?? "");
  const coverUrl = typeof item.coverUrl === "string" ? item.coverUrl : undefined;
  const sampleRate = Number(item.sampleRate ?? item.sample_rate ?? 0);
  const bitDepth = Number(item.bitDepth ?? item.bit_depth ?? item.bitsPerSample ?? 0);
  const codec = typeof item.codec === "string"
    ? item.codec
    : typeof item.format === "string" ? item.format : undefined;
  const genre = typeof item.genre === "string"
    ? item.genre
    : typeof item.style === "string"
      ? item.style
      : Array.isArray(item.genres) ? item.genres.filter(Boolean).join("/") : undefined;

  return {
    id: trackId,
    title,
    artist: String(item.artist ?? item.artists ?? "未知歌手"),
    album: String(item.album ?? "未知专辑"),
    duration: Number(item.duration ?? 240),
    primary: colors[0],
    secondary: colors[1],
    mark: title.slice(0, 1),
    liked: Boolean(item.liked)
      || favoriteTracks.value.some((track) => track.id === trackId)
      || accountFavoriteTracks.value.some((track) => track.id === trackId),
    history: Boolean(item.history),
    source,
    filePath: typeof item.filePath === "string" ? item.filePath : undefined,
    audioUrl: typeof item.url === "string" ? item.url : undefined,
    coverUrl,
    coverFallbackUrl: source === "netease"
      ? `/catalog/tracks/${encodeURIComponent(trackId)}/cover`
      : undefined,
    codec,
    sampleRate: sampleRate > 0 ? sampleRate : undefined,
    bitDepth: bitDepth > 0 ? bitDepth : undefined,
    genre,
    lyrics: typeof item.lyrics === "string" ? item.lyrics : "",
    lyricsTranslation: typeof item.translation === "string"
      ? item.translation
      : typeof item.lyricsTranslation === "string" ? item.lyricsTranslation : undefined,
    lyricsPhonetic: typeof item.phonetic === "string"
      ? item.phonetic
      : typeof item.lyricsPhonetic === "string" ? item.lyricsPhonetic : undefined,
    lyricsFormat: typeof item.lyricsFormat === "string" ? item.lyricsFormat : undefined,
    lyricsSource: typeof item.lyricsSource === "string" ? item.lyricsSource : undefined,
    metaSource: item.metaSource === "embedded" || item.metaSource === "filename"
      ? item.metaSource
      : undefined,
    lyricCredits: normalizeLyricCredits(item.lyricCredits ?? item.credits),
    hasLyrics: Boolean(item.lyrics),
    hasCover: Boolean(item.coverUrl),
    createdAt: typeof item.createdAt === "string" ? item.createdAt : undefined,
    updatedAt: typeof item.updatedAt === "string" ? item.updatedAt : undefined,
    queueKey: typeof item.queueKey === "string" ? item.queueKey : undefined
  };
}

function toPersistedTrack(track: Track): PersistedTrack {
  return {
    id: track.id,
    queueKey: track.queueKey,
    title: track.title,
    artist: track.artist,
    album: track.album,
    duration: Number.isFinite(track.duration) ? Math.round(track.duration) : 0,
    source: track.source || "local",
    filePath: track.filePath,
    url: track.audioUrl,
    coverUrl: track.coverUrl,
    lyrics: track.lyrics,
    lyricsPhonetic: track.lyricsPhonetic,
    lyricsSource: track.lyricsSource,
    lyricsFormat: track.lyricsFormat,
    metaSource: track.metaSource
  };
}

function syncFavoriteFlag(trackId: string, liked: boolean) {
  if (trackId.startsWith("qq:")) streamingHomeCache.clear("qq");
  const collections = [demoTracks, remoteTracks.value, catalogResults.value, playbackQueue.value, historyTracks.value];
  collections.forEach((tracks) => {
    tracks.forEach((track) => {
      if (track.id === trackId) {
        track.liked = liked;
      }
    });
  });
  if (currentTrack.value.id === trackId) {
    currentTrack.value.liked = liked;
  }
}

function syncAccountFavoriteFlag(trackId: string, liked: boolean) {
  const collections = [
    accountFavoriteTracks.value,
    dailyRecommendationTracks.value,
    streamingHomeTracks.value,
    ...Object.values(streamingDailyTrackCache.value),
    homepageSongs.value,
    discoverySongs.value,
    catalogResults.value,
    playbackQueue.value,
    historyTracks.value,
    accountRecentTracks.value,
    accountListeningRank.value
  ];
  collections.forEach((tracks) => {
    tracks.forEach((track) => {
      if (track.id === trackId) {
        track.liked = liked;
      }
    });
  });
  if (currentTrack.value.id === trackId) {
    currentTrack.value.liked = liked;
  }
}

function restorePersistedSession(state?: PlaybackState) {
  if (sessionRestored) {
    return;
  }
  sessionRestored = true;

  const restoredVolume = Number(state?.volume);
  if (Number.isFinite(restoredVolume)) {
    volume.value = Math.max(0, Math.min(100, restoredVolume));
  }
  if (state && playModeOptions.some((option) => option.mode === state.playMode)) {
    playMode.value = state.playMode;
  }

  const availableTracks = [
    ...playbackQueue.value,
    ...favoriteTracks.value,
    ...accountFavoriteTracks.value,
    ...dailyRecommendationTracks.value,
    ...historyTracks.value,
    ...remoteTracks.value,
    ...demoTracks
  ];
  const restoredTrack = state?.trackId
    ? availableTracks.find((track) => track.id === state.trackId)
    : undefined;
  currentTrack.value = restoredTrack ?? remoteTracks.value[0] ?? currentTrack.value;
  syncFavoriteFlag(
    currentTrack.value.id,
    favoriteTracks.value.some((track) => track.id === currentTrack.value.id)
  );

  const restoredPosition = desktopIntegrationPreferences.value.rememberPlaybackPosition
    ? Math.max(0, Number(state?.positionSeconds) || 0)
    : 0;
  pendingSeekTime = restoredPosition;
  currentTime.value = restoredPosition;
  lyricClockTime = restoredPosition;
  progress.value = currentTrack.value.duration > 0
    ? Math.min(100, (restoredPosition / currentTrack.value.duration) * 100)
    : 0;
  loadTrackLyrics(currentTrack.value);
  void hydrateRestoredTrackLyrics(currentTrack.value, ++trackAssetRequestId);
  void nextTick(() => {
    if (audioElement.value) {
      audioElement.value.volume = volume.value / 100;
    }
    prepareAudioSource(currentTrack.value);
  });
}

function toPlaylist(raw: unknown, index: number): Playlist | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const item = raw as Record<string, unknown>;
  const title = String(item.title ?? item.name ?? "").trim();
  if (!title) {
    return null;
  }
  const colors = [
    ["#a7c8d1", "#dba4b9"],
    ["#1d293c", "#6c8ea9"],
    ["#ec9c6b", "#db4d65"],
    ["#d1ad78", "#73845d"]
  ][index % 4];
  const playlistId = String(item.id ?? `remote-playlist-${index}`);
  const source = typeof item.source === "string" && item.source
    ? item.source
    : playlistId.includes(":") ? playlistId.split(":", 1)[0] : undefined;

  return {
    id: playlistId,
    title,
    subtitle: String(item.subtitle ?? "来自你的音乐库"),
    count: Number(item.count ?? item.trackCount ?? 0),
    primary: colors[0],
    secondary: colors[1],
    mark: title.slice(0, 1),
    imageUrl: typeof item.imageUrl === "string" ? item.imageUrl : undefined,
    source,
    playCount: Number(item.playCount ?? 0),
    createdByAccount: Boolean(item.createdByAccount),
    deletable: item.deletable === true,
    favorite: item.favorite === true,
    recommendationSource: typeof item.recommendationSource === "string" ? item.recommendationSource : undefined,
    recommendationReason: typeof item.recommendationReason === "string" ? item.recommendationReason : undefined
  };
}

function toAccountPlaylistList(raw: unknown): Playlist[] {
  return Array.isArray(raw)
    ? raw
      .map(toPlaylist)
      .filter((playlist): playlist is Playlist => Boolean(playlist))
      .map((playlist) => ({ ...playlist, accountScoped: true, streamingTemplate: true }))
    : [];
}

function toAccountPlaylistListWithOverrides(raw: unknown, provider: AccountProvider): Playlist[] {
  const providerAccount = accounts.value.find((candidate) => candidate.provider === provider);
  const remotePlaylists = Array.isArray(raw) ? raw as AccountPlaylistView[] : [];
  const merged = providerAccount
    ? mergePlaylistSubscriptionOverrides(provider, providerAccount.userId, remotePlaylists)
    : remotePlaylists;
  return toAccountPlaylistList(merged);
}

async function ensurePlaylistDiscoveryCategories(provider: AccountProvider = streamingSource.value) {
  const viewState = playlistDiscoveryStates[provider];
  if (Object.keys(viewState.categoryGroups).length > 0) return;
  try {
    const categories = await loadPlaylistCategories(provider);
    viewState.hotTags = categories.hotTags.length ? categories.hotTags : viewState.hotTags;
    viewState.qualityTags = categories.highQualityTags.length ? categories.highQualityTags : ["全部"];
    viewState.categoryGroups = categories.groups;
  } catch {
    viewState.categoryGroups = {};
  }
}

async function loadPlaylistDiscovery(
  page = playlistDiscoveryStates[streamingSource.value].page,
  resetPagination = false,
  provider: AccountProvider = streamingSource.value
) {
  const viewState = playlistDiscoveryStates[provider];
  const pageCursors = playlistDiscoveryPageCursors[provider];
  if (viewState.status === "loading" && !resetPagination) return;
  const requestId = ++playlistDiscoveryRequestIds[provider];
  const requestedPage = Math.max(1, page);
  const previousPage = viewState.page;
  if (resetPagination) {
    pageCursors.clear();
    pageCursors.set(1, undefined);
    viewState.hasMore = true;
  }
  viewState.status = "loading";
  viewState.error = "";
  try {
    const result = provider === "netease" && viewState.mode === "highquality"
      ? await loadHighQualityPlaylists(
          viewState.category,
          PLAYLIST_DISCOVERY_PAGE_SIZE,
          pageCursors.get(requestedPage),
          provider
        )
      : await loadDiscoveredPlaylists(
          viewState.category,
          viewState.order,
          PLAYLIST_DISCOVERY_PAGE_SIZE,
          (requestedPage - 1) * PLAYLIST_DISCOVERY_PAGE_SIZE,
          provider
        );
    if (requestId !== playlistDiscoveryRequestIds[provider]) return;
    const incoming = result.playlists
      .map(toPlaylist)
      .filter((playlist): playlist is Playlist => Boolean(playlist))
      .map((playlist) => ({
        ...playlist,
        source: provider,
        accountScoped: provider === "qq",
        streamingTemplate: true
      }));

    if (requestedPage > previousPage && incoming.length === 0) {
      viewState.hasMore = false;
      viewState.status = "success";
      return;
    }

    viewState.playlists = incoming;
    viewState.page = requestedPage;
    viewState.total = Number(result.total || incoming.length);
    viewState.hasMore = incoming.length > 0 && Boolean(result.hasMore);
    if (provider === "netease" && viewState.mode === "highquality") {
      if (result.cursor && result.hasMore) {
        pageCursors.set(requestedPage + 1, result.cursor);
      } else {
        pageCursors.delete(requestedPage + 1);
      }
    }
    viewState.status = "success";
    if (requestedPage !== previousPage && streamingSource.value === provider) {
      await nextTick();
      document.querySelector<HTMLElement>(".playlist-discovery-page")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  } catch (error) {
    if (requestId !== playlistDiscoveryRequestIds[provider]) return;
    viewState.status = "error";
    viewState.error = error instanceof Error ? error.message : "歌单加载失败，请稍后重试。";
  }
}

function changePlaylistDiscoveryMode(mode: "all" | "highquality") {
  const provider = streamingSource.value;
  const viewState = playlistDiscoveryStates[provider];
  if (provider === "qq" || viewState.mode === mode) return;
  viewState.mode = mode;
  viewState.category = "全部";
  void loadPlaylistDiscovery(1, true, provider);
}

function changePlaylistDiscoveryOrder(order: "hot" | "new") {
  const provider = streamingSource.value;
  const viewState = playlistDiscoveryStates[provider];
  if (viewState.order === order && viewState.mode === "all") return;
  viewState.mode = "all";
  viewState.order = order;
  void loadPlaylistDiscovery(1, true, provider);
}

function changePlaylistDiscoveryCategory(category: string) {
  const provider = streamingSource.value;
  const viewState = playlistDiscoveryStates[provider];
  if (viewState.category === category) return;
  viewState.category = category;
  void loadPlaylistDiscovery(1, true, provider);
}

function changePlaylistDiscoveryPage(page: number) {
  const provider = streamingSource.value;
  const viewState = playlistDiscoveryStates[provider];
  if (viewState.status === "loading" || page < 1 || page === viewState.page) return;
  if (page > viewState.page && !viewState.hasMore) return;
  void loadPlaylistDiscovery(page, false, provider);
}

function openDiscoveredPlaylist(playlist: Playlist) {
  void updatePlaylistPlayCount(playlist.id).catch(() => undefined);
  void selectPlaylist({ ...playlist, streamingTemplate: true });
}

function toHomepageData(raw: unknown): HomepageData {
  if (!raw || typeof raw !== "object") {
    return { banners: [], playlists: [], songs: [], hasMore: false };
  }
  const item = raw as Record<string, unknown>;
  const banners = Array.isArray(item.banners)
    ? item.banners.filter((banner): banner is HomepageBanner => {
        if (!banner || typeof banner !== "object") {
          return false;
        }
        const candidate = banner as Record<string, unknown>;
        return typeof candidate.imageUrl === "string" && candidate.imageUrl.length > 0;
      }).map((banner) => ({
        ...banner,
        title: banner.title || "推荐内容",
        subtitle: banner.subtitle || ""
      }))
    : [];
  const playlists = Array.isArray(item.playlists)
    ? item.playlists.map(toPlaylist).filter((playlist): playlist is Playlist => Boolean(playlist))
    : [];
  const songs = Array.isArray(item.songs)
    ? item.songs.map(toTrack).filter((track): track is Track => Boolean(track))
    : [];
  return {
    banners,
    playlists,
    songs,
    cursor: typeof item.cursor === "string" ? item.cursor : undefined,
    hasMore: Boolean(item.hasMore)
  };
}

function clearAccountContent() {
  const accountTrackIds = new Set([
    ...accountFavoriteTracks.value,
    ...dailyRecommendationTracks.value,
    ...homepageSongs.value,
    ...discoverySongs.value,
    ...catalogResults.value,
    ...playbackQueue.value,
    ...historyTracks.value
  ].filter((track) => track.source === "netease").map((track) => track.id));
  accountTrackIds.forEach((trackId) => syncAccountFavoriteFlag(trackId, false));
  accountFavoriteTracks.value = [];
  accountPlaylists.value = [];
  accountProfile.value = null;
  accountFollowing.value = [];
  accountFollowers.value = [];
  accountSocialState.value = "idle";
  accountSocialError.value = "";
  accountSocialPage.value = 1;
  accountSocialHasMore.value = false;
  selectedSocialProfile.value = null;
  selectedSocialProfileState.value = "idle";
  selectedSocialProfileError.value = "";
  accountSocialRequestId += 1;
  socialProfileRequestId += 1;
  accountRecentTracks.value = [];
  accountListeningRank.value = [];
  accountContentState.value = "idle";
  accountContentError.value = "";
  dailyRecommendationTracks.value = [];
  dailyRecommendationState.value = "error";
  dailyRecommendationError.value = "登录网易云后查看每日推荐";
}

function accountContentErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message.includes("登录")
    ? `登录${streamingProviderName.value}后查看账号内容`
    : fallback;
}

function toQqListeningRankTracks(entries: QqListeningRankEntry[]) {
  return entries
    .map((entry, index) => toTrack(entry.track, index))
    .filter((track): track is Track => Boolean(track));
}

async function loadAccountContent() {
  const activeAccount = selectedStreamingAccount.value;
  if (!activeAccount) {
    clearAccountContent();
    return;
  }

  const requestId = ++accountContentRequestId;
  const recentRevision = accountRecentRevision;
  const provider = activeAccount.provider;
  accountFavoriteTracks.value = [];
  accountPlaylists.value = [];
  accountProfile.value = null;
  accountFollowing.value = [];
  accountFollowers.value = [];
  accountRecentTracks.value = [];
  accountListeningRank.value = [];
  accountContentState.value = "loading";
  accountContentError.value = "";
  dailyRecommendationState.value = "loading";
  dailyRecommendationError.value = "";

  const [recommendationsResult, favoritesResult, playlistsResult, profileResult, followingResult, recentResult, rankResult] = await Promise.allSettled([
    loadAccountRecommendations(provider),
    loadAccountFavorites(provider),
    loadAccountPlaylists(provider),
    loadAccountProfile(provider),
    loadAccountFollowing(provider, ACCOUNT_SOCIAL_PAGE_SIZE, 0),
    loadAccountRecentTracks(provider),
    loadAccountListeningRank(provider, { period: qqListeningRankPeriod.value })
  ]);

  if (
    requestId !== accountContentRequestId
    || streamingSource.value !== provider
    || selectedStreamingAccount.value?.userId !== activeAccount.userId
  ) {
    return;
  }

  const failures: unknown[] = [];
  if (recommendationsResult.status === "fulfilled") {
    dailyRecommendationTracks.value = Array.isArray(recommendationsResult.value)
      ? recommendationsResult.value.map(toTrack).filter((track): track is Track => Boolean(track))
      : [];
    dailyRecommendationState.value = "success";
  } else {
    failures.push(recommendationsResult.reason);
    dailyRecommendationTracks.value = [];
    dailyRecommendationState.value = "error";
    dailyRecommendationError.value = accountContentErrorMessage(
      recommendationsResult.reason,
      "每日推荐暂不可用，请稍后重试。"
    );
  }

  if (favoritesResult.status === "fulfilled") {
    accountFavoriteTracks.value = Array.isArray(favoritesResult.value)
      ? favoritesResult.value
        .map(toTrack)
        .filter((track): track is Track => Boolean(track))
        .map((track) => ({ ...track, liked: true }))
      : [];
  } else {
    failures.push(favoritesResult.reason);
    accountFavoriteTracks.value = [];
  }

  if (playlistsResult.status === "fulfilled") {
    accountPlaylists.value = toAccountPlaylistListWithOverrides(playlistsResult.value, provider);
  } else {
    failures.push(playlistsResult.reason);
    accountPlaylists.value = toAccountPlaylistListWithOverrides([], provider);
  }

  if (profileResult.status === "fulfilled") {
    accountProfile.value = profileResult.value;
    accounts.value = accounts.value.map((candidate) => candidate.provider === provider
      ? {
          ...candidate,
          nickname: profileResult.value.nickname || candidate.nickname,
          avatarUrl: profileResult.value.avatarUrl || candidate.avatarUrl
        }
      : candidate);
    if (provider === "netease") {
      account.value = accounts.value.find((candidate) => candidate.provider === "netease") ?? null;
    }
  } else {
    failures.push(profileResult.reason);
    accountProfile.value = {
      ...activeAccount,
      signature: "",
      follows: 0,
      followers: 0
    };
  }

  if (followingResult.status === "fulfilled") {
    accountFollowing.value = Array.isArray(followingResult.value) ? followingResult.value : [];
  } else {
    failures.push(followingResult.reason);
    accountFollowing.value = [];
  }

  if (recentRevision !== accountRecentRevision) {
    // A confirmed playback report supersedes the older batch query.
  } else if (recentResult.status === "fulfilled") {
    accountRecentTracks.value = Array.isArray(recentResult.value)
      ? recentResult.value.map(toTrack).filter((track): track is Track => Boolean(track))
      : [];
  } else {
    failures.push(recentResult.reason);
    accountRecentTracks.value = [];
  }

  if (rankResult.status === "fulfilled") {
    accountListeningRank.value = provider === "qq"
      ? toQqListeningRankTracks(Array.isArray(rankResult.value) ? rankResult.value as QqListeningRankEntry[] : [])
      : Array.isArray(rankResult.value)
        ? rankResult.value.map(toTrack).filter((track): track is Track => Boolean(track))
        : [];
  } else {
    failures.push(rankResult.reason);
    accountListeningRank.value = [];
  }

  accountFavoriteTracks.value.forEach((track) => syncAccountFavoriteFlag(track.id, true));
  accountContentState.value = failures.length > 0 ? "error" : "success";
  if (failures.length > 0) {
    accountContentError.value = accountContentErrorMessage(
      failures[0],
      `${streamingProviderName.value}账号内容暂不可用，请稍后重试。`
    );
  }
}

async function loadStreamingLibraryData() {
  await loadAccountContent();
}

async function loadListeningRankRange(refresh = true) {
  const activeAccount = selectedStreamingAccount.value;
  if (!activeAccount) return;

  const accountId = activeAccount.userId;
  const provider = activeAccount.provider;
  const period = qqListeningRankPeriod.value;
  qqListeningRankPending.value = true;
  qqListeningRankError.value = "";
  try {
    const entries = await loadAccountListeningRank(provider, {
      period,
      refresh
    });
    if (
      selectedStreamingAccount.value?.provider !== provider
      || selectedStreamingAccount.value.userId !== accountId
      || qqListeningRankPeriod.value !== period
    ) return;
    accountListeningRank.value = provider === "qq"
      ? toQqListeningRankTracks(entries as QqListeningRankEntry[])
      : Array.isArray(entries)
        ? entries.map(toTrack).filter((track): track is Track => Boolean(track))
        : [];
  } catch (error) {
    if (selectedStreamingAccount.value?.userId === accountId) {
      qqListeningRankError.value = accountContentErrorMessage(error, `${streamingProviderName.value}听歌排行刷新失败，已保留上次结果。`);
    }
  } finally {
    if (selectedStreamingAccount.value?.userId === accountId && qqListeningRankPeriod.value === period) {
      qqListeningRankPending.value = false;
    }
  }
}

function changeQqListeningRankPeriod(period: QqListeningRankPeriod) {
  qqListeningRankPeriod.value = period;
  qqListeningRankError.value = "";
  void loadListeningRankRange(true);
}

async function refreshAccountListeningRank() {
  await loadListeningRankRange(true);
}

function resetQqHomeRankings() {
  qqHomeRankingRequestId += 1;
  qqHomeRankings.value = createInitialQqHomeRankings();
}

function saveStreamingHomeSnapshot(provider: AccountProvider) {
  const activeAccount = accounts.value.find((candidate) => candidate.provider === provider);
  if (!activeAccount) return;
  streamingHomeCache.set(provider, activeAccount.userId, {
    tracks: streamingHomeTracks.value.map((track) => ({ ...track })),
    playlists: streamingHomePlaylists.value.map((playlist) => ({ ...playlist })),
    radarTracks: streamingRadarTracks.value.map((track) => ({ ...track })),
    radarState: streamingRadarState.value,
    radarError: streamingRadarError.value,
    roamingTracks: privateRoamingTracks.value.map((track) => ({ ...track })),
    roamingState: privateRoamingState.value,
    roamingError: privateRoamingError.value
  });
}

function restoreStreamingHomeSnapshot(provider: AccountProvider) {
  const activeAccount = accounts.value.find((candidate) => candidate.provider === provider);
  if (!activeAccount) return null;
  const cachedHome = streamingHomeCache.get(provider, activeAccount.userId);
  if (!cachedHome) return null;

  streamingHomeTracks.value = cachedHome.snapshot.tracks.map((track) => ({ ...track }));
  streamingHomePlaylists.value = cachedHome.snapshot.playlists.map((playlist) => ({ ...playlist }));
  streamingRadarTracks.value = cachedHome.snapshot.radarTracks.map((track) => ({ ...track }));
  streamingRadarState.value = cachedHome.snapshot.radarState;
  streamingRadarError.value = cachedHome.snapshot.radarError;
  privateRoamingTracks.value = cachedHome.snapshot.roamingTracks.map((track) => ({ ...track }));
  privateRoamingState.value = cachedHome.snapshot.roamingState;
  privateRoamingError.value = cachedHome.snapshot.roamingError;
  streamingHomeError.value = "";
  streamingHomeState.value = "success";
  return cachedHome;
}

async function loadQqHomeRankings() {
  const requestId = ++qqHomeRankingRequestId;
  qqHomeRankings.value = createInitialQqHomeRankings().map((ranking) => ({
    ...ranking,
    state: "loading"
  }));
  const results = await Promise.allSettled(
    QQ_HOME_RANKING_DEFINITIONS.map((ranking) => loadCatalogPlaylist(ranking.playlistId))
  );
  if (
    requestId !== qqHomeRankingRequestId
    || streamingSource.value !== "qq"
    || !accounts.value.some((candidate) => candidate.provider === "qq")
  ) {
    return;
  }
  qqHomeRankings.value = QQ_HOME_RANKING_DEFINITIONS.map((ranking, index) => {
    const result = results[index];
    const tracks = result.status === "fulfilled" && Array.isArray(result.value)
      ? result.value.map(toTrack).filter((track): track is Track => Boolean(track))
      : [];
    return {
      ...ranking,
      count: tracks.length || 30,
      tracks,
      state: result.status === "fulfilled" && tracks.length ? "success" : "error",
      error: result.status === "rejected" ? "榜单加载失败，请稍后重试。" : tracks.length ? "" : "榜单暂时没有返回歌曲。"
    };
  });
}

async function loadStreamingHomeData(
  provider = streamingSource.value,
  options: { preserveVisibleContent?: boolean } = {}
) {
  const activeAccount = accounts.value.find((candidate) => candidate.provider === provider) ?? null;
  const requestId = ++streamingHomeRequestId;
  if (!activeAccount) {
    streamingHomeTracks.value = [];
    streamingHomePlaylists.value = [];
    streamingHomeError.value = "";
    streamingHomeState.value = "idle";
    if (provider === "qq") resetQqHomeRankings();
    return;
  }

  if (!options.preserveVisibleContent) {
    streamingHomeState.value = "loading";
  }
  streamingHomeError.value = "";
  if (provider === "qq") {
    qqHomePlaylistsError.value = "";
    void loadQqHomeRankings();
  }
  const [recommendationsResult, playlistsResult, radarResult, roamingResult] = await Promise.allSettled([
    loadAccountRecommendations(provider),
    loadFeaturedPlaylists(provider),
    provider === "netease" ? loadPrivateRadar(provider) : Promise.resolve([]),
    provider === "netease" ? loadPrivateRoaming("DEFAULT") : Promise.resolve([])
  ]);
  const currentAccount = accounts.value.find((candidate) => candidate.provider === provider) ?? null;
  if (
    requestId !== streamingHomeRequestId
    || streamingSource.value !== provider
    || currentAccount?.userId !== activeAccount.userId
  ) {
    return;
  }

  const nextTracks = recommendationsResult.status === "fulfilled" && Array.isArray(recommendationsResult.value)
    ? recommendationsResult.value.map(toTrack).filter((track): track is Track => Boolean(track))
    : options.preserveVisibleContent ? streamingHomeTracks.value : [];
  const nextPlaylists = playlistsResult.status === "fulfilled" && Array.isArray(playlistsResult.value)
    ? playlistsResult.value
      .map(toPlaylist)
      .filter((playlist): playlist is Playlist => Boolean(playlist))
      .map((playlist) => ({ ...playlist, source: provider, accountScoped: true, streamingTemplate: true }))
    : options.preserveVisibleContent ? streamingHomePlaylists.value : [];
  const nextRadarTracks = provider === "netease" && radarResult.status === "fulfilled" && Array.isArray(radarResult.value)
    ? radarResult.value.map(toTrack).filter((track): track is Track => Boolean(track))
    : options.preserveVisibleContent ? streamingRadarTracks.value : [];
  const nextRoamingTracks = provider === "netease" && roamingResult.status === "fulfilled" && Array.isArray(roamingResult.value)
    ? roamingResult.value.map(toTrack).filter((track): track is Track => Boolean(track))
    : options.preserveVisibleContent ? privateRoamingTracks.value : [];

  if (recommendationsResult.status === "rejected" && playlistsResult.status === "rejected") {
    if (options.preserveVisibleContent) {
      streamingHomeState.value = "success";
      return;
    }
    const firstError = recommendationsResult.reason;
    streamingHomeState.value = "error";
    streamingHomeError.value = firstError instanceof Error
      ? firstError.message
      : `${provider === "qq" ? "QQMusicAPI" : "网易云音乐 API"} 暂时无法加载推荐内容。`;
    return;
  }

  streamingHomeTracks.value = nextTracks;
  streamingDailyTrackCache.value = {
    ...streamingDailyTrackCache.value,
    [provider]: streamingHomeTracks.value.map((track) => ({ ...track }))
  };
  streamingHomePlaylists.value = nextPlaylists;
  if (provider === "qq" && playlistsResult.status === "rejected") {
    qqHomePlaylistsError.value = "推荐歌单加载失败，请稍后刷新。";
  }
  streamingRadarTracks.value = nextRadarTracks;
  streamingRadarState.value = radarResult.status === "fulfilled" ? "success" : "error";
  streamingRadarError.value = radarResult.status === "rejected" && radarResult.reason instanceof Error
    ? radarResult.reason.message
    : "";
  privateRoamingTracks.value = nextRoamingTracks;
  privateRoamingState.value = roamingResult.status === "fulfilled" ? "success" : "error";
  privateRoamingError.value = roamingResult.status === "rejected" && roamingResult.reason instanceof Error
    ? roamingResult.reason.message
    : "";

  streamingHomeState.value = "success";
  saveStreamingHomeSnapshot(provider);
}

async function refreshQqHomePlaylists() {
  const accountId = accounts.value.find(account => account.provider === "qq")?.userId;
  if (!accountId || qqHomePlaylistsRefreshing.value) return;
  qqHomePlaylistsRefreshing.value = true;
  qqHomePlaylistsError.value = "";
  try {
    const result = await loadFeaturedPlaylists("qq", true);
    if (streamingSource.value !== "qq" || selectedStreamingAccount.value?.userId !== accountId) return;
    streamingHomePlaylists.value = result.map(toPlaylist)
      .filter((playlist): playlist is Playlist => Boolean(playlist))
      .map(playlist => ({ ...playlist, source: "qq", accountScoped: true, streamingTemplate: true }));
    saveStreamingHomeSnapshot("qq");
  } catch {
    if (streamingSource.value === "qq" && selectedStreamingAccount.value?.userId === accountId) {
      qqHomePlaylistsError.value = "推荐歌单刷新失败，已保留上次结果。";
    }
  } finally {
    qqHomePlaylistsRefreshing.value = false;
  }
}

async function loadStreamingRadarData() {
  const requestId = ++streamingRadarRequestId;
  streamingRadarState.value = "loading";
  streamingRadarError.value = "";
  try {
    const result = await loadPrivateRadar("netease");
    if (requestId !== streamingRadarRequestId) return streamingRadarTracks.value;
    streamingRadarTracks.value = Array.isArray(result)
      ? result.map(toTrack).filter((track): track is Track => Boolean(track))
      : [];
    streamingRadarState.value = "success";
    return streamingRadarTracks.value;
  } catch (error) {
    if (requestId !== streamingRadarRequestId) return streamingRadarTracks.value;
    streamingRadarState.value = "error";
    streamingRadarError.value = error instanceof Error ? error.message : "私人雷达加载失败，请稍后重试。";
    throw error;
  }
}

async function refreshBackendData() {
  localLibraryHydrated.value = false;
  try {
    const result = await pingBackend();
    backendStatus.value = result.ok ? "已连接" : "离线";
  } catch {
    backendStatus.value = "离线";
  }

  try {
    accounts.value = await loadCurrentAccounts();
    account.value = accounts.value.find((candidate) => candidate.provider === "netease") ?? null;
  } catch {
    try {
      account.value = await loadCurrentAccount();
      accounts.value = account.value ? [account.value] : [];
    } catch {
      // 保留已知账号，避免一次暂时的网络错误把登录状态从界面清掉。
    }
  }
  accounts.value.forEach((currentAccount) => {
    setPageDataCacheAccountScope(currentAccount.provider, currentAccount.userId);
  });

  homepageState.value = "loading";
  homepageError.value = "";
  discoveryState.value = "loading";
  discoveryError.value = "";
  const [tracksResult, playlistsResult, favoritesResult, historyResult, queueResult, stateResult, homepageResult, discoveryResult, rootsResult, ignoredResult, listeningStatsResult] = await Promise.allSettled([
    loadLibrary(),
    loadPlaylists(),
    loadFavorites(),
    loadHistory(),
    loadPlaybackQueue(),
    loadPlaybackState(),
    loadHomepage(),
    loadDiscovery(),
    loadLocalLibraryRoots(),
    loadIgnoredLocalFiles(),
    loadListeningStats()
  ]);

  remoteTracks.value = tracksResult.status === "fulfilled" && Array.isArray(tracksResult.value)
    ? tracksResult.value.map(toTrack).filter((track): track is Track => Boolean(track))
    : [];
  localLibraryHydrated.value = true;
  localLibraryRoots.value = rootsResult.status === "fulfilled" && Array.isArray(rootsResult.value)
    ? rootsResult.value.filter((path): path is string => typeof path === "string" && Boolean(path.trim()))
    : [];
  ignoredLocalFiles.value = ignoredResult.status === "fulfilled" && Array.isArray(ignoredResult.value)
    ? ignoredResult.value.filter((path): path is string => typeof path === "string" && Boolean(path.trim()))
    : [];
  remotePlaylists.value = playlistsResult.status === "fulfilled" && Array.isArray(playlistsResult.value)
    ? playlistsResult.value.map(toPlaylist).filter((playlist): playlist is Playlist => Boolean(playlist))
    : [];
  favoriteTracks.value = favoritesResult.status === "fulfilled" && Array.isArray(favoritesResult.value)
    ? favoritesResult.value.map(toTrack).filter((track): track is Track => Boolean(track)).map((track) => ({ ...track, liked: true }))
    : [];
  historyTracks.value = historyResult.status === "fulfilled" && Array.isArray(historyResult.value)
    ? historyResult.value
      .map(toTrack)
      .filter((track): track is Track => Boolean(track))
      .map((track) => {
        const libraryTrack = remoteTracks.value.find((item) => item.id === track.id);
        return { ...track, ...libraryTrack, history: true };
      })
    : [];
  if (listeningStatsResult.status === "fulfilled") {
    listeningStats.value = mergeListeningStats(listeningStats.value, listeningStatsResult.value);
    persistListeningStats(0);
  }
  playbackQueue.value = queueResult.status === "fulfilled" && Array.isArray(queueResult.value)
    ? queueResult.value.map(toTrack).filter((track): track is Track => Boolean(track))
      .map((track) => ensureQueueTrackKey(track))
    : [];

  if (homepageResult.status === "fulfilled") {
    homepageData.value = toHomepageData(homepageResult.value);
    homepageState.value = "success";
  } else {
    homepageData.value = { banners: [], playlists: [], songs: [], hasMore: false };
    homepageState.value = "error";
    homepageError.value = "网易云首页暂不可用，请确认音乐 API 已启动。";
  }

  if (discoveryResult.status === "fulfilled") {
    discoveryData.value = toHomepageData(discoveryResult.value);
    discoveryState.value = "success";
  } else {
    discoveryData.value = { banners: [], playlists: [], songs: [], hasMore: false };
    discoveryState.value = "error";
    discoveryError.value = "发现内容暂不可用，请确认音乐 API 已启动。";
  }

  favoriteTracks.value.forEach((track) => syncFavoriteFlag(track.id, true));
  if (selectedStreamingAccount.value) {
    await loadAccountContent();
  } else {
    clearAccountContent();
  }
  await loadStreamingHomeData();
  restorePersistedSession(stateResult.status === "fulfilled" ? stateResult.value : undefined);
}

async function loadDailyRecommendationData() {
  await loadAccountContent();
}

function prepareAudioSource(track: Track) {
  const audio = audioElement.value;
  if (!audio || !track.audioUrl) {
    return;
  }
  const source = resolveBackendUrl(track.id === localAudioOwnerId.value && localAudioOverride.value
    ? localAudioOverride.value : track.audioUrl);
  if (audio.src === source) {
    return;
  }
  audio.pause();
  audio.src = source;
  audio.volume = volume.value / 100;
  audio.load();
}

function clearSearchResultItems() {
  searchRequestId += 1;
  catalogResults.value = [];
  searchPlaylists.value = [];
  searchArtists.value = [];
  searchPage.value = 1;
  searchTotal.value = 0;
  searchState.value = "idle";
  searchError.value = "";
}

function clearSearchResults() {
  clearSearchResultItems();
  streamingArtistRequestId += 1;
  selectedStreamingArtist.value = null;
  streamingArtistDetail.value = null;
  streamingArtistTracks.value = [];
  streamingArtistAlbums.value = [];
  streamingArtistTracksOffset.value = 0;
  streamingArtistTracksTotal.value = 0;
  streamingArtistTracksHasMore.value = false;
  streamingArtistAlbumsOffset.value = 0;
  streamingArtistAlbumsTotal.value = 0;
  streamingArtistAlbumsHasMore.value = false;
  streamingArtistState.value = "idle";
  submittedKeyword.value = "";
}

function showSearchToast(message: string) {
  searchToast.value = message;
  if (searchToastTimer) window.clearTimeout(searchToastTimer);
  searchToastTimer = window.setTimeout(() => {
    searchToast.value = "";
    searchToastTimer = undefined;
  }, 3200);
}

async function performSearch(page = 1) {
  const query = keyword.value.trim();
  if (!query) {
    clearSearchResults();
    return;
  }
  submittedKeyword.value = query;
  searchError.value = "";
  const requestId = ++searchRequestId;
  const requestedPage = Math.max(1, page);
  searchState.value = "loading";
  try {
    const results = await searchCatalog(
      query,
      streamingSource.value,
      searchTab.value,
      searchPageSize.value,
      (requestedPage - 1) * searchPageSize.value
    );
    if (requestId !== searchRequestId) {
      return;
    }
    catalogResults.value = Array.isArray(results.songs)
      ? results.songs.map(toTrack).filter((track): track is Track => Boolean(track))
      : [];
    searchPlaylists.value = Array.isArray(results.playlists)
      ? results.playlists
          .map(toPlaylist)
          .filter((playlist): playlist is Playlist => Boolean(playlist))
          .map((playlist) => ({ ...playlist, streamingTemplate: true }))
      : [];
    searchArtists.value = Array.isArray(results.artists) ? results.artists : [];
    searchPage.value = requestedPage;
    searchTotal.value = Math.max(0, Number(results.total) || 0);
    searchState.value = "success";
    backendStatus.value = "已连接";
    await nextTick();
    mainScrollElement.value?.scrollTo({ top: 0, behavior: "smooth" });
  } catch (error) {
    if (requestId !== searchRequestId) {
      return;
    }
    catalogResults.value = [];
    searchPlaylists.value = [];
    searchArtists.value = [];
    searchTotal.value = 0;
    searchState.value = "error";
    searchError.value = "搜索暂时不可用";
    showSearchToast(searchError.value);
  }
}

function submitSearch() {
  if (searchDebounceTimer) window.clearTimeout(searchDebounceTimer);
  return performSearch(1);
}

function focusStreamingSearch() {
  streamingSearchInput.value?.focus();
}

function clearStreamingSearch() {
  keyword.value = "";
  streamingSearchFocused.value = false;
  void nextTick(() => streamingSearchInput.value?.blur());
}

function changeSearchTab(tab: SearchTab) {
  if (searchTab.value === tab) return;
  searchTab.value = tab;
  void performSearch(1);
}

function changeSearchPage(page: number) {
  const totalPages = Math.max(1, Math.ceil(searchTotal.value / searchPageSize.value));
  if (searchState.value === "loading" || page < 1 || page > totalPages || page === searchPage.value) return;
  void performSearch(page);
}

const selectedStreamingArtistProvider = computed<AccountProvider>(() => {
  return selectedStreamingArtist.value?.source === "qq" ? "qq" : "netease";
});

const searchPageSize = computed(() => SEARCH_PAGE_SIZE);

async function loadStreamingArtistDetail(artist: CatalogSearchArtist) {
  const requestId = ++streamingArtistRequestId;
  const provider = artist.source === "qq" ? "qq" : "netease";
  streamingArtistState.value = "loading";
  streamingArtistError.value = "";
  streamingArtistDetail.value = null;
  streamingArtistTracks.value = [];
  streamingArtistAlbums.value = [];
  streamingArtistPlaylists.value = [];
  streamingArtistTracksOffset.value = 0;
  streamingArtistTracksTotal.value = artist.trackCount;
  streamingArtistTracksHasMore.value = false;
  streamingArtistTracksLoading.value = false;
  streamingArtistAlbumsOffset.value = 0;
  streamingArtistAlbumsTotal.value = artist.albumCount;
  streamingArtistAlbumsHasMore.value = false;
  streamingArtistAlbumsLoading.value = false;
  try {
    const [detailResult, topSongsResult, songPageResult, subscriptionResult] = await Promise.allSettled([
      loadCatalogArtistDetail(artist.id, provider),
      loadCatalogArtistTopSongs(artist.id, provider),
      loadCatalogArtistSongs(artist.id, provider, "hot", 50, 0),
      loadCatalogArtistSubscription(artist.id, provider).catch(() => ({ subscribed: false }))
    ]);
    if (requestId !== streamingArtistRequestId || selectedStreamingArtist.value?.id !== artist.id) return;
    const detail = detailResult.status === "fulfilled" ? detailResult.value : null;
    const topSongs = topSongsResult.status === "fulfilled" ? topSongsResult.value : [];
    const songPage = songPageResult.status === "fulfilled" ? songPageResult.value : null;
    if (topSongsResult.status === "rejected" && songPageResult.status === "rejected") {
      streamingArtistState.value = "error";
      streamingArtistError.value = "歌手歌曲加载失败，请稍后重试。";
      return;
    }
    streamingArtistDetail.value = detail ?? {
      provider,
      id: artist.id,
      name: artist.name,
      avatarUrl: artist.imageUrl,
      signature: "",
      albumCount: artist.albumCount,
      trackCount: artist.trackCount
    };
    const rawSongs = Array.isArray(topSongs) && topSongs.length > 0 ? topSongs : songPage?.songs ?? [];
    streamingArtistTracks.value = Array.isArray(rawSongs)
      ? rawSongs.map(toTrack).filter((track): track is Track => Boolean(track))
      : [];
    streamingArtistTracksOffset.value = songPage?.songs?.length ?? streamingArtistTracks.value.length;
    streamingArtistTracksTotal.value = songPage?.total || detail?.trackCount || artist.trackCount;
    streamingArtistTracksHasMore.value = Boolean(songPage?.hasMore && (songPage.songs?.length ?? 0) > 0);
    streamingArtistAlbumsTotal.value = detail?.albumCount || artist.albumCount;
    streamingArtistAlbumsHasMore.value = streamingArtistAlbumsTotal.value > 0;
    streamingArtistFollowed.value = subscriptionResult.status === "fulfilled"
      ? Boolean(subscriptionResult.value.subscribed)
      : false;
    streamingArtistState.value = "success";
    await nextTick();
    mainScrollElement.value?.scrollTo({ top: 0, behavior: "smooth" });
    void maybeLoadMoreStreamingArtistContent();
  } catch (error) {
    if (requestId !== streamingArtistRequestId) return;
    streamingArtistState.value = "error";
    streamingArtistError.value = error instanceof Error ? error.message : "歌手详情加载失败，请稍后重试。";
  }
}

function selectStreamingArtist(artist: CatalogSearchArtist) {
  pageTransitionDirection.value = "forward";
  selectedStreamingArtist.value = artist;
  streamingArtistTab.value = "songs";
  void loadStreamingArtistDetail(artist);
}

async function changeStreamingArtistTab(tab: "songs" | "albums" | "playlists") {
  if (streamingArtistTab.value === tab || !selectedStreamingArtist.value) return;
  streamingArtistTab.value = tab;
  if (tab === "songs") {
    await nextTick();
    void maybeLoadMoreStreamingArtistContent();
  } else if (tab === "albums" && streamingArtistAlbums.value.length === 0) {
    void loadMoreStreamingArtistAlbums();
  }
}

async function loadMoreStreamingArtistTracks() {
  const artist = selectedStreamingArtist.value;
  if (!artist || streamingArtistTracksLoading.value || !streamingArtistTracksHasMore.value) return;
  const requestId = streamingArtistRequestId;
  streamingArtistTracksLoading.value = true;
  try {
    const page = await loadCatalogArtistSongs(
      artist.id,
      selectedStreamingArtistProvider.value,
      "hot",
      50,
      streamingArtistTracksOffset.value
    );
    if (requestId !== streamingArtistRequestId || selectedStreamingArtist.value?.id !== artist.id) return;
    const existingIds = new Set(streamingArtistTracks.value.map((track) => track.id));
    const nextTracks = page.songs
      .map((song, index) => toTrack(song, streamingArtistTracks.value.length + index))
      .filter((track): track is Track => Boolean(track))
      .filter((track) => !existingIds.has(track.id));
    streamingArtistTracks.value.push(...nextTracks);
    streamingArtistTracksOffset.value += page.songs.length;
    streamingArtistTracksTotal.value = page.total || streamingArtistTracksTotal.value;
    streamingArtistTracksHasMore.value = Boolean(page.hasMore && page.songs.length > 0);
    await nextTick();
    void maybeLoadMoreStreamingArtistContent();
  } catch (error) {
    if (requestId === streamingArtistRequestId) {
      showSearchToast(error instanceof Error ? error.message : "更多歌曲加载失败，请稍后重试。");
    }
  } finally {
    streamingArtistTracksLoading.value = false;
  }
}

async function loadMoreStreamingArtistAlbums() {
  const artist = selectedStreamingArtist.value;
  if (!artist || streamingArtistAlbumsLoading.value || !streamingArtistAlbumsHasMore.value) return;
  const requestId = streamingArtistRequestId;
  streamingArtistAlbumsLoading.value = true;
  try {
    const pageSize = 30;
    const albums = await loadCatalogArtistAlbums(
      artist.id,
      selectedStreamingArtistProvider.value,
      pageSize,
      streamingArtistAlbumsOffset.value
    );
    if (requestId !== streamingArtistRequestId || selectedStreamingArtist.value?.id !== artist.id) return;
    const existingIds = new Set(streamingArtistAlbums.value.map((album) => album.id));
    const nextAlbums = (Array.isArray(albums) ? albums : []).filter((album) => !existingIds.has(album.id));
    streamingArtistAlbums.value.push(...nextAlbums);
    streamingArtistAlbumsOffset.value += albums.length;
    streamingArtistAlbumsHasMore.value = streamingArtistAlbumsTotal.value > 0
      ? streamingArtistAlbumsOffset.value < streamingArtistAlbumsTotal.value && albums.length > 0
      : albums.length === pageSize;
    streamingArtistError.value = "";
    streamingArtistState.value = "success";
    await nextTick();
    void maybeLoadMoreStreamingArtistContent();
  } catch (error) {
    if (requestId === streamingArtistRequestId) {
      streamingArtistAlbumsHasMore.value = false;
      showSearchToast(error instanceof Error ? error.message : "专辑加载失败，请稍后重试。");
    }
  } finally {
    streamingArtistAlbumsLoading.value = false;
  }
}

async function maybeLoadMoreStreamingArtistContent() {
  const root = mainScrollElement.value;
  if (!root || !selectedStreamingArtist.value) return;
  if (root.scrollHeight - root.scrollTop - root.clientHeight > 260) return;
  if (streamingArtistTab.value === "songs") {
    await loadMoreStreamingArtistTracks();
  } else if (streamingArtistTab.value === "albums") {
    await loadMoreStreamingArtistAlbums();
  }
}

function handleMainScroll(event: Event) {
  if (!selectedStreamingArtist.value) return;
  const root = event.currentTarget as HTMLElement;
  if (root.scrollHeight - root.scrollTop - root.clientHeight <= 260) {
    void maybeLoadMoreStreamingArtistContent();
  }
}

function closeStreamingArtistDetail() {
  pageTransitionDirection.value = "backward";
  streamingArtistRequestId += 1;
  selectedStreamingArtist.value = null;
  streamingArtistDetail.value = null;
  streamingArtistTracksHasMore.value = false;
  streamingArtistAlbumsHasMore.value = false;
  streamingArtistState.value = "idle";
  mainScrollElement.value?.scrollTo({ top: 0, behavior: "smooth" });
}

function playStreamingArtistTracks(random = false) {
  const tracks = [...streamingArtistTracks.value];
  if (random) tracks.sort(() => Math.random() - 0.5);
  if (!tracks.length) return;
  playbackQueue.value = tracks.map((track) => createQueueTrack(track));
  void persistPlaybackQueue();
  void playTrack(playbackQueue.value[0]);
}

async function toggleStreamingArtistFollow() {
  const artist = selectedStreamingArtist.value;
  if (!artist || streamingArtistFollowPending.value) return;
  const wasFollowed = streamingArtistFollowed.value;
  streamingArtistFollowPending.value = true;
  try {
    const result = await toggleCatalogArtistSubscription(
      artist.id,
      selectedStreamingArtistProvider.value,
      !streamingArtistFollowed.value
    );
    const subscribed = Boolean(result.subscribed);
    streamingArtistFollowed.value = subscribed;
    if (
      selectedStreamingArtistProvider.value === "qq"
      && accountProfile.value
      && subscribed !== wasFollowed
    ) {
      accountProfile.value = {
        ...accountProfile.value,
        follows: Math.max(0, accountProfile.value.follows + (subscribed ? 1 : -1))
      };
    }
  } catch (error) {
    showSearchToast(error instanceof Error ? error.message : "请先登录后关注歌手。");
  } finally {
    streamingArtistFollowPending.value = false;
  }
}

watch(keyword, (value) => {
  if (searchDebounceTimer) window.clearTimeout(searchDebounceTimer);
  if (!value.trim()) {
    clearSearchResults();
    return;
  }
  searchDebounceTimer = window.setTimeout(() => {
    void performSearch(1);
  }, SEARCH_DEBOUNCE_MS);
});

let playlistRequestId = 0;

const localOnlyViews = new Set<ViewKey>([
  "library",
  "artists",
  "albums",
  "playlists",
  "aggregate",
  "folders",
  "liked"
]);
const streamingOnlyViews = new Set<ViewKey>([
  "discover",
  "daily",
  "streaming-library",
  "account-following",
  "account-followers",
  "account-user-profile",
  "streaming-recent",
  "listening-ranking",
  "cloud"
]);

function viewForCurrentMode(view: ViewKey): ViewKey {
  if (appMode.value === "local" && streamingOnlyViews.has(view)) {
    return "home";
  }
  if (appMode.value === "streaming" && localOnlyViews.has(view)) {
    return "streaming-library";
  }
  return view;
}

function ensureStreamingHomeForModeSwitch() {
  if (streamingHomeState.value === "success" || streamingHomeState.value === "loading") {
    return;
  }
  void loadStreamingHomeData();
}

function toggleAppMode() {
  pageTransitionDirection.value = "fade";
  appMode.value = appMode.value === "local" ? "streaming" : "local";
  writeAppMode(appMode.value);
  selectedPlaylist.value = null;
  playlistState.value = "idle";
  playlistError.value = "";
  catalogResults.value = [];
  submittedKeyword.value = "";
  keyword.value = "";
  searchState.value = "idle";
  searchError.value = "";
  const entry: NavigationEntry = { view: "home" };
  navigationHistory.value = [entry];
  navigationIndex.value = 0;
  activeView.value = "home";
  if (appMode.value === "streaming") {
    ensureStreamingHomeForModeSwitch();
  }
}

function toggleSidebar() {
  sidebarCollapsed.value = !sidebarCollapsed.value;
}

function resetLocalPageScroll() {
  if (appMode.value === "local" && activeView.value !== "settings") {
    mainScrollElement.value?.scrollTo({ top: 0, behavior: "instant" });
  }
}

function handleShellMenuButton() {
  if (activeView.value === "settings") {
    if (canGoBack.value) {
      navigateBack();
    } else {
      void applyNavigation({ view: "home" });
    }
    return;
  }
  toggleSidebar();
}

function openAuthPanel() {
  openProviderAuthPanel("netease");
}

function openProviderAuthPanel(provider: AccountProvider) {
  if (provider === "qq") void finishQqListeningSession(false);
  selectedAuthProvider.value = provider;
  accountMenuVisible.value = false;
  streamingSourceMenuVisible.value = false;
  authPanelVisible.value = true;
}

function toggleAccountMenu() {
  streamingSourceMenuVisible.value = false;
  accountMenuVisible.value = !accountMenuVisible.value;
}

function closeAccountMenu() {
  accountMenuVisible.value = false;
}

function toggleStreamingSourceMenu() {
  accountMenuVisible.value = false;
  streamingSourceMenuVisible.value = !streamingSourceMenuVisible.value;
}

function closeFloatingMenus() {
  closeAccountMenu();
  streamingSourceMenuVisible.value = false;
}

function clearStreamingSourceTransientState() {
  streamingHomeRequestId += 1;
  accountContentRequestId += 1;
  accountSocialRequestId += 1;
  socialProfileRequestId += 1;
  streamingRadarRequestId += 1;
  privateRoamingRequestId += 1;
  playlistRequestId += 1;
  resetQqHomeRankings();
  clearSearchResults();

  streamingHomeTracks.value = [];
  streamingHomePlaylists.value = [];
  streamingHomeState.value = "idle";
  streamingHomeError.value = "";
  streamingRadarTracks.value = [];
  streamingRadarState.value = "idle";
  streamingRadarError.value = "";
  privateRoamingTracks.value = [];
  privateRoamingState.value = "idle";
  privateRoamingError.value = "";
  privateRoamingActive.value = false;

  dailyRecommendationTracks.value = [];
  dailyRecommendationState.value = "idle";
  dailyRecommendationError.value = "";
  accountFavoriteTracks.value = [];
  accountPlaylists.value = [];
  accountProfile.value = null;
  accountFollowing.value = [];
  accountFollowers.value = [];
  accountRecentTracks.value = [];
  accountListeningRank.value = [];
  accountContentState.value = "idle";
  accountContentError.value = "";
  accountSocialState.value = "idle";
  accountSocialError.value = "";
  selectedSocialProfile.value = null;
  selectedSocialProfileState.value = "idle";
  selectedSocialProfileError.value = "";

  selectedPlaylist.value = null;
  playlistState.value = "idle";
  playlistError.value = "";
  keyword.value = "";
  closeFloatingMenus();
}

function switchCloudSourceToNetease() {
  clearStreamingSourceTransientState();
  streamingSource.value = "netease";
  window.localStorage.setItem(STREAMING_SOURCE_STORAGE_KEY, "netease");
  showSearchToast("音乐云盘仅网易云支持，已自动切换至网易云");
}

function selectStreamingSource(provider: AccountProvider) {
  if (streamingSource.value === provider) {
    streamingSourceMenuVisible.value = false;
    return;
  }
  streamingSource.value = provider;
  window.localStorage.setItem(STREAMING_SOURCE_STORAGE_KEY, provider);
  streamingSourceMenuVisible.value = false;
  const cachedHome = restoreStreamingHomeSnapshot(provider);
  if (activeView.value === "discover") {
    void ensurePlaylistDiscoveryCategories(provider);
    if (playlistDiscoveryStates[provider].status === "idle") {
      void loadPlaylistDiscovery(1, true, provider);
    }
  }
  if (submittedKeyword.value) {
    clearSearchResultItems();
    void performSearch(1);
  } else {
    if (cachedHome?.fresh) {
      if (provider === "qq" && qqHomeRankings.value.some((ranking) => ranking.state === "idle" || ranking.state === "loading")) {
        void loadQqHomeRankings();
      }
    } else {
      void loadStreamingHomeData(provider, { preserveVisibleContent: Boolean(cachedHome) });
    }
    if (["streaming-library", "account-following", "account-followers", "account-user-profile", "streaming-recent", "listening-ranking"].includes(activeView.value)) {
      void loadAccountContent();
    }
    if (activeView.value === "cloud") {
      void loadCloudData();
    }
  }
}

function openSettingsPage() {
  closeFloatingMenus();
  settingsSearchKeyword.value = "";
  activeSettingsSection.value = "general";
  void selectView("settings");
}

function applyCacheSnapshot(snapshot: CacheSnapshot) {
  Object.assign(cacheSettings, snapshot.settings);
  cacheStatistics.value = snapshot.statistics;
  cacheSettingsLoaded.value = true;
}

function formatCacheSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

async function refreshCacheSettings(force = false) {
  if (cacheSettingsPending.value || (cacheSettingsLoaded.value && !force)) return;
  cacheSettingsPending.value = true;
  cacheSettingsError.value = "";
  try {
    if (window.listenMusic?.getBackgroundCacheStatistics) {
      backgroundCacheStatistics.value = await window.listenMusic.getBackgroundCacheStatistics();
    }
  } catch {
    cacheSettingsError.value = "背景图片缓存统计读取失败。";
  }
  try {
    applyCacheSnapshot(await loadCacheSnapshot());
  } catch {
    cacheSettingsError.value = "缓存信息加载失败，请确认后端已启动。";
  } finally {
    cacheSettingsPending.value = false;
  }
}

async function saveCacheSettings(notice = "缓存设置已保存。") {
  if (cacheSettingsPending.value || !cacheSettingsLoaded.value) return;
  cacheSettingsPending.value = true;
  cacheSettingsError.value = "";
  cacheSettingsNotice.value = "";
  try {
    applyCacheSnapshot(await updateCacheSettings({ ...cacheSettings }));
    cacheSettingsNotice.value = notice;
  } catch {
    cacheSettingsError.value = "缓存设置保存失败，请检查目录权限后重试。";
    try {
      applyCacheSnapshot(await loadCacheSnapshot());
    } catch {
      cacheSettingsLoaded.value = false;
    }
  } finally {
    cacheSettingsPending.value = false;
  }
}

async function chooseCacheDirectory() {
  if (cacheSettingsPending.value) return;
  const directory = window.listenMusic?.selectDirectory
    ? await window.listenMusic.selectDirectory()
    : await selectMusicDirectory();
  if (!directory) return;
  cacheSettings.directory = directory;
  await saveCacheSettings("缓存目录已更新，已有缓存已迁移。");
}

async function restoreCacheDirectory() {
  if (cacheSettingsPending.value) return;
  cacheSettingsPending.value = true;
  cacheSettingsError.value = "";
  cacheSettingsNotice.value = "";
  try {
    applyCacheSnapshot(await restoreDefaultCacheDirectory());
    cacheSettingsNotice.value = "已恢复默认缓存目录，已有缓存已迁移。";
  } catch {
    cacheSettingsError.value = "恢复默认缓存目录失败，请检查目录权限。";
  } finally {
    cacheSettingsPending.value = false;
  }
}

async function clearAllManagedCache() {
  const confirmed = window.confirm(
    "确认清理所有缓存？背景图片副本也会清理，并恢复纯色背景。这不会删除本地音乐、歌单数据和离线下载，也不会删除原始图片。"
  );
  if (!confirmed || cacheSettingsPending.value) return;
  cacheSettingsPending.value = true;
  cacheSettingsError.value = "";
  cacheSettingsNotice.value = "";
  try {
    applyCacheSnapshot(await clearManagedCache());
  } catch {
    cacheSettingsError.value = "封面、歌词或元数据缓存清理失败，请确认后端已启动。";
  }
  try {
    await clearBackgroundImages();
    cacheSettingsNotice.value = cacheSettingsError.value ? "背景图片缓存已清理，其他缓存请重试。"
      : "缓存已清理，本地音乐、歌单和离线下载均未受影响。";
  } catch {
    cacheSettingsError.value += " 背景图片缓存清理失败，请重试。";
  }
  cacheSettingsPending.value = false;
}

async function clearBackgroundImages() {
  if (window.listenMusic?.clearBackgroundCache) {
    backgroundCacheStatistics.value = await window.listenMusic.clearBackgroundCache();
  }
  const backgrounds = appearancePreferences.value.background;
  for (const background of [backgrounds.unified, ...Object.values(backgrounds.pages)]) {
    background.imagePath = "";
    background.mode = "solid";
  }
  appearancePreferences.value.miniPlayer.background.imagePath = "";
  if (appearancePreferences.value.miniPlayer.background.mode === "image") {
    appearancePreferences.value.miniPlayer.background.mode = "gradient";
  }
}

async function clearBackgroundCacheOnly() {
  if (cacheSettingsPending.value || !window.confirm("清理背景图片缓存并恢复纯色背景？不会删除原始图片、本地音乐、歌单数据和离线下载。")) return;
  cacheSettingsPending.value = true;
  cacheSettingsError.value = "";
  cacheSettingsNotice.value = "";
  try {
    await clearBackgroundImages();
    cacheSettingsNotice.value = "背景图片缓存已清理，原始图片未受影响。";
  } catch {
    cacheSettingsError.value = "背景图片缓存清理失败，请重试。";
  } finally { cacheSettingsPending.value = false; }
}

async function refreshListeningDataSummary() {
  const requestId = ++listeningDataSummaryRequestId;
  listeningDataSummaryPending.value = true;
  listeningDataError.value = "";
  const range = listeningDataDeleteRange.value;
  try {
    const summary = range
      ? await loadListeningStatsSummary(range.from, range.to)
      : await loadListeningStatsSummary();
    if (requestId === listeningDataSummaryRequestId) {
      listeningDataSummary.value = summary;
    }
  } catch {
    if (requestId === listeningDataSummaryRequestId) {
      listeningDataError.value = "聆听数据加载失败，请确认后端已启动。";
    }
  } finally {
    if (requestId === listeningDataSummaryRequestId) {
      listeningDataSummaryPending.value = false;
    }
  }
}

async function refreshQqListeningDataSummaries(force = false) {
  if (qqListeningDataPending.value) return;
  qqListeningDataPending.value = true;
  qqListeningDataError.value = "";
  try {
    const summaries = await loadQqListeningDataSummaries(force);
    qqListeningDataSummaries.value = Array.isArray(summaries) ? summaries : [];
    if (!qqListeningDataSummaries.value.some((summary) => summary.accountId === selectedQqListeningDataAccountId.value)) {
      selectedQqListeningDataAccountId.value = qqListeningDataSummaries.value[0]?.accountId ?? "";
    }
  } catch {
    qqListeningDataError.value = "QQ 本地听歌排行数据加载失败，请确认后端已启动。";
  } finally {
    qqListeningDataPending.value = false;
  }
}

async function deleteSelectedQqListeningStats() {
  const accountId = selectedQqListeningDataAccountId.value;
  if (
    qqListeningDataDeletePending.value
    || !accountId
    || !qqListeningDataRangeValid.value
  ) return;
  const accountName = selectedQqListeningDataSummary.value?.nickname || accountId;
  const rangeLabel = qqListeningDataDeleteMode.value === "all"
    ? "全部记录"
    : `${qqListeningDataDeleteFrom.value} 至 ${qqListeningDataDeleteTo.value}`;
  const confirmed = window.confirm(
    `确认删除 QQ 本地听歌排行「${accountName}」的${rangeLabel}？\n\n`
      + "只删除本机保存的听歌排行，不会影响 QQ 音乐云端最近播放。此操作无法撤销。"
  );
  if (!confirmed) return;

  qqListeningDataDeletePending.value = true;
  qqListeningDataNotice.value = "";
  qqListeningDataError.value = "";
  try {
    await finishQqListeningSession(false);
    await deleteQqListeningStats(accountId, qqListeningDataDeleteMode.value === "all"
      ? { all: true }
      : { from: qqListeningDataDeleteFrom.value, to: qqListeningDataDeleteTo.value });
    qqListeningDataNotice.value = `已删除「${accountName}」的${rangeLabel}。`;
    await refreshQqListeningDataSummaries(true);
    if (accounts.value.some((candidate) => candidate.provider === "qq" && candidate.userId === accountId)) {
      await loadListeningRankRange(true);
    }
  } catch {
    qqListeningDataError.value = "QQ 本地听歌排行删除失败，现有数据未改变。";
  } finally {
    qqListeningDataDeletePending.value = false;
  }
}

async function flushListeningStatsBeforeDeletion() {
  if (listeningStatsSaveTimer) {
    window.clearTimeout(listeningStatsSaveTimer);
    listeningStatsSaveTimer = undefined;
    queueListeningStatsSave(listeningStats.value);
  }
  await listeningStatsSaveChain;
}

async function deleteSelectedListeningStats() {
  if (listeningDataDeletePending.value || listeningDataSelectionEmpty.value) return;
  const selectedRange = listeningDataDeleteRangeLabel.value;
  const confirmed = window.confirm(
    `确认删除${selectedRange === "全部" ? "全部" : ` ${selectedRange}`}的聆听足迹？\n\n`
      + "只会删除聆听足迹，不会影响最近播放、歌单、本地音乐、缓存和离线下载。此操作无法撤销。"
  );
  if (!confirmed) return;

  listeningDataDeletePending.value = true;
  listeningDataNotice.value = "";
  listeningDataError.value = "";
  try {
    await flushListeningStatsBeforeDeletion();
    const range = listeningDataDeleteRange.value;
    const snapshot = range
      ? await deleteListeningStatsRange(range.from, range.to)
      : await deleteAllListeningStats();
    listeningStats.value = {
      revision: snapshot.revision,
      tracks: snapshot.tracks,
      days: snapshot.days
    };
    writeListeningStats(listeningStats.value);
    listeningDataNotice.value = `${selectedRange}的聆听足迹已删除。`;
    await refreshListeningDataSummary();
  } catch (error) {
    listeningDataError.value = error instanceof ApiRequestError && error.status === 409
      ? "数据刚刚发生变化，请刷新后再试。"
      : "聆听足迹删除失败，请稍后重试。";
  } finally {
    listeningDataDeletePending.value = false;
  }
}

async function handleAuthenticated(nextAccount: AccountView) {
  const provider = nextAccount.provider === "qq" ? "qq" : "netease";
  setPageDataCacheAccountScope(provider, nextAccount.userId);
  accounts.value = [
    ...accounts.value.filter((candidate) => candidate.provider !== nextAccount.provider),
    nextAccount
  ];
  if (nextAccount.provider === "netease") {
    account.value = nextAccount;
  }
  authPanelVisible.value = false;
  completePendingMiniPlayerOpen();
  if (nextAccount.provider === "netease" || nextAccount.provider === "qq") {
    streamingSource.value = provider;
    window.localStorage.setItem(STREAMING_SOURCE_STORAGE_KEY, provider);
  }
  if (appMode.value !== "streaming") {
    appMode.value = "streaming";
    writeAppMode(appMode.value);
  }
  accountMenuVisible.value = false;
  const homeEntry: NavigationEntry = { view: "home" };
  navigationHistory.value = [homeEntry];
  navigationIndex.value = 0;
  await applyNavigation(homeEntry);
  accountContentRequestId += 1;
  await loadDailyRecommendationData();
  await loadStreamingHomeData(provider);
  await nextTick();
  mainScrollElement.value?.scrollTo({ top: 0, behavior: "smooth" });
}

async function handleProviderLogout(provider: AccountProvider) {
  const accountAtLogout = accounts.value.find((candidate) => candidate.provider === provider);
  try {
    if (provider === "qq") await finishQqListeningSession();
    await logoutProvider(provider);
    clearPageDataCacheAccountScope(provider, accountAtLogout?.userId);
    streamingHomeCache.clear(provider);
    accounts.value = accounts.value.filter((candidate) => candidate.provider !== provider);
    if (streamingSource.value === provider) {
      streamingHomeRequestId += 1;
      streamingHomeTracks.value = [];
      streamingHomePlaylists.value = [];
      streamingHomeError.value = "";
      streamingHomeState.value = "idle";
    }
    if (provider === "netease") {
      account.value = null;
      accountContentRequestId += 1;
      clearAccountContent();
    }
    authPanelVisible.value = false;
  } catch (error) {
    scanError.value = error instanceof Error ? error.message : "退出登录失败，请稍后重试。";
  }
}

function handleLogout() {
  void handleProviderLogout(selectedAuthProvider.value);
}

function sameNavigationEntry(left: NavigationEntry, right: NavigationEntry) {
  return left.view === right.view && left.playlist?.id === right.playlist?.id;
}

function pushNavigation(entry: NavigationEntry) {
  const current = navigationHistory.value[navigationIndex.value];
  if (current && sameNavigationEntry(current, entry)) {
    return;
  }
  navigationHistory.value = [
    ...navigationHistory.value.slice(0, navigationIndex.value + 1),
    entry
  ];
  navigationIndex.value = navigationHistory.value.length - 1;
}

async function applyNavigation(entry: NavigationEntry) {
  const requestId = ++playlistRequestId;
  activeView.value = entry.view;
  selectedPlaylist.value = entry.playlist ?? null;
  selectedLocalAlbum.value = null;
  selectedLocalArtist.value = null;
  selectedLocalFolderPath.value = null;
  if (entry.playlist) {
    playlistState.value = "loading";
  } else {
    playlistState.value = "idle";
  }
  playlistError.value = "";
  catalogResults.value = [];
  submittedKeyword.value = "";
  keyword.value = "";
  searchState.value = "idle";
  searchError.value = "";

  if (!entry.playlist) {
    return;
  }

  if (entry.playlist.id.startsWith("streaming-daily-")) {
    const provider = entry.playlist.source === "qq" ? "qq" : "netease";
    catalogResults.value = streamingDailyTrackCache.value[provider].map((track) => ({ ...track }));
    playlistState.value = "success";
    return;
  }

  if (entry.playlist.id.startsWith("account-favorites-detail-")) {
    try {
      const raw = await loadAccountFavorites(entry.playlist.source || streamingSource.value);
      if (requestId !== playlistRequestId) return;
      const tracks = raw.map(toTrack).filter((track): track is Track => Boolean(track)).map(track => ({ ...track, liked: true }));
      accountFavoriteTracks.value = tracks;
      catalogResults.value = tracks.map(track => ({ ...track }));
      playlistState.value = "success";
    } catch {
      if (requestId !== playlistRequestId) return;
      playlistState.value = "error";
      playlistError.value = "喜欢的歌曲加载失败，请刷新重试。";
    }
    return;
  }

  if (entry.playlist.id === "favorites" || entry.playlist.userManaged || entry.playlist.source === "local-user") {
    playlistState.value = "success";
    return;
  }

  const playlistRequest = entry.playlist.accountScoped
    ? loadAccountPlaylist(entry.playlist.id, entry.playlist.source || account.value?.provider || "netease")
    : loadCatalogPlaylist(entry.playlist.id);

  try {
    const tracks = await playlistRequest;
    if (requestId !== playlistRequestId) {
      return;
    }
    catalogResults.value = Array.isArray(tracks)
      ? tracks.map(toTrack).filter((track): track is Track => Boolean(track))
      : [];
    playlistState.value = "success";
    backendStatus.value = "已连接";
  } catch {
    if (requestId !== playlistRequestId) {
      return;
    }
    playlistState.value = "error";
    playlistError.value = entry.playlist?.accountScoped
      ? "账号歌单加载失败，请确认网易云登录状态和 API 服务。"
      : "歌单歌曲加载失败，请确认 Java 后端和网易云 API 都已启动。";
  }
}

function selectView(view: ViewKey) {
  pageTransitionDirection.value = "fade";
  if (view === "cloud" && streamingSource.value === "qq") {
    switchCloudSourceToNetease();
  }
  const entry = { view: viewForCurrentMode(view) };
  pushNavigation(entry);
  void applyNavigation(entry);
  if (entry.view === "discover") {
    const provider = streamingSource.value;
    void ensurePlaylistDiscoveryCategories(provider);
    if (playlistDiscoveryStates[provider].status === "idle") void loadPlaylistDiscovery(1, true, provider);
  }
  if (entry.view === "streaming-library") {
    void loadStreamingLibraryData();
  }
  if (entry.view === "cloud") {
    void loadCloudData();
  }
}

async function loadCloudData() {
  if (!neteaseAccount.value) {
    cloudTracks.value = [];
    cloudState.value = "idle";
    cloudError.value = "";
    return;
  }
  cloudState.value = "loading";
  cloudError.value = "";
  try {
    cloudTracks.value = await loadCloudTracks("netease");
    cloudState.value = "success";
  } catch (error) {
    cloudState.value = "error";
    cloudError.value = error instanceof Error ? error.message : "音乐云盘同步失败，请稍后重试。";
  }
}

async function refreshCloudData() {
  invalidatePageDataCacheForProvider("netease");
  await loadCloudData();
}

async function refreshStreamingLibraryData() {
  const activeAccount = selectedStreamingAccount.value;
  if (activeAccount) invalidatePageDataCacheForProvider(activeAccount.provider);
  await loadStreamingLibraryData();
}

async function uploadCloudTracks() {
  if (!neteaseAccount.value) {
    openProviderAuthPanel("netease");
    return;
  }
  cloudUploading.value = true;
  cloudError.value = "";
  try {
    const uploaded = await uploadCloudAudio();
    if (uploaded.length) {
      await refreshCloudData();
      showSearchToast(`已上传 ${uploaded.length} 首歌曲到音乐云盘`);
    }
  } catch (error) {
    cloudError.value = error instanceof Error ? error.message : "上传失败，请稍后重试。";
  } finally {
    cloudUploading.value = false;
  }
}

async function saveCloudTrack(track: CloudTrackView) {
  try {
    const saved = await downloadCloudTrack(track);
    if (saved) showSearchToast(`已下载「${track.title}」`);
  } catch (error) {
    cloudError.value = error instanceof Error ? error.message : "下载失败，请稍后重试。";
  }
}

function toCloudPlaybackTrack(track: CloudTrackView, index = 0): Track {
  const colors = [["#c8d8ec", "#819dbc"], ["#e5d1d9", "#b27b91"], ["#cdddcf", "#7b9c86"]][index % 3];
  return {
    id: track.id,
    title: track.title,
    artist: track.artist,
    album: track.album,
    duration: track.duration,
    primary: colors[0],
    secondary: colors[1],
    mark: track.title.slice(0, 1),
    liked: false,
    history: false,
    source: "cloud",
    audioUrl: track.audioUrl,
    coverUrl: track.coverUrl
  };
}

function playCloudTrack(track: CloudTrackView) {
  if (!track.audioUrl) {
    cloudError.value = "网易云暂未返回这首歌曲的播放地址，请稍后刷新重试。";
    return;
  }
  const playbackTracks = cloudTracks.value.filter((item) => item.audioUrl).map(toCloudPlaybackTrack);
  const playableIndex = Math.max(0, playbackTracks.findIndex((item) => item.id === track.id));
  playbackQueue.value = [
    ...playbackTracks.slice(playableIndex),
    ...playbackTracks.slice(0, playableIndex)
  ].map(createQueueTrack);
  void persistPlaybackQueue();
  void playTrack(playbackQueue.value[0]);
}

function playAllCloudTracks() {
  const playableTracks = cloudTracks.value.filter((track) => track.audioUrl);
  if (!playableTracks.length) {
    cloudError.value = "当前云盘歌曲暂时都没有可用的播放地址。";
    return;
  }
  playbackQueue.value = playableTracks.map(toCloudPlaybackTrack).map(createQueueTrack);
  void persistPlaybackQueue();
  void playTrack(playbackQueue.value[0]);
}

function openStreamingLibraryView(view: "streaming-recent" | "listening-ranking") {
  pageTransitionDirection.value = "forward";
  const entry: NavigationEntry = { view };
  pushNavigation(entry);
  void applyNavigation(entry);
  if (view === "listening-ranking") {
    void loadListeningRankRange(true);
  }
}

async function loadAccountSocialPage(mode: "following" | "followers", page: number) {
  if (!selectedStreamingAccount.value) {
    openProviderAuthPanel(streamingSource.value);
    return;
  }
  const view: ViewKey = mode === "following" ? "account-following" : "account-followers";
  const provider = streamingSource.value;
  const requestId = ++accountSocialRequestId;
  accountSocialState.value = "loading";
  accountSocialError.value = "";
  try {
    const users = mode === "following"
      ? await loadAccountFollowing(provider, ACCOUNT_SOCIAL_PAGE_SIZE, (page - 1) * ACCOUNT_SOCIAL_PAGE_SIZE)
      : await loadAccountFollowers(provider, ACCOUNT_SOCIAL_PAGE_SIZE, (page - 1) * ACCOUNT_SOCIAL_PAGE_SIZE);
    if (requestId !== accountSocialRequestId || activeView.value !== view) return;
    if (mode === "following") accountFollowing.value = Array.isArray(users) ? users : [];
    else accountFollowers.value = Array.isArray(users) ? users : [];
    const profileTotal = mode === "following"
      ? accountProfile.value?.follows ?? 0
      : accountProfile.value?.followers ?? 0;
    const total = Math.max(profileTotal, (page - 1) * ACCOUNT_SOCIAL_PAGE_SIZE + users.length);
    accountSocialPage.value = page;
    accountSocialHasMore.value = users.length === ACCOUNT_SOCIAL_PAGE_SIZE
      && page * ACCOUNT_SOCIAL_PAGE_SIZE < total;
    accountSocialState.value = "success";
  } catch (error) {
    if (requestId !== accountSocialRequestId || activeView.value !== view) return;
    accountSocialState.value = "error";
    accountSocialError.value = error instanceof Error && error.message.includes("登录")
      ? `登录${streamingProviderName.value}后查看${mode === "following" ? "关注" : "粉丝"}`
      : `${mode === "following" ? "关注" : "粉丝"}列表加载失败，请稍后重试。`;
  }
}

async function openAccountSocial(mode: "following" | "followers") {
  if (!selectedStreamingAccount.value) {
    openProviderAuthPanel(streamingSource.value);
    return;
  }
  const view: ViewKey = mode === "following" ? "account-following" : "account-followers";
  pageTransitionDirection.value = "forward";
  const entry: NavigationEntry = { view };
  pushNavigation(entry);
  await applyNavigation(entry);
  await loadAccountSocialPage(mode, 1);
}

function changeAccountSocialPage(page: number) {
  if (accountSocialState.value === "loading" || page < 1) return;
  const mode = activeView.value === "account-following" ? "following" : "followers";
  void loadAccountSocialPage(mode, page);
}

async function openSocialUser(user: AccountSocialUserView) {
  const requestId = ++socialProfileRequestId;
  selectedSocialProfile.value = {
    ...user,
    signature: user.signature || "",
    follows: 0,
    followers: 0
  };
  selectedSocialProfileState.value = "loading";
  selectedSocialProfileError.value = "";
  pageTransitionDirection.value = "forward";
  const entry: NavigationEntry = { view: "account-user-profile" };
  pushNavigation(entry);
  await applyNavigation(entry);
  try {
    const profile = await loadAccountUserProfile(user.userId, streamingSource.value);
    if (requestId !== socialProfileRequestId || activeView.value !== "account-user-profile") return;
    selectedSocialProfile.value = profile;
    selectedSocialProfileState.value = "success";
  } catch {
    if (requestId !== socialProfileRequestId || activeView.value !== "account-user-profile") return;
    selectedSocialProfileState.value = "error";
    selectedSocialProfileError.value = "用户主页加载失败，请稍后重试。";
  }
}

function openSocialArtist(artist: AccountSocialUserView) {
  selectStreamingArtist({
    id: artist.userId,
    name: artist.nickname,
    imageUrl: artist.avatarUrl,
    albumCount: artist.albumCount ?? 0,
    trackCount: artist.trackCount ?? 0,
    source: artist.provider === "qq" ? "qq" : "netease"
  });
}

function openAccountFavorites() {
  const playlist: Playlist = {
    ...accountFavoritePlaylist.value,
    id: `account-favorites-detail-${streamingSource.value}`,
    title: "我喜欢的歌曲",
    subtitle: `${streamingProviderName.value} · ${accountFavoriteTracks.value.length} 首歌曲`,
    imageUrl: accountFavoriteTracks.value[0]?.coverUrl,
    streamingTemplate: true
  };
  void selectPlaylist(playlist);
}

function playAccountFavorites() {
  const firstTrack = accountFavoriteTracks.value[0];
  if (!firstTrack) return;
  playbackQueue.value = accountFavoriteTracks.value.map((track) => createQueueTrack(track));
  void persistPlaybackQueue();
  void playTrack(playbackQueue.value[0]);
}

function playStreamingLibraryTracks(tracks: Track[]) {
  const firstTrack = tracks[0];
  if (!firstTrack) return;
  playbackQueue.value = tracks.map((track) => createQueueTrack(track));
  void persistPlaybackQueue();
  void playTrack(playbackQueue.value[0]);
}

function accountRecentTracksById(trackIds: string[]) {
  const tracksById = new Map(accountRecentTracks.value.map((track) => [track.id, track]));
  return trackIds.map((trackId) => tracksById.get(trackId)).filter((track): track is Track => Boolean(track));
}

function playAccountRecentTrack(trackId: string) {
  const track = accountRecentTracks.value.find((candidate) => candidate.id === trackId);
  if (track) void playTrack(track);
}

function playAccountRecentTrackList(trackIds: string[]) {
  playStreamingLibraryTracks(accountRecentTracksById(trackIds));
}

function playAccountRecentTrackListRandom(trackIds: string[]) {
  const tracks = accountRecentTracksById(trackIds)
    .map((track) => ({ track, order: Math.random() }))
    .sort((left, right) => left.order - right.order)
    .map((item) => item.track);
  playStreamingLibraryTracks(tracks);
}

function toggleAccountRecentFavorite(trackId: string) {
  const track = accountRecentTracks.value.find((candidate) => candidate.id === trackId);
  if (track) void toggleTrackLiked(track);
}

async function runAccountRecentTrackBatch(action: TrackBatchAction, ids: string[]): Promise<TrackBatchResult> {
  const accountAtStart = selectedStreamingAccount.value;
  if (!accountAtStart || playlistMutationPending.value) return { succeeded: [], failed: ids };
  const provider = accountAtStart.provider;
  const tracks = accountRecentTracksById(ids);
  const trackById = new Map(tracks.map(track => [track.id, track]));
  const selectedIds = ids.filter(id => trackById.has(id));
  const isCurrent = () => selectedStreamingAccount.value?.userId === accountAtStart.userId
    && streamingSource.value === provider;

  if (action === "add-to-playlist") {
    if (!tracks.length) return { succeeded: [], failed: ids };
    trackPlaylistPicker.value = { tracks, mode: "streaming" };
    return { succeeded: selectedIds, failed: ids.filter(id => !trackById.has(id)), message: "请选择要加入的自建歌单。" };
  }
  if (action === "queue") {
    const existing = new Set(playbackQueue.value.map(track => track.id));
    const additions = tracks.filter(track => !existing.has(track.id)).map(createQueueTrack);
    playbackQueue.value = [...playbackQueue.value, ...additions];
    await persistPlaybackQueue();
    return { succeeded: selectedIds, failed: ids.filter(id => !trackById.has(id)), message: `已将 ${selectedIds.length} 首歌曲加入播放列表。` };
  }

  playlistMutationPending.value = true;
  try {
    if (action === "clear-recent") {
      const result = await deleteAccountRecentTracks(selectedIds, provider);
      if (!isCurrent()) return { succeeded: [], failed: ids };
      accountRecentTracks.value = Array.isArray(result.tracks)
        ? result.tracks.map(toTrack).filter((track): track is Track => Boolean(track))
        : accountRecentTracks.value.filter(track => !result.deletedTrackIds.includes(track.id));
      invalidatePageDataCacheForProvider(provider);
      const deleted = new Set(result.deletedTrackIds);
      return { succeeded: ids.filter(id => deleted.has(id)), failed: ids.filter(id => !deleted.has(id)) };
    }
    if (action === "like") {
      const result = await runTrackBatch(selectedIds, async id => {
        const track = trackById.get(id);
        if (!track) throw new Error("歌曲不可用");
        if (!accountFavoriteTracks.value.some(item => item.id === id)) {
          await saveAccountFavorite(toPersistedTrack(track), provider);
        }
        if (!isCurrent()) return;
        syncAccountFavoriteFlag(id, true);
        accountFavoriteTracks.value = [{ ...track, liked: true }, ...accountFavoriteTracks.value.filter(item => item.id !== id)];
      }, isCurrent);
      return { ...result, failed: [...result.failed, ...ids.filter(id => !trackById.has(id))] };
    }
    return { succeeded: [], failed: ids };
  } finally {
    playlistMutationPending.value = false;
  }
}

function accountListeningRankTracksById(trackIds: string[]) {
  const tracksById = new Map(accountListeningRank.value.map((track) => [track.id, track]));
  return trackIds.map((trackId) => tracksById.get(trackId)).filter((track): track is Track => Boolean(track));
}

function playAccountListeningRankTrack(trackId: string) {
  const track = accountListeningRank.value.find((candidate) => candidate.id === trackId);
  if (track) void playTrack(track);
}

function playAccountListeningRankTrackList(trackIds: string[]) {
  playStreamingLibraryTracks(accountListeningRankTracksById(trackIds));
}

function playAccountListeningRankTrackListRandom(trackIds: string[]) {
  const tracks = accountListeningRankTracksById(trackIds)
    .map((track) => ({ track, order: Math.random() }))
    .sort((left, right) => left.order - right.order)
    .map((item) => item.track);
  playStreamingLibraryTracks(tracks);
}

function toggleAccountListeningRankFavorite(trackId: string) {
  const track = accountListeningRank.value.find((candidate) => candidate.id === trackId);
  if (track) void toggleTrackLiked(track);
}

function openLocalAlbum(album: LocalAlbum) {
  pageTransitionDirection.value = "forward";
  selectedLocalAlbum.value = album;
  localAlbumSearchKeyword.value = "";
  localAlbumSortMode.value = "default";
  localAlbumFilterOpen.value = false;
  selectedPlaylist.value = null;
  submittedKeyword.value = "";
  keyword.value = "";
  catalogResults.value = [];
  playlistState.value = "idle";
  playlistError.value = "";
  activeView.value = "albums";
  mainScrollElement.value?.scrollTo({ top: 0, behavior: "auto" });
}

function closeLocalAlbumDetail() {
  pageTransitionDirection.value = "backward";
  selectedLocalAlbum.value = null;
  localAlbumSearchKeyword.value = "";
  localAlbumSortMode.value = "default";
  localAlbumFilterOpen.value = false;
  mainScrollElement.value?.scrollTo({ top: 0, behavior: "auto" });
}

function playLocalAlbumTracks(tracks: Track[]) {
  if (!tracks.length) return;
  playbackQueue.value = tracks.map((track) => createQueueTrack(track));
  void persistPlaybackQueue();
  void playTrack(tracks[0]);
}

function playLocalAlbumAll() {
  playLocalAlbumTracks([...filteredLocalAlbumTracks.value]);
}

function playLocalAlbumRandom() {
  const tracks = [...filteredLocalAlbumTracks.value]
    .map((track) => ({ track, order: Math.random() }))
    .sort((left, right) => left.order - right.order)
    .map((item) => item.track);
  playLocalAlbumTracks(tracks);
}

function playLocalAlbumTrack(track: Track) {
  playbackQueue.value = filteredLocalAlbumTracks.value.map((item) => createQueueTrack(item));
  void persistPlaybackQueue();
  void playTrack(track);
}

function openLocalFolder(folder: LocalFolder) {
  pageTransitionDirection.value = "forward";
  selectedLocalFolderPath.value = folder.path;
  selectedLocalAlbum.value = null;
  selectedLocalArtist.value = null;
  selectedPlaylist.value = null;
  submittedKeyword.value = "";
  keyword.value = "";
  activeView.value = "folders";
  mainScrollElement.value?.scrollTo({ top: 0, behavior: "smooth" });
}

function closeLocalFolderDetail() {
  pageTransitionDirection.value = "backward";
  selectedLocalFolderPath.value = null;
}

function playLocalFolderTrack(track: Track) {
  const tracks = selectedLocalFolder.value?.tracks ?? [];
  if (!tracks.length) return;
  playbackQueue.value = tracks.map((item) => createQueueTrack(item));
  void persistPlaybackQueue();
  void playTrack(track);
}

function openLocalArtist(artist: LocalArtist) {
  pageTransitionDirection.value = "forward";
  selectedLocalArtist.value = artist;
  selectedLocalAlbum.value = null;
  selectedPlaylist.value = null;
  submittedKeyword.value = "";
  keyword.value = "";
  catalogResults.value = [];
  playlistState.value = "idle";
  playlistError.value = "";
  activeView.value = "artists";
}

function closeLocalArtistDetail() {
  pageTransitionDirection.value = "backward";
  selectedLocalArtist.value = null;
}

function scrollToArtistLetter(letter: string) {
  selectedLocalArtistLetter.value = letter;
  const target = document.querySelector(`[data-artist-letter="${letter}"]`);
  target?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function navigateBack() {
  if (!canGoBack.value) {
    return;
  }
  pageTransitionDirection.value = "backward";
  navigationIndex.value -= 1;
  void applyNavigation(navigationHistory.value[navigationIndex.value]);
}

function navigateForward() {
  if (!canGoForward.value) {
    return;
  }
  pageTransitionDirection.value = "forward";
  navigationIndex.value += 1;
  void applyNavigation(navigationHistory.value[navigationIndex.value]);
}

function handleGlobalNavigationShortcut(event: KeyboardEvent) {
  if (event.defaultPrevented) return;
  if (event.key === "Escape") {
    closeFloatingMenus();
    return;
  }
  const wantsBack = (event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey && event.key === "ArrowLeft") || event.key === "BrowserBack";
  if (wantsBack) {
    event.preventDefault();
    navigateBack();
    return;
  }
  const wantsForward = (event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey && event.key === "ArrowRight") || event.key === "BrowserForward";
  if (wantsForward) {
    event.preventDefault();
    navigateForward();
  }
}

async function selectPlaylist(playlist: Playlist) {
  pageTransitionDirection.value = "forward";
  submittedKeyword.value = "";
  keyword.value = "";
  searchState.value = "idle";
  searchError.value = "";

  if (playlist.id === "account-favorites") {
    openAccountFavorites();
    return;
  }

  if (playlist.id === "local") {
    selectView("library");
    return;
  }

  const entry = { view: "playlist" as ViewKey, playlist };
  pushNavigation(entry);
  await applyNavigation(entry);
}

function openAccountPlaylistInUnifiedView(playlist: Playlist) {
  void selectPlaylist({
    ...playlist,
    accountScoped: true,
    streamingTemplate: true
  });
}

function createStreamingDailyPlaylist(): Playlist {
  return {
    id: `streaming-daily-${streamingSource.value}`,
    title: "每日推荐",
    subtitle: `${streamingProviderName.value} · 每日 06:00 焕新`,
    count: streamingHomeTracks.value.length,
    primary: "#e9e5ff",
    secondary: "#ffd9dd",
    mark: streamingDailyDate.value.day,
    imageUrl: streamingHomeTracks.value[0]?.coverUrl,
    source: streamingSource.value
  };
}

function playStreamingDailyMix() {
  if (!streamingHomeTracks.value.length) {
    return;
  }
  privateRoamingActive.value = false;
  playbackQueue.value = streamingHomeTracks.value.map((track) => createQueueTrack(track));
  void persistPlaybackQueue();
  void playTrack(playbackQueue.value[0]);
}

function playStreamingDailyPreview(trackId: string) {
  const selectedIndex = streamingHomeTracks.value.findIndex((track) => track.id === trackId);
  if (selectedIndex < 0) {
    return;
  }
  privateRoamingActive.value = false;
  const orderedTracks = [
    ...streamingHomeTracks.value.slice(selectedIndex),
    ...streamingHomeTracks.value.slice(0, selectedIndex)
  ];
  playbackQueue.value = orderedTracks.map((track) => createQueueTrack(track));
  void persistPlaybackQueue();
  void playTrack(playbackQueue.value[0]);
}

function playQqHomeRankingTrack(rankingKey: string, trackId: string) {
  const ranking = qqHomeRankings.value.find((candidate) => candidate.key === rankingKey);
  if (!ranking?.tracks.length) {
    return;
  }
  const selectedIndex = ranking.tracks.findIndex((track) => track.id === trackId);
  if (selectedIndex < 0) {
    return;
  }
  privateRoamingActive.value = false;
  const orderedTracks = [
    ...ranking.tracks.slice(selectedIndex),
    ...ranking.tracks.slice(0, selectedIndex)
  ];
  playbackQueue.value = orderedTracks.map((track) => createQueueTrack(track));
  void persistPlaybackQueue();
  void playTrack(playbackQueue.value[0]);
}

function openQqHomeRankingTrackContextMenu(payload: { rankingKey: string; trackId: string; event: MouseEvent }) {
  const ranking = qqHomeRankings.value.find((candidate) => candidate.key === payload.rankingKey);
  const track = ranking?.tracks.find((candidate) => candidate.id === payload.trackId);
  if (!ranking || !track) return;
  openTrackContextMenu(track, payload.event, ranking.tracks);
}

function openQqHomeRanking(rankingKey: string) {
  const ranking = qqHomeRankings.value.find((candidate) => candidate.key === rankingKey);
  if (!ranking?.tracks.length) {
    return;
  }
  void selectPlaylist({
    id: ranking.playlistId,
    title: ranking.title,
    subtitle: "QQ 音乐 · 每日更新",
    count: ranking.count,
    primary: ranking.primary,
    secondary: ranking.secondary,
    mark: ranking.title.slice(-3, -2),
    imageUrl: ranking.tracks[0]?.coverUrl,
    source: "qq",
    streamingTemplate: true
  });
}

function openStreamingDailyMix() {
  void selectPlaylist(createStreamingDailyPlaylist());
}

function openPrivateRoaming() {
  privateRoamingActive.value = true;
  if (privateRoamingTracks.value.length) {
    playbackQueue.value = privateRoamingTracks.value.map((track) => createQueueTrack(track));
    void persistPlaybackQueue();
    void playTrack(playbackQueue.value[0]);
    return;
  }
  void loadPrivateRoamingBatch(true, true);
}

function openPrivateRadar() {
  void playPrivateRadar();
}

async function playPrivateRadar() {
  privateRoamingActive.value = false;
  try {
    const tracks = streamingRadarTracks.value.length
      ? streamingRadarTracks.value
      : await loadStreamingRadarData();
    if (!tracks.length) {
      scanError.value = "私人雷达暂时没有返回歌曲。";
      return;
    }
    playbackQueue.value = tracks.map((track) => createQueueTrack(track));
    void persistPlaybackQueue();
    void playTrack(playbackQueue.value[0]);
  } catch {
    scanError.value = streamingRadarError.value || "私人雷达加载失败，请稍后重试。";
  }
}

async function loadPrivateRoamingBatch(reset = false, autoplay = false) {
  if (privateRoamingState.value === "loading" && !reset) return;
  const requestId = ++privateRoamingRequestId;
  privateRoamingState.value = "loading";
  privateRoamingError.value = "";
  try {
    const result = await loadPrivateRoaming(
      privateRoamingMode.value,
      privateRoamingMode.value === "SCENE_RCMD" ? privateRoamingScene.value : undefined
    );
    if (requestId !== privateRoamingRequestId) return;
    const incoming = Array.isArray(result)
      ? result.map(toTrack).filter((track): track is Track => Boolean(track))
      : [];
    const existingIds = new Set(reset ? [] : privateRoamingTracks.value.map((track) => track.id));
    const uniqueIncoming = incoming.filter((track) => !existingIds.has(track.id));
    privateRoamingTracks.value = reset
      ? uniqueIncoming
      : [...privateRoamingTracks.value, ...uniqueIncoming];
    privateRoamingState.value = "success";

    if (reset) {
      playbackQueue.value = privateRoamingTracks.value.map((track) => createQueueTrack(track));
      void persistPlaybackQueue();
      if (autoplay && playbackQueue.value[0]) {
        void playTrack(playbackQueue.value[0]);
      } else if (!playbackQueue.value.length) {
        privateRoamingActive.value = false;
        scanError.value = "私人漫游暂时没有返回歌曲。";
      }
      return;
    }

    if (uniqueIncoming.length && privateRoamingActive.value && privateRoamingCurrentIndex.value >= 0) {
      const queuedIds = new Set(playbackQueue.value.map((track) => track.id));
      playbackQueue.value = [
        ...playbackQueue.value,
        ...uniqueIncoming.filter((track) => !queuedIds.has(track.id)).map((track) => createQueueTrack(track))
      ];
      void persistPlaybackQueue();
    }
  } catch (error) {
    if (requestId !== privateRoamingRequestId) return;
    privateRoamingState.value = "error";
    privateRoamingError.value = error instanceof Error ? error.message : "私人漫游暂时无法续接歌曲。";
    if (reset) {
      privateRoamingActive.value = false;
      scanError.value = privateRoamingError.value;
    }
  }
}

function streamingDailyTracksById(trackIds: string[]) {
  const tracksById = new Map(selectedPlaylistTracks.value.map((track) => [track.id, track]));
  return trackIds.map((trackId) => tracksById.get(trackId)).filter((track): track is Track => Boolean(track));
}

function playStreamingDailyTrack(trackId: string) {
  const track = selectedPlaylistTracks.value.find((candidate) => candidate.id === trackId);
  if (track) void playTrack(track);
}

function playStreamingDailyTrackList(trackIds: string[]) {
  const tracks = streamingDailyTracksById(trackIds);
  if (!tracks.length) return;
  playbackQueue.value = tracks.map((track) => createQueueTrack(track));
  void persistPlaybackQueue();
  void playTrack(playbackQueue.value[0]);
}

function playStreamingDailyTrackListRandom(trackIds: string[]) {
  const tracks = streamingDailyTracksById(trackIds)
    .map((track) => ({ track, order: Math.random() }))
    .sort((left, right) => left.order - right.order)
    .map((item) => item.track);
  if (!tracks.length) return;
  playbackQueue.value = tracks.map((track) => createQueueTrack(track));
  void persistPlaybackQueue();
  void playTrack(playbackQueue.value[0]);
}

function toggleStreamingDailyFavorite(trackId: string) {
  const track = selectedPlaylistTracks.value.find((candidate) => candidate.id === trackId);
  if (track) void toggleTrackLiked(track);
}

function reconcilePlaylistSubscriptionRefresh(
  refreshedPlaylists: Playlist[],
  playlist: Playlist,
  subscribed: boolean
) {
  if (!subscribed) {
    return refreshedPlaylists.filter((item) => item.id !== playlist.id);
  }
  if (refreshedPlaylists.some((item) => item.id === playlist.id)) {
    return refreshedPlaylists;
  }
  return [
    { ...playlist, accountScoped: true, createdByAccount: false, streamingTemplate: true },
    ...refreshedPlaylists
  ];
}

async function toggleSelectedPlaylistCollection() {
  const playlist = selectedPlaylist.value;
  if (!playlist || !selectedPlaylistCollectable.value || playlistCollectionPending.value) return;

  const provider: AccountProvider = playlist.source === "qq" ? "qq" : "netease";
  const providerAccount = accounts.value.find((candidate) => candidate.provider === provider) ?? null;
  if (!providerAccount) {
    scanError.value = `收藏${provider === "qq" ? "QQ 音乐" : "网易云音乐"}歌单前请先登录对应账号。`;
    openProviderAuthPanel(provider);
    return;
  }

  const subscribe = !selectedPlaylistCollected.value;
  const previousPlaylists = accountPlaylists.value;
  playlistCollectionPending.value = true;
  scanError.value = "";
  try {
    const platformSynced = await setAccountPlaylistSubscription(playlist.id, subscribe, provider)
      .then((result) => result.synced)
      .catch(() => false);
    savePlaylistSubscriptionOverride(provider, providerAccount.userId, {
      id: playlist.id,
      title: playlist.title,
      subtitle: playlist.subtitle,
      imageUrl: playlist.imageUrl,
      count: playlist.count,
      createdByAccount: false
    }, subscribe);
    if (streamingSource.value !== provider) return;
    accountPlaylists.value = reconcilePlaylistSubscriptionRefresh(previousPlaylists, playlist, subscribe);
    const actionText = subscribe ? `已收藏歌单「${playlist.title}」` : `已取消收藏歌单「${playlist.title}」`;
    scanNotice.value = platformSynced
      ? `${actionText}。`
      : `${actionText}，已保存到本应用；平台同步暂不可用。`;

    if (platformSynced) try {
      const refreshedPlaylists = toAccountPlaylistListWithOverrides(
        await loadAccountPlaylists(provider),
        provider
      );
      if (streamingSource.value === provider) {
        accountPlaylists.value = reconcilePlaylistSubscriptionRefresh(refreshedPlaylists, playlist, subscribe);
      }
    } catch {
      // The mutation succeeded; retain the immediate local state until the next account refresh.
    }
  } catch (error) {
    if (streamingSource.value === provider) accountPlaylists.value = previousPlaylists;
    scanError.value = error instanceof Error ? error.message : "歌单收藏状态保存失败，请稍后重试。";
  } finally {
    playlistCollectionPending.value = false;
  }
}

async function refreshStreamingDailyMix() {
  const playlist = selectedPlaylist.value;
  if (!playlist || !isStreamingDailyPlaylist.value) return;
  const provider: AccountProvider = playlist.source === "qq" ? "qq" : "netease";
  const previousTracks = selectedPlaylistTracks.value.map((track) => ({ ...track }));
  invalidatePageDataCacheForProvider(provider);
  await loadStreamingHomeData(provider);
  if (streamingHomeState.value === "error") {
    streamingDailyTrackCache.value = { ...streamingDailyTrackCache.value, [provider]: previousTracks };
    catalogResults.value = previousTracks;
    scanError.value = streamingHomeError.value || "每日推荐刷新失败，请稍后重试。";
    return;
  }
  const refreshedTracks = streamingDailyTrackCache.value[provider].map((track) => ({ ...track }));
  catalogResults.value = refreshedTracks;
  updateSelectedPlaylist({
    ...playlist,
    count: refreshedTracks.length,
    imageUrl: refreshedTracks[0]?.coverUrl || playlist.imageUrl
  });
}

async function refreshStreamingPlaylist() {
  if (playlistMutationPending.value) return;
  const playlist = selectedPlaylist.value;
  if (!playlist) return;
  if (isStreamingDailyPlaylist.value) {
    await refreshStreamingDailyMix();
    return;
  }
  if (playlist.streamingTemplate) {
    if (playlist.accountScoped) {
      invalidatePageDataCacheForProvider(playlist.source === "qq" ? "qq" : "netease");
    } else {
      invalidatePageDataCache("public|");
    }
    await applyNavigation({ view: "playlist", playlist });
  }
}

async function runStreamingTrackBatch(action: TrackBatchAction, ids: string[]): Promise<TrackBatchResult> {
  const playlist = selectedPlaylist.value;
  const mode = selectedPlaylistBatchMode.value;
  const accountAtStart = selectedStreamingAccount.value;
  const actionAllowed = mode === "favorites" ? action === "unlike" : action === "like" || action === "remove";
  if (!playlist || !mode || !accountAtStart || playlistMutationPending.value || !actionAllowed) {
    return { succeeded: [], failed: ids };
  }
  const provider = accountAtStart.provider;
  const tracks = new Map(selectedPlaylistTracks.value.map(track => [track.id, track]));
  const isCurrent = () => selectedStreamingAccount.value?.userId === accountAtStart.userId
    && streamingSource.value === accountAtStart.provider && selectedPlaylist.value?.id === playlist.id;
  playlistMutationPending.value = true;
  try {
    return await runTrackBatch(ids, async id => {
      const track = tracks.get(id);
      if (!track || track.source !== provider) throw new Error("歌曲不可用");
      if (action === "remove") await removeAccountPlaylistTrack(playlist.id, id, provider);
      else if (action === "unlike") await removeAccountFavorite(id, provider);
      else if (!accountFavoriteTracks.value.some(item => item.id === id)) await saveAccountFavorite(toPersistedTrack(track), provider);
      if (!isCurrent()) return;
      if (action !== "remove") {
        const liked = action === "like";
        syncAccountFavoriteFlag(id, liked);
        accountFavoriteTracks.value = liked
          ? [{ ...track, liked: true }, ...accountFavoriteTracks.value.filter(item => item.id !== id)]
          : accountFavoriteTracks.value.filter(item => item.id !== id);
      }
      if (action !== "like") {
        catalogResults.value = catalogResults.value.filter(item => item.id !== id);
        updateSelectedPlaylist({ ...selectedPlaylist.value!, count: catalogResults.value.length, imageUrl: catalogResults.value[0]?.coverUrl || "" });
      }
      accountPlaylists.value = accountPlaylists.value.map(item => {
        if (item.favorite && action !== "remove") return { ...item, count: accountFavoriteTracks.value.length, imageUrl: accountFavoriteTracks.value[0]?.coverUrl || "" };
        if (item.id === playlist.id && action === "remove") return { ...item, count: catalogResults.value.length, imageUrl: catalogResults.value[0]?.coverUrl || "" };
        return item;
      });
    }, isCurrent);
  } finally { playlistMutationPending.value = false; }
}

async function reorderStreamingPlaylistTrack(draggedTrackId: string, targetTrackId: string) {
  const playlist = selectedPlaylist.value;
  const accountAtStart = selectedStreamingAccount.value;
  if (!playlist || !accountAtStart || !selectedPlaylistBatchMode.value || playlistMutationPending.value || playlistOrderCooling.value || draggedTrackId === targetTrackId) return;
  const previousIds = selectedPlaylistTracks.value.map(track => track.id);
  const tracks = [...selectedPlaylistTracks.value];
  const fromIndex = tracks.findIndex((track) => track.id === draggedTrackId);
  const toIndex = tracks.findIndex((track) => track.id === targetTrackId);
  if (fromIndex < 0 || toIndex < 0) return;
  const [movedTrack] = tracks.splice(fromIndex, 1);
  tracks.splice(toIndex, 0, movedTrack);
  const provider = accountAtStart.provider;
  const actualPlaylist = playlist.id.startsWith("account-favorites-detail-")
    ? accountPlaylists.value.find(item => item.favorite && item.source === provider) : playlist;
  if (!actualPlaylist) { playlistOrderMessage.value = "请先刷新音乐库，再调整顺序。"; return; }
  const isCurrent = () => selectedPlaylist.value?.id === playlist.id && selectedStreamingAccount.value?.userId === accountAtStart.userId && streamingSource.value === provider;
  playlistMutationPending.value = true;
  playlistOrderMessage.value = `正在保存并校验${streamingProviderName.value}歌曲顺序…`;
  try {
    await reorderAccountPlaylistTracks(actualPlaylist.id, tracks.map(track => track.id), previousIds, provider);
    if (!isCurrent()) return;
    catalogResults.value = tracks;
    if (selectedPlaylistBatchMode.value === "favorites") accountFavoriteTracks.value = tracks.map(track => ({ ...track, liked: true }));
    updateSelectedPlaylist({ ...playlist, imageUrl: tracks[0]?.coverUrl || "" });
    accountPlaylists.value = accountPlaylists.value.map(item => item.id === actualPlaylist.id ? { ...item, imageUrl: tracks[0]?.coverUrl || "" } : item);
    playlistOrderMessage.value = `顺序已同步${streamingProviderName.value}并校验，3 秒后可继续调整。`;
  } catch (error) {
    if (isCurrent()) playlistOrderMessage.value = error instanceof Error ? error.message : "排序未保存，请刷新后重试。";
  } finally {
    playlistMutationPending.value = false;
    playlistOrderCooling.value = true;
    clearTimeout(playlistOrderCooldownTimer);
    playlistOrderCooldownTimer = setTimeout(() => { playlistOrderCooling.value = false; }, 3000);
  }
}

watch(() => selectedPlaylist.value?.id, () => { playlistOrderMessage.value = ""; });
onBeforeUnmount(() => clearTimeout(playlistOrderCooldownTimer));

async function searchFromStreamingDailyMix(query: string) {
  const homeEntry: NavigationEntry = { view: "home" };
  pushNavigation(homeEntry);
  await applyNavigation(homeEntry);
  keyword.value = query;
  await submitSearch();
}

function persistLocalPlaylists() {
  const entries: StoredPlaylist[] = userPlaylists.value.map((playlist) => ({
    playlist,
    tracks: (localPlaylistTrackMap.value[playlist.id] ?? []).map(toPlaylistTrackSnapshot)
  }));
  window.localStorage.setItem(LOCAL_PLAYLIST_STORAGE_KEY, JSON.stringify(entries));
}

function persistPlaylistTrackOrder() {
  window.localStorage.setItem(PLAYLIST_TRACK_ORDER_STORAGE_KEY, JSON.stringify(playlistTrackOrder.value));
}

function persistPlaylistCoverPaths() {
  window.localStorage.setItem(PLAYLIST_COVER_PATH_STORAGE_KEY, JSON.stringify(playlistCoverPaths.value));
}

function startPlaylistTrackDrag(track: Track) {
  playlistTrackDraggedKey.value = trackOrderKey(track);
}

function finishPlaylistTrackDrag() {
  playlistTrackDraggedKey.value = null;
}

function dropPlaylistTrack(targetTrack: Track) {
  const playlist = selectedPlaylist.value;
  const draggedKey = playlistTrackDraggedKey.value;
  if (!playlist || !draggedKey) {
    finishPlaylistTrackDrag();
    return;
  }
  const nextOrder = reorderVisibleKeys(
    selectedPlaylistTracks.value.map(trackOrderKey),
    filteredPlaylistTracks.value.map(trackOrderKey),
    draggedKey,
    trackOrderKey(targetTrack)
  );
  playlistTrackOrder.value = { ...playlistTrackOrder.value, [playlist.id]: nextOrder };
  persistPlaylistTrackOrder();
  finishPlaylistTrackDrag();
}

function persistPlaylistOverviewOrder() {
  const validIds = new Set(playlistOverviewSource.value.map((playlist) => playlist.id));
  playlistOverviewOrder.value = playlistOverviewOrder.value.filter((id) => validIds.has(id));
  window.localStorage.setItem(PLAYLIST_OVERVIEW_ORDER_STORAGE_KEY, JSON.stringify(playlistOverviewOrder.value));
}

function startPlaylistOverviewDrag(playlistId: string) {
  playlistOverviewDraggedId.value = playlistId;
}

function finishPlaylistOverviewDrag() {
  playlistOverviewDraggedId.value = null;
}

function dropPlaylistOverviewCard(targetPlaylistId: string) {
  const draggedId = playlistOverviewDraggedId.value;
  if (!draggedId || draggedId === targetPlaylistId) {
    finishPlaylistOverviewDrag();
    return;
  }
  const sourceIds = playlistOverviewSource.value.map((playlist) => playlist.id);
  const nextOrder = playlistOverviewOrder.value.filter((id) => sourceIds.includes(id));
  sourceIds.forEach((id) => {
    if (!nextOrder.includes(id)) {
      nextOrder.push(id);
    }
  });
  const fromIndex = nextOrder.indexOf(draggedId);
  const toIndex = nextOrder.indexOf(targetPlaylistId);
  if (fromIndex >= 0 && toIndex >= 0) {
    const [movedId] = nextOrder.splice(fromIndex, 1);
    nextOrder.splice(toIndex, 0, movedId);
    playlistOverviewOrder.value = nextOrder;
    persistPlaylistOverviewOrder();
  }
  finishPlaylistOverviewDrag();
}

function updateSelectedPlaylist(nextPlaylist: Playlist) {
  selectedPlaylist.value = nextPlaylist;
  const historyEntry = navigationHistory.value[navigationIndex.value];
  if (historyEntry?.playlist?.id === nextPlaylist.id) {
    navigationHistory.value[navigationIndex.value] = { ...historyEntry, playlist: nextPlaylist };
  }
}

function openPlaylistRenameDialog() {
  if (!selectedPlaylist.value) {
    return;
  }
  playlistNameDialogMode.value = "rename";
  playlistNameInput.value = selectedPlaylist.value.title;
  playlistNameError.value = "";
  playlistNameDialogVisible.value = true;
}

function openPlaylistCreateDialog() {
  playlistNameDialogMode.value = "create";
  playlistNameInput.value = "";
  playlistNameError.value = "";
  playlistNameDialogVisible.value = true;
}

function openStreamingPlaylistCreateDialog() {
  playlistNameDialogMode.value = "streaming-create";
  playlistNameInput.value = "";
  playlistNameError.value = "";
  playlistNameDialogVisible.value = true;
}

function createUserPlaylist(name: string) {
  const playlist: Playlist = {
    id: `local-user-${Date.now()}`,
    title: name,
    subtitle: "点击添加歌曲",
    count: 0,
    primary: "#f7f8fb",
    secondary: "#eef3f8",
    mark: name.slice(0, 1),
    source: "local-user",
    userManaged: true
  };
  userPlaylists.value = [...userPlaylists.value, playlist];
  localPlaylistTrackMap.value = { ...localPlaylistTrackMap.value, [playlist.id]: [] };
  playlistOverviewOrder.value = [...playlistOverviewOrder.value, playlist.id];
  persistLocalPlaylists();
  persistPlaylistOverviewOrder();
  return playlist;
}

function handleCreateAggregatePlaylist(name: string) {
  const playlist = createAggregatePlaylist(name, aggregatePlaylists.value);
  aggregatePlaylists.value = [...aggregatePlaylists.value, playlist];
  writeAggregatePlaylists(aggregatePlaylists.value);
}

function normalizedAggregateSource(source: string) {
  if (source === "ncm") {
    return "netease";
  }
  if (source === "qqmusic") {
    return "qq";
  }
  return source;
}

function isAggregateSourceAvailable(source: AggregateTrackSource) {
  const normalizedSource = normalizedAggregateSource(source.source);
  if (normalizedSource === "local") {
    return true;
  }
  return accounts.value.some(
    (candidate) => normalizedAggregateSource(candidate.provider) === normalizedSource
  );
}

function trackFromAggregateSource(source: AggregateTrackSource): Track {
  const normalizedSource = normalizedAggregateSource(source.source);
  return {
    id: source.id,
    title: source.title,
    artist: source.artist,
    album: source.album,
    duration: source.duration,
    primary: "#c9d8ef",
    secondary: "#8fb5d7",
    mark: source.title.slice(0, 1),
    liked: favoriteTracks.value.some((favorite) => favorite.id === source.id),
    history: false,
    source: normalizedSource,
    filePath: source.filePath,
    audioUrl: source.audioUrl,
    coverUrl: source.coverUrl
  };
}

function playAggregateSource(source: AggregateTrackSource) {
  if (!isAggregateSourceAvailable(source)) {
    scanError.value = `${source.sourceLabel}当前未登录，音源记录已保留，请登录后再播放或切换其他音源。`;
    const provider = normalizedAggregateSource(source.source);
    if (provider === "netease" || provider === "qq") {
      openProviderAuthPanel(provider);
    }
    return;
  }
  scanError.value = "";
  const track = trackFromAggregateSource(source);
  void playTrack(track);
}

function playAggregatePlaylistSources(sources: AggregateTrackSource[], shuffle: boolean) {
  const orderedSources = shuffle
    ? [...sources].map((source) => ({ source, order: Math.random() })).sort((left, right) => left.order - right.order).map((item) => item.source)
    : sources;
  if (!orderedSources.length) {
    scanNotice.value = "当前聚合歌单没有可播放歌曲。";
    return;
  }
  playbackQueue.value = orderedSources.map((source) => createQueueTrack(trackFromAggregateSource(source)));
  void persistPlaybackQueue();
  playAggregateSource(orderedSources[0]);
}

function removeGroupFromAggregatePlaylist(playlist: AggregatePlaylist, groupId: string, title: string) {
  aggregatePlaylists.value = aggregatePlaylists.value.map((item) => (
    item.id === playlist.id ? removeAggregateTrackGroup(item, groupId) : item
  ));
  writeAggregatePlaylists(aggregatePlaylists.value);
  scanNotice.value = `已从「${playlist.name}」删除「${title}」及其全部音源。`;
}

function reorderAggregatePlaylistGroups(playlist: AggregatePlaylist, orderedGroupIds: string[]) {
  aggregatePlaylists.value = aggregatePlaylists.value.map((item) => (
    item.id === playlist.id ? reorderAggregateTrackGroups(item, orderedGroupIds) : item
  ));
  writeAggregatePlaylists(aggregatePlaylists.value);
}

async function chooseAggregatePlaylistCover(playlist: AggregatePlaylist) {
  const imagePath = await selectPlaylistCoverImage();
  if (!imagePath) {
    return;
  }
  aggregatePlaylists.value = aggregatePlaylists.value.map((item) => (
    item.id === playlist.id ? { ...item, coverUrl: filePathToUrl(imagePath) } : item
  ));
  writeAggregatePlaylists(aggregatePlaylists.value);
}

function closePlaylistNameDialog() {
  if (playlistNameSubmitting.value) return;
  playlistNameDialogVisible.value = false;
  playlistNameError.value = "";
}

async function confirmPlaylistNameDialog() {
  const name = playlistNameInput.value.trim();
  if (!name) {
    playlistNameError.value = "歌单名不能为空";
    return;
  }
  if (playlistNameDialogMode.value === "create") {
    createUserPlaylist(name);
    closePlaylistNameDialog();
    return;
  }
  if (playlistNameDialogMode.value === "streaming-create") {
    playlistNameSubmitting.value = true;
    try {
      const created = toPlaylist(
        await createAccountPlaylist(name, streamingSource.value),
        accountPlaylists.value.length
      );
      if (!created) {
        playlistNameError.value = "创建成功，但未能读取新歌单";
        return;
      }
      accountPlaylists.value = [{ ...created, accountScoped: true }, ...accountPlaylists.value];
      playlistNameDialogVisible.value = false;
      playlistNameError.value = "";
    } catch (error) {
      playlistNameError.value = error instanceof Error ? error.message : "创建歌单失败，请稍后重试";
    } finally {
      playlistNameSubmitting.value = false;
    }
    return;
  }
  const playlist = selectedPlaylist.value;
  if (!playlist) {
    closePlaylistNameDialog();
    return;
  }
  const nextPlaylist = { ...playlist, title: name, mark: name.slice(0, 1) };
  if (nextPlaylist.id === "favorites") {
    demoPlaylists.splice(demoPlaylists.findIndex((item) => item.id === "favorites"), 1, nextPlaylist);
  } else if (nextPlaylist.userManaged || nextPlaylist.source === "local-user") {
    userPlaylists.value = userPlaylists.value.map((item) => item.id === nextPlaylist.id ? nextPlaylist : item);
    persistLocalPlaylists();
  }
  updateSelectedPlaylist(nextPlaylist);
  closePlaylistNameDialog();
}

async function duplicateSelectedPlaylist() {
  const playlist = selectedPlaylist.value;
  if (!playlist) {
    return;
  }
  const copiedTracks = selectedPlaylistTracks.value.map((track) => ({ ...track }));
  const title = `${playlist.title} - 副本`;
  const duplicate: Playlist = {
    ...playlist,
    id: `local-user-${Date.now()}`,
    title,
    subtitle: `${copiedTracks.length} 首歌曲`,
    count: copiedTracks.length,
    mark: title.slice(0, 1),
    source: "local-user",
    accountScoped: false,
    userManaged: true
  };
  userPlaylists.value = [...userPlaylists.value, duplicate];
  localPlaylistTrackMap.value = { ...localPlaylistTrackMap.value, [duplicate.id]: copiedTracks };
  playlistOverviewOrder.value = [...playlistOverviewOrder.value, duplicate.id];
  persistLocalPlaylists();
  persistPlaylistOverviewOrder();
  const entry = { view: "playlist" as ViewKey, playlist: duplicate };
  pushNavigation(entry);
  await applyNavigation(entry);
}

async function choosePlaylistCover() {
  const playlist = selectedPlaylist.value;
  if (!playlist) {
    return;
  }
  const imagePath = await selectPlaylistCoverImage();
  if (!imagePath) {
    return;
  }
  playlistCoverPaths.value = { ...playlistCoverPaths.value, [playlist.id]: imagePath };
  persistPlaylistCoverPaths();
  const nextPlaylist = {
    ...playlist,
    coverPath: imagePath,
    imageUrl: filePathToUrl(imagePath)
  };
  if (nextPlaylist.id === "favorites") {
    demoPlaylists.splice(demoPlaylists.findIndex((item) => item.id === "favorites"), 1, nextPlaylist);
  } else if (nextPlaylist.userManaged || nextPlaylist.source === "local-user") {
    userPlaylists.value = userPlaylists.value.map((item) => item.id === nextPlaylist.id ? nextPlaylist : item);
    persistLocalPlaylists();
  }
  updateSelectedPlaylist(nextPlaylist);
}

function playSelectedPlaylistAll() {
  const firstTrack = filteredPlaylistTracks.value[0];
  if (!firstTrack) {
    return;
  }
  playbackQueue.value = filteredPlaylistTracks.value.map((track) => createQueueTrack(track));
  void persistPlaybackQueue();
  void playTrack(firstTrack);
}

function playSelectedPlaylistRandom() {
  const tracks = [...filteredPlaylistTracks.value];
  if (!tracks.length) {
    return;
  }
  const shuffled = tracks
    .map((track) => ({ track, order: Math.random() }))
    .sort((left, right) => left.order - right.order)
    .map((item) => item.track);
  playbackQueue.value = shuffled.map((track) => createQueueTrack(track));
  void persistPlaybackQueue();
  void playTrack(shuffled[0]);
}

let trackAssetRequestId = 0;
let playbackFadeToken = 0;
let activePlaybackFade: "in" | "out" | null = null;

function getPlaybackQueue() {
  return playbackQueue.value;
}

function nextQueueKey(trackId: string) {
  queueItemSerial += 1;
  return `${trackId}::queue-${Date.now()}-${queueItemSerial}`;
}

function createQueueTrack(track: Track) {
  return { ...track, queueKey: nextQueueKey(track.id) };
}

function ensureQueueTrackKey(track: Track) {
  return track.queueKey ? track : createQueueTrack(track);
}

function queueTrackKey(track: Track, index: number) {
  return track.queueKey ?? `${track.id}::queue-fallback-${index}`;
}

function isCurrentQueueTrack(track: Track) {
  if (track.queueKey && currentTrack.value.queueKey) {
    return track.queueKey === currentTrack.value.queueKey;
  }
  return track.id === currentTrack.value.id;
}

function findCurrentQueueIndex() {
  return playbackQueue.value.findIndex((track) => isCurrentQueueTrack(track));
}

function findQueueIndexByKey(queueKey: string) {
  return playbackQueue.value.findIndex((track, index) => queueTrackKey(track, index) === queueKey);
}

function appendTrackToQueue(track: Track) {
  if (track.id === DEFAULT_TRACK_ID) {
    return track;
  }
  if (track.queueKey && playbackQueue.value.some((item) => item.queueKey === track.queueKey)) {
    return track;
  }
  const existingTrack = playbackQueue.value.find((item) => item.id === track.id);
  if (existingTrack) {
    return existingTrack;
  }
  const queuedTrack = createQueueTrack(track);
  playbackQueue.value = [queuedTrack, ...playbackQueue.value];
  void persistPlaybackQueue();
  return queuedTrack;
}

function ensureTrackQueue(track: Track) {
  if (playbackQueue.value.length > 0) {
    return appendTrackToQueue(track);
  }
  const libraryQueue = currentLibrary.value;
  if (libraryQueue.some((item) => item.id === track.id)) {
    playbackQueue.value = libraryQueue.map((item) => createQueueTrack(item));
    void persistPlaybackQueue();
    return playbackQueue.value.find((item) => item.id === track.id) ?? track;
  }

  const queuedTrack = createQueueTrack(track);
  playbackQueue.value = [queuedTrack];
  void persistPlaybackQueue();
  return queuedTrack;
}

function persistPlaybackQueue() {
  const snapshot = playbackQueue.value.map(toPersistedTrack);
  queueSaveChain = queueSaveChain
    .catch(() => undefined)
    .then(() => savePlaybackQueue(snapshot))
    .then(() => undefined)
    .catch(() => {
      scanError.value = "播放队列暂时无法保存，请确认后端已启动。";
    });
  return queueSaveChain;
}

function currentPlaybackPosition() {
  const audioTime = audioElement.value?.currentTime;
  return Number.isFinite(audioTime) ? Number(audioTime) : Math.max(0, currentTime.value);
}

function isLocalLibraryTrack(track: Track) {
  return track.id !== DEFAULT_TRACK_ID
    && track.source !== "netease"
    && currentLibrary.value.some((item) => item.id === track.id);
}

function persistListeningStats(delay = 350) {
  writeListeningStats(listeningStats.value);
  if (listeningStatsSaveTimer) {
    window.clearTimeout(listeningStatsSaveTimer);
  }
  listeningStatsSaveTimer = window.setTimeout(() => {
    listeningStatsSaveTimer = undefined;
    queueListeningStatsSave(listeningStats.value);
  }, delay);
}

function syncListeningStats() {
  if (listeningStatsSyncPromise) {
    return listeningStatsSyncPromise;
  }

  listeningStatsSyncPromise = loadListeningStats()
    .then((persisted) => {
      listeningStats.value = mergeListeningStats(listeningStats.value, persisted);
      persistListeningStats(0);
    })
    .catch(() => {
      // Keep the local snapshot; focus/online events will retry when the service recovers.
    })
    .finally(() => {
      listeningStatsSyncPromise = undefined;
    });
  return listeningStatsSyncPromise;
}

function handleListeningStatsReconnect() {
  void syncListeningStats();
}

function queueListeningStatsSave(snapshot: ListeningStatsState) {
  listeningStatsSaveChain = listeningStatsSaveChain
    .catch(() => undefined)
    .then(() => saveListeningStats(snapshot))
    .then(() => undefined)
    .catch((error) => {
      if (error instanceof ApiRequestError && error.status === 409) {
        void syncListeningStats();
      }
      // localStorage remains the durable fallback while the Java service is offline.
    });
}

function resetListeningSample() {
  listeningSampleTrackId = undefined;
  listeningSampleTime = undefined;
}

function qqListeningAccountForTrack(track: Track) {
  if (track.source !== "qq" || !track.id.startsWith("qq:")) return undefined;
  return accounts.value.find((candidate) => candidate.provider === "qq");
}

function scheduleQqListeningRetry() {
  if (qqListeningRetryTimer !== undefined) return;
  qqListeningRetryTimer = window.setTimeout(() => {
    qqListeningRetryTimer = undefined;
    for (const sessionId of qqListeningSessions.keys()) {
      void flushQqListeningSession(sessionId !== activeQqListeningSessionId, sessionId);
    }
  }, 5_000);
}

async function flushQqListeningSession(force = false, sessionId = activeQqListeningSessionId) {
  if (sessionId === undefined) return;
  const existingFlush = qqListeningFlushes.get(sessionId);
  if (existingFlush) {
    if (force) {
      await existingFlush;
      return flushQqListeningSession(true, sessionId);
    }
    return;
  }
  const currentSession = qqListeningSessions.get(sessionId);
  if (!currentSession) return;
  const prepared = prepareQqListeningFlush(currentSession, force);
  qqListeningSessions.set(sessionId, prepared.session);
  if (!prepared.payload) {
    if (
      sessionId !== activeQqListeningSessionId
      && prepared.session.pendingSeconds <= 0
      && prepared.session.pendingPlayCount === 0
      && !prepared.session.inFlight
    ) {
      qqListeningSessions.delete(sessionId);
    }
    return;
  }

  const operation = (async () => {
    try {
      await reportQqListeningDelta(prepared.payload!);
      if (accounts.value.some(account => account.provider === "qq" && account.userId === prepared.payload!.accountId)) {
        streamingHomeCache.clear("qq");
      }
      const latest = qqListeningSessions.get(sessionId);
      if (latest) qqListeningSessions.set(sessionId, acknowledgeQqListeningFlush(latest));
    } catch {
      const latest = qqListeningSessions.get(sessionId);
      if (latest) qqListeningSessions.set(sessionId, failQqListeningFlush(latest));
      scheduleQqListeningRetry();
    }
  })();
  qqListeningFlushes.set(sessionId, operation);
  await operation;
  if (qqListeningFlushes.get(sessionId) === operation) {
    qqListeningFlushes.delete(sessionId);
  }

  const latest = qqListeningSessions.get(sessionId);
  if (!latest) return;
  if (sessionId !== activeQqListeningSessionId) {
    if (latest.pendingSeconds > 0 || latest.pendingPlayCount > 0) {
      if (!qqListeningRetryTimer) await flushQqListeningSession(true, sessionId);
    } else {
      qqListeningSessions.delete(sessionId);
    }
  } else if (latest.pendingSeconds >= 15 || latest.pendingPlayCount > 0) {
    void flushQqListeningSession(false, sessionId);
  }
}

function finishQqListeningSession(clearCloudSession = true) {
  if (clearCloudSession) qqRecentPlaybackSession = undefined;
  const sessionId = activeQqListeningSessionId;
  if (sessionId === undefined) return Promise.resolve();
  const session = qqListeningSessions.get(sessionId);
  if (session) qqListeningSessions.set(sessionId, pauseQqListeningSession(session));
  activeQqListeningSessionId = undefined;
  return flushQqListeningSession(true, sessionId);
}

function ensureQqListeningSession(track: Track, mediaTime?: number) {
  const account = qqListeningAccountForTrack(track);
  if (!account) {
    void finishQqListeningSession();
    return undefined;
  }
  const accountId = account.userId;

  const activeSession = activeQqListeningSessionId === undefined
    ? undefined
    : qqListeningSessions.get(activeQqListeningSessionId);
  if (!activeSession || activeSession.accountId !== accountId || activeSession.track.id !== track.id) {
    void finishQqListeningSession(false);
    const sessionId = ++qqListeningSessionSerial;
    activeQqListeningSessionId = sessionId;
    qqListeningSessions.set(sessionId, createQqListeningSession(
      accountId,
      toPersistedTrack(track),
      account.nickname,
      account.avatarUrl
    ));
  }

  const sessionId = activeQqListeningSessionId;
  // Local-stat flushes and deletion must not restart the actual cloud playback.
  if (!qqRecentPlaybackSession || qqRecentPlaybackSession.accountId !== accountId
    || qqRecentPlaybackSession.track.id !== track.id) {
    qqRecentPlaybackSession = createQqListeningSession(accountId, toPersistedTrack(track));
  }
  if (sessionId !== undefined && Number.isFinite(mediaTime)) {
    qqRecentPlaybackSession = sampleQqListeningPlayback(qqRecentPlaybackSession, Number(mediaTime), performance.now());
    const session = qqListeningSessions.get(sessionId);
    if (session) {
      qqListeningSessions.set(
        sessionId,
        sampleQqListeningPlayback(session, Number(mediaTime), performance.now())
      );
    }
  }
  return sessionId;
}

function pauseCurrentQqListeningSession() {
  if (qqRecentPlaybackSession) qqRecentPlaybackSession = pauseQqListeningSession(qqRecentPlaybackSession);
  const sessionId = activeQqListeningSessionId;
  if (sessionId === undefined) return;
  const session = qqListeningSessions.get(sessionId);
  if (session) qqListeningSessions.set(sessionId, pauseQqListeningSession(session));
}

function recordCurrentQqListening(mediaTime: number) {
  if (!isPlaying.value || isSeeking.value || localSourceBusy.value) return;
  const sessionId = ensureQqListeningSession(currentTrack.value, mediaTime);
  if (sessionId !== undefined) {
    void reportCurrentQqRecentPlay();
    void flushQqListeningSession(false, sessionId);
  }
}

async function reportCurrentQqRecentPlay() {
  const session = qqRecentPlaybackSession;
  if (!session) return;
  const prepared = beginQqRecentPlayReport(session);
  qqRecentPlaybackSession = prepared.session;
  if (!prepared.payload) return;
  try {
    const result = await reportQqRecentPlay(prepared.payload);
    if (qqRecentPlaybackSession?.recentReportSessionId === prepared.payload.sessionId) {
      qqRecentPlaybackSession = { ...qqRecentPlaybackSession, recentReportStatus: "reported" };
    }
    if (selectedStreamingAccount.value?.provider === "qq"
      && selectedStreamingAccount.value.userId === prepared.payload.accountId) {
      accountRecentRevision += 1;
      accountRecentTracks.value = result.tracks.map(toTrack).filter((track): track is Track => Boolean(track));
    }
  } catch (error) {
    if (qqRecentPlaybackSession?.recentReportSessionId === prepared.payload.sessionId) {
      qqRecentPlaybackSession = { ...qqRecentPlaybackSession, recentReportStatus: "failed" };
    }
    showSearchToast(error instanceof Error ? error.message : "QQ 最近播放同步失败，本次不会重复提交");
  }
}

function canScrobbleTrack(track: Track) {
  return track.source === "netease"
    && track.id.startsWith("netease:")
    && track.duration > 0
    && accounts.value.some((candidate) => candidate.provider === "netease");
}

function startListeningScrobbleSession(track: Track) {
  listeningScrobbleSession = canScrobbleTrack(track)
    ? createScrobbleSession(++listeningScrobbleSessionSerial, track.id)
    : undefined;
}

function resetCurrentScrobbleSample() {
  if (listeningScrobbleSession) {
    listeningScrobbleSession = resetScrobbleSample(listeningScrobbleSession);
  }
}

function recordCurrentTrackScrobble(mediaTime: number) {
  const track = currentTrack.value;
  if (!canScrobbleTrack(track)) {
    listeningScrobbleSession = undefined;
    return;
  }
  if (
    !isPlaying.value
    || !listeningScrobbleSession
    || listeningScrobbleSession.trackId !== track.id
  ) {
    resetCurrentScrobbleSample();
    return;
  }

  listeningScrobbleSession = sampleScrobblePlayback(listeningScrobbleSession, mediaTime);
  const report = beginScrobbleReport(listeningScrobbleSession);
  listeningScrobbleSession = report.session;
  if (!report.shouldReport) {
    return;
  }

  const sessionId = report.session.sessionId;
  const listenedSeconds = Math.max(30, Math.floor(report.session.listenedSeconds));
  void reportListeningScrobble("netease", {
    trackId: track.id,
    title: track.title,
    artist: track.artist,
    listenedSeconds,
    totalSeconds: Math.max(1, Math.round(track.duration))
  }).then(() => {
    if (listeningScrobbleSession?.sessionId === sessionId) {
      listeningScrobbleSession = { ...listeningScrobbleSession, status: "reported" };
    }
  }).catch(() => {
    if (listeningScrobbleSession?.sessionId === sessionId) {
      listeningScrobbleSession = { ...listeningScrobbleSession, status: "failed" };
    }
  });
}

function recordCurrentTrackPlayStart(track: Track) {
  if (!isLocalLibraryTrack(track)) {
    resetListeningSample();
    return;
  }
  listeningStats.value = recordListeningPlay(listeningStats.value, track.id);
  persistListeningStats(0);
}

function recordCurrentTrackListening(mediaTime: number) {
  const track = currentTrack.value;
  if (!isPlaying.value || !isLocalLibraryTrack(track) || !Number.isFinite(mediaTime)) {
    resetListeningSample();
    return;
  }

  if (listeningSampleTrackId !== track.id || listeningSampleTime === undefined || mediaTime < listeningSampleTime) {
    listeningSampleTrackId = track.id;
    listeningSampleTime = mediaTime;
    return;
  }

  const delta = mediaTime - listeningSampleTime;
  if (delta < 0.75) {
    return;
  }
  if (delta > 6) {
    listeningSampleTime = mediaTime;
    return;
  }

  listeningStats.value = addListeningSeconds(listeningStats.value, track.id, delta);
  listeningSampleTime = mediaTime;
  persistListeningStats();
}

function persistPlaybackState() {
  const state: PlaybackState = {
    trackId: currentTrack.value?.id === DEFAULT_TRACK_ID ? null : currentTrack.value?.id ?? null,
    positionSeconds: desktopIntegrationPreferences.value.rememberPlaybackPosition
      ? currentPlaybackPosition()
      : 0,
    volume: volume.value,
    playMode: playMode.value
  };
  lastPlaybackStateSaveSecond = state.positionSeconds;
  stateSaveChain = stateSaveChain
    .catch(() => undefined)
    .then(() => savePlaybackState(state))
    .then(() => undefined)
    .catch(() => {
      // The player remains usable while the local Java service is offline.
    });
  return stateSaveChain;
}

function schedulePlaybackStateSave(delay = 250) {
  if (playbackStateSaveTimer) {
    window.clearTimeout(playbackStateSaveTimer);
  }
  playbackStateSaveTimer = window.setTimeout(() => {
    playbackStateSaveTimer = undefined;
    void persistPlaybackState();
  }, delay);
}

async function recordPlayedTrack(track: Track) {
  const historyTrack = { ...track, history: true };
  historyTracks.value = [
    historyTrack,
    ...historyTracks.value.filter((item) => item.id !== track.id)
  ].slice(0, 100);
  currentTrack.value.history = true;
  try {
    await recordHistory(toPersistedTrack(historyTrack));
  } catch {
    scanError.value = "最近播放暂时无法保存，请确认后端已启动。";
  }
}

function normalizeTrackText(value: string | undefined) {
  return (value ?? "")
    .toLocaleLowerCase()
    .replace(/\s+/gu, "")
    .replace(/[·・,/\\|，、：:()[\]{}]/gu, "");
}

function findLocalLyricFallback(track: Track) {
  const title = normalizeTrackText(track.title);
  const artist = normalizeTrackText(track.artist);
  if (!title) {
    return undefined;
  }

  const candidates = currentLibrary.value.filter((candidate) => {
    return candidate.source === "local"
      && normalizeTrackText(candidate.title) === title
      && Boolean(candidate.lyrics?.trim());
  });
  return candidates.find((candidate) => {
    const candidateArtist = normalizeTrackText(candidate.artist);
    return !artist
      || artist === "未知歌手"
      || candidateArtist === "未知歌手"
      || artist.includes(candidateArtist)
      || candidateArtist.includes(artist);
  }) ?? candidates[0];
}

async function loadOnlineTrackAssets(track: Track, preparedNetworkAudioUrl?: string) {
  if (track.source === "cloud") {
    let cloudLyrics: Awaited<ReturnType<typeof loadCloudLyrics>> | null = null;
    try {
      cloudLyrics = await loadCloudLyrics(track.id);
    } catch {
      // A cloud file may legitimately have no embedded LYRICS metadata.
    }
    const cloudLyricCredits = cloudLyrics?.credits;
    const localLyricFallback = cloudLyrics?.lyrics?.trim()
      ? undefined
      : findLocalLyricFallback(track);
    return {
      ...track,
      lyrics: cloudLyrics?.lyrics ?? localLyricFallback?.lyrics ?? track.lyrics,
      lyricsTranslation: cloudLyrics?.translation
        ?? localLyricFallback?.lyricsTranslation
        ?? track.lyricsTranslation,
      lyricsPhonetic: cloudLyrics?.phonetic
        ?? localLyricFallback?.lyricsPhonetic
        ?? track.lyricsPhonetic,
      lyricsFormat: cloudLyrics?.format
        ?? localLyricFallback?.lyricsFormat
        ?? track.lyricsFormat,
      lyricsSource: cloudLyrics?.source
        ?? (localLyricFallback?.lyrics ? "local" : track.lyricsSource),
      lyricCredits: cloudLyricCredits?.length
        ? normalizeLyricCredits(cloudLyricCredits)
        : localLyricFallback?.lyricCredits ?? track.lyricCredits,
      hasLyrics: Boolean(cloudLyrics?.lyrics ?? localLyricFallback?.lyrics ?? track.lyrics)
    };
  }
  if (track.source !== "netease" && track.source !== "qq") {
    return track;
  }

  const [detailResult, lyricsResult] = await Promise.allSettled([
    loadCatalogTrack(track.id),
    loadCatalogLyrics(track.id)
  ]);
  const detail = detailResult.status === "fulfilled" ? toTrack(detailResult.value, 0) : null;
  const lyrics = lyricsResult.status === "fulfilled" ? lyricsResult.value : null;
  const onlineLyrics = lyrics?.lyrics?.trim()
    ? lyrics
    : detail?.lyrics?.trim()
      ? {
          lyrics: detail.lyrics,
          translation: detail.lyricsTranslation,
          phonetic: detail.lyricsPhonetic,
          format: detail.lyricsFormat,
          source: detail.lyricsSource,
          credits: detail.lyricCredits
        }
      : null;
  const localLyricFallback = onlineLyrics ? undefined : findLocalLyricFallback(track);
  const proxyCoverUrl = `/catalog/tracks/${encodeURIComponent(track.id)}/cover`;
  const primaryCoverUrl = detail?.coverUrl ?? track.coverUrl ?? proxyCoverUrl;
  const networkAudioUrl = preparedNetworkAudioUrl ?? applyOnlineAudioCachePolicy(
    loadCatalogAudio(track.id, requestedPlaybackQuality(track)),
    onlineAudioCachePolicy.value
  );
  const resolvedTrack: Track = {
    ...track,
    ...(detail ?? {}),
    id: track.id,
    liked: favoriteTracks.value.some((favorite) => favorite.id === track.id)
      || accountFavoriteTracks.value.some((favorite) => favorite.id === track.id),
    audioUrl: networkAudioUrl,
    coverUrl: primaryCoverUrl,
    coverFallbackUrl: detail?.coverFallbackUrl
      ?? track.coverFallbackUrl
      ?? (primaryCoverUrl === proxyCoverUrl ? undefined : proxyCoverUrl),
    lyrics: onlineLyrics?.lyrics ?? localLyricFallback?.lyrics ?? track.lyrics,
    lyricsTranslation: onlineLyrics?.translation
      ?? localLyricFallback?.lyricsTranslation
      ?? track.lyricsTranslation,
    lyricsPhonetic: onlineLyrics?.phonetic
      ?? localLyricFallback?.lyricsPhonetic
      ?? track.lyricsPhonetic,
    lyricsFormat: onlineLyrics?.format
      ?? localLyricFallback?.lyricsFormat
      ?? track.lyricsFormat,
    lyricsSource: onlineLyrics?.source
      ?? (localLyricFallback?.lyrics ? "local" : track.lyricsSource),
    lyricCredits: onlineLyrics?.credits?.length
      ? normalizeLyricCredits(onlineLyrics.credits)
      : localLyricFallback?.lyricCredits ?? track.lyricCredits,
    hasLyrics: Boolean(onlineLyrics?.lyrics ?? localLyricFallback?.lyrics ?? track.lyrics),
    hasCover: Boolean(detail?.coverUrl ?? track.coverUrl)
  };

  if (!preferLocalDownloadPlayback.value || !networkAudioUrl) {
    return resolvedTrack;
  }
  const localPlaybackTrack = selectPreferredLocalPlaybackTrack(resolvedTrack, remoteTracks.value);
  if (!localPlaybackTrack?.audioUrl) {
    return resolvedTrack;
  }
  return {
    ...resolvedTrack,
    audioUrl: localPlaybackTrack.audioUrl,
    preferredLocalPlayback: true,
    playbackFallbackUrl: networkAudioUrl,
    playbackFormat: localPlaybackFormat(localPlaybackTrack)
  };
}

async function refreshAccountsAfterPlaybackFailure(track: Track) {
  const provider: AccountProvider | null = track.source === "qq"
    ? "qq"
    : track.source === "netease" ? "netease" : null;
  if (!provider) {
    return false;
  }

  try {
    const refreshedAccounts = await loadCurrentAccounts();
    accounts.value = refreshedAccounts;
    refreshedAccounts.forEach((currentAccount) => {
      setPageDataCacheAccountScope(currentAccount.provider, currentAccount.userId);
    });
    account.value = refreshedAccounts.find((candidate) => candidate.provider === "netease") ?? null;
    if (!refreshedAccounts.some((candidate) => candidate.provider === provider)) {
      scanError.value = `${provider === "qq" ? "QQ 音乐" : "网易云音乐"}登录已失效，请重新登录。`;
      openProviderAuthPanel(provider);
      return true;
    }
  } catch {
    // Keep the playback error when account state cannot be refreshed.
  }
  return false;
}

function getRemainingPlaybackSeconds(audio: HTMLAudioElement) {
  const duration = Number.isFinite(audio.duration) && audio.duration > 0
    ? audio.duration
    : currentTrack.value.duration;
  return Math.max(0, duration - audio.currentTime);
}

async function fadeAudioVolume(
  audio: HTMLAudioElement,
  targetVolume: () => number,
  durationMs: number,
  transitionToken: number,
  direction: "in" | "out"
) {
  const startVolume = audio.volume;
  const startTime = performance.now();
  activePlaybackFade = direction;

  if (durationMs <= 0) {
    audio.volume = targetVolume();
    if (transitionToken === playbackFadeToken) {
      activePlaybackFade = null;
    }
    return transitionToken === playbackFadeToken;
  }

  while (transitionToken === playbackFadeToken) {
    const progress = Math.min(1, (performance.now() - startTime) / durationMs);
    audio.volume = interpolateFadeVolume(startVolume, targetVolume(), progress);
    if (progress >= 1) {
      activePlaybackFade = null;
      return true;
    }
    await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
  }

  if (transitionToken === playbackFadeToken) {
    activePlaybackFade = null;
  }
  return false;
}

function createNetworkFallbackTrack(track: Track) {
  if (!track.preferredLocalPlayback || !track.playbackFallbackUrl) {
    return undefined;
  }
  return {
    ...track,
    audioUrl: track.playbackFallbackUrl,
    preferredLocalPlayback: false,
    playbackFallbackUrl: undefined,
    playbackFormat: undefined
  } satisfies Track;
}

type ImmediatePlaybackResult =
  | { played: true }
  | { played: false; error: unknown };

type ImmediatePlaybackAttempt = {
  audio: HTMLAudioElement;
  source: string;
  track: Track;
  networkAudioUrl?: string;
  result: Promise<ImmediatePlaybackResult>;
};

function startOnlinePlaybackBeforeAssetLoad(track: Track, initialVolume: number): ImmediatePlaybackAttempt | undefined {
  const audio = audioElement.value;
  if (!audio || !track.source || !["cloud", "netease", "qq"].includes(track.source)) return undefined;

  const networkAudioUrl = track.source === "netease" || track.source === "qq"
    ? applyOnlineAudioCachePolicy(
        loadCatalogAudio(track.id, requestedPlaybackQuality(track)),
        onlineAudioCachePolicy.value
      )
    : undefined;
  const networkTrack: Track = networkAudioUrl ? { ...track, audioUrl: networkAudioUrl } : track;
  const localPlaybackTrack = preferLocalDownloadPlayback.value && networkAudioUrl
    ? selectPreferredLocalPlaybackTrack(networkTrack, remoteTracks.value)
    : undefined;
  const immediateTrack: Track = localPlaybackTrack?.audioUrl
    ? {
        ...networkTrack,
        audioUrl: localPlaybackTrack.audioUrl,
        preferredLocalPlayback: true,
        playbackFallbackUrl: networkAudioUrl,
        playbackFormat: localPlaybackFormat(localPlaybackTrack)
      }
    : networkTrack;
  if (!immediateTrack.audioUrl) return undefined;

  currentTrack.value = immediateTrack;
  prepareAudioSource(immediateTrack);
  audio.volume = initialVolume;
  const source = audio.src;
  const result = audio.play().then<ImmediatePlaybackResult, ImmediatePlaybackResult>(
    () => ({ played: true }),
    (error: unknown) => ({ played: false, error })
  );
  return { audio, source, track: immediateTrack, networkAudioUrl, result };
}

async function playAudioWithNetworkFallback(
  audio: HTMLAudioElement,
  track: Track,
  initialVolume: number,
  fallbackImmediately = false
) {
  if (!fallbackImmediately) {
    audio.volume = initialVolume;
    try {
      await audio.play();
      return track;
    } catch (error) {
      if (!track.preferredLocalPlayback) {
        throw error;
      }
    }
  }

  const fallbackTrack = createNetworkFallbackTrack(track);
  if (!fallbackTrack) {
    throw new Error("没有可用的网络回退地址");
  }
  currentTrack.value = fallbackTrack;
  prepareAudioSource(fallbackTrack);
  audio.volume = initialVolume;
  await audio.play();
  return fallbackTrack;
}

async function handlePlaybackStartFailure(audio: HTMLAudioElement, track: Track) {
  audio.volume = volume.value / 100;
  activePlaybackFade = null;
  isPlaybackStarting.value = false;
  isPlaying.value = false;
  const loginExpired = await refreshAccountsAfterPlaybackFailure(track);
  if (!loginExpired) {
    scanError.value = track.source === "netease"
      ? "网易云音频暂时无法播放，可能是版权或地区限制，请换一首歌曲。"
      : "音频无法播放，请确认后端正在运行。";
  }
}

async function playTrack(track: Track, options: PlayTrackOptions = {}) {
  const previousAudio = audioElement.value;
  if (previousAudio && !previousAudio.paused) recordCurrentQqListening(previousAudio.currentTime);
  void finishQqListeningSession();
  isPlaybackStarting.value = true;
  const transitionToken = options.transitionToken;
  if (transitionToken === undefined) {
    playbackFadeToken += 1;
    activePlaybackFade = null;
  } else if (transitionToken !== playbackFadeToken) {
    isPlaybackStarting.value = false;
    return;
  }
  const requestId = ++trackAssetRequestId;
  localLyricsMatchRequestId += 1;
  localLyricsMatchPending.value = false;
  resetLocalSourceState();
  stopPlaybackClock();
  isPlaying.value = false;
  scanError.value = "";
  audioElement.value?.pause();
  const queueTrack = ensureTrackQueue(track);
  manualLyricsScroll.value = false;
  lastAutoFollowItemId = "";
  currentTrack.value = queueTrack;
  localLyricsMatchNotice.value = describeLocalLyricsState(queueTrack);
  progress.value = 0;
  pendingSeekTime = undefined;
  currentTime.value = 0;
  mediaDuration.value = undefined;
  lyricClockTime = 0;
  resetLyricHighlightDom();
  currentCoverFailedKey.value = "";
  currentCoverFallbackActive.value = false;
  loadTrackLyrics(queueTrack);

  const shouldFadeIn = Boolean(options.fadeIn && playbackFadeEnabled.value && transitionToken !== undefined);
  const initialVolume = shouldFadeIn ? 0 : volume.value / 100;
  const immediatePlayback = startOnlinePlaybackBeforeAssetLoad(queueTrack, initialVolume);
  const playbackTrack = await loadOnlineTrackAssets(queueTrack, immediatePlayback?.networkAudioUrl);
  if (requestId !== trackAssetRequestId) {
    return;
  }
  currentTrack.value = playbackTrack;
  loadTrackLyrics(playbackTrack);
  if (shouldAutoMatchLocalLyrics(playbackTrack)) {
    void matchLocalLyrics(playbackTrack, true, requestId);
  }
  void nextTick(async () => {
    if (requestId !== trackAssetRequestId || (transitionToken !== undefined && transitionToken !== playbackFadeToken)) {
      return;
    }
    const audio = audioElement.value;
    if (!audio || !playbackTrack.audioUrl) {
      isPlaybackStarting.value = false;
      isPlaying.value = false;
      scanError.value = playbackTrack.source === "netease"
        ? "网易云暂时没有可播放地址，请换一首歌曲。"
        : "这首歌没有可播放地址。";
      return;
    }
    let activePlaybackTrack = playbackTrack;
    try {
      const playbackSource = resolveBackendUrl(playbackTrack.id === localAudioOwnerId.value && localAudioOverride.value
        ? localAudioOverride.value
        : playbackTrack.audioUrl);
      const canReuseImmediatePlayback = immediatePlayback?.audio === audio
        && immediatePlayback.source === playbackSource;
      if (canReuseImmediatePlayback) {
        const immediateResult = await immediatePlayback.result;
        if (!immediateResult.played) {
          if (!playbackTrack.preferredLocalPlayback) {
            await handlePlaybackStartFailure(audio, activePlaybackTrack);
            return;
          }
          activePlaybackTrack = await playAudioWithNetworkFallback(audio, playbackTrack, initialVolume, true);
        }
      } else {
        prepareAudioSource(playbackTrack);
        activePlaybackTrack = await playAudioWithNetworkFallback(audio, playbackTrack, initialVolume);
      }
      if (requestId !== trackAssetRequestId) return;
      currentTrack.value = activePlaybackTrack;
      playbackClock.reset(audio, performance.now());
      isPlaying.value = true;
      isPlaybackStarting.value = false;
      scanError.value = "";
      startPlaybackClock();
      startListeningScrobbleSession(activePlaybackTrack);
      ensureQqListeningSession(activePlaybackTrack, audio.currentTime);
      recordCurrentTrackPlayStart(activePlaybackTrack);
      void recordPlayedTrack(activePlaybackTrack);
      void persistPlaybackState();
      if (shouldFadeIn && transitionToken !== undefined) {
        const availableSeconds = Number.isFinite(audio.duration) && audio.duration > 0
          ? audio.duration
          : activePlaybackTrack.duration;
        const fadeDuration = boundFadeDurationMs(playbackFadeDurationMs.value, availableSeconds);
        void fadeAudioVolume(audio, () => volume.value / 100, fadeDuration, transitionToken, "in");
      }
    } catch {
      await handlePlaybackStartFailure(audio, activePlaybackTrack);
    }
  });
}

async function playPlaylist(playlist: Playlist) {
  if (playlist.id === "favorites") {
    const firstTrack = favoriteTracks.value[0];
    if (firstTrack) {
      void playTrack(firstTrack);
    }
    return;
  }
  if (playlist.id === "account-favorites") {
    const firstTrack = accountFavoriteTracks.value[0];
    if (firstTrack) {
      void playTrack(firstTrack);
    }
    return;
  }
  if (playlist.id === "local") {
    const firstTrack = currentLibrary.value[0];
    if (firstTrack) {
      void playTrack(firstTrack);
    }
    return;
  }

  await selectPlaylist(playlist);
  if (playlistState.value === "success" && catalogResults.value[0]) {
    void playTrack(catalogResults.value[0]);
  }
}

function togglePlayback() {
  if (localSourceBusy.value) return;
  const audio = audioElement.value;
  if (!audio || !currentTrack.value.audioUrl) {
    isPlaying.value = !isPlaying.value;
    return;
  }
  if (audio.paused) {
    const restartingEndedTrack = audio.ended;
    prepareAudioSource(currentTrack.value);
    void audio.play().then(() => {
      playbackClock.reset(audio, performance.now());
      isPlaying.value = true;
      if (restartingEndedTrack || !listeningScrobbleSession) {
        startListeningScrobbleSession(currentTrack.value);
      }
      ensureQqListeningSession(currentTrack.value, audio.currentTime);
      startPlaybackClock();
      recordCurrentTrackPlayStart(currentTrack.value);
      void recordPlayedTrack(currentTrack.value);
      void persistPlaybackState();
    });
  } else {
    audio.pause();
    resetPlaybackClock();
    resetListeningSample();
    resetCurrentScrobbleSample();
    pauseCurrentQqListeningSession();
    void flushQqListeningSession(true);
    isPlaying.value = false;
    stopPlaybackClock();
    void persistPlaybackState();
  }
}

function clearSleepTimerHandles() {
  if (sleepTimerTimeout !== undefined) window.clearTimeout(sleepTimerTimeout);
  if (sleepTimerInterval !== undefined) window.clearInterval(sleepTimerInterval);
  sleepTimerTimeout = undefined;
  sleepTimerInterval = undefined;
}

function setSleepTimer(minutes: number) {
  const preset = normalizeSleepTimerMinutes(minutes);
  clearSleepTimerHandles();
  sleepTimerPreset.value = preset;
  sleepTimerEndsAt.value = null;
  sleepTimerRemainingSeconds.value = 0;
  if (preset === 0) return;

  sleepTimerEndsAt.value = Date.now() + preset * 60_000;
  const updateRemaining = () => {
    sleepTimerRemainingSeconds.value = calculateSleepTimerRemainingSeconds(sleepTimerEndsAt.value);
  };
  updateRemaining();
  sleepTimerInterval = window.setInterval(updateRemaining, 1_000);
  sleepTimerTimeout = window.setTimeout(() => {
    clearSleepTimerHandles();
    sleepTimerPreset.value = 0;
    sleepTimerEndsAt.value = null;
    sleepTimerRemainingSeconds.value = 0;
    if (isPlaying.value) togglePlayback();
  }, preset * 60_000);
}

function toggleOnboardingSleepTimer() {
  setSleepTimer(sleepTimerRemainingSeconds.value > 0 ? 0 : 30);
}

async function transitionToTrack(track: Track) {
  const transitionToken = ++playbackFadeToken;
  const audio = audioElement.value;
  if (playbackFadeEnabled.value && audio && !audio.paused && !audio.ended) {
    const fadeDuration = boundFadeDurationMs(
      playbackFadeDurationMs.value,
      getRemainingPlaybackSeconds(audio)
    );
    const completed = await fadeAudioVolume(audio, () => 0, fadeDuration, transitionToken, "out");
    if (!completed || transitionToken !== playbackFadeToken) {
      return;
    }
  }
  await playTrack(track, { fadeIn: true, transitionToken });
}

function previousTrack() {
  const tracks = getPlaybackQueue();
  if (!tracks.length) {
    return;
  }
  const index = findCurrentQueueIndex();
  const previousIndex = playMode.value === "shuffle"
    ? (tracks.length > 1
      ? (() => {
          let candidate = Math.floor(Math.random() * tracks.length);
          while (candidate === index) {
            candidate = Math.floor(Math.random() * tracks.length);
          }
          return candidate;
        })()
      : index)
    : (index - 1 + tracks.length) % tracks.length;
  const previous = tracks[previousIndex];
  if (previous) {
    void transitionToTrack(previous);
  }
}

function nextTrack() {
  const tracks = getPlaybackQueue();
  if (!tracks.length) {
    return;
  }
  const index = findCurrentQueueIndex();
  const nextIndex = playMode.value === "shuffle"
    ? (tracks.length > 1
      ? (() => {
          let candidate = Math.floor(Math.random() * tracks.length);
          while (candidate === index) {
            candidate = Math.floor(Math.random() * tracks.length);
          }
          return candidate;
        })()
      : index)
    : (index + 1) % tracks.length;
  const next = tracks[nextIndex];
  if (next) {
    void transitionToTrack(next);
  }
}

const mediaSessionActions: MediaSessionAction[] = [
  "play", "pause", "previoustrack", "nexttrack", "seekto", "seekbackward", "seekforward", "stop"
];

function setMediaSessionAction(action: MediaSessionAction, handler: MediaSessionActionHandler | null) {
  try {
    navigator.mediaSession.setActionHandler(action, handler);
  } catch {
    // Older Chromium versions may not support every Media Session action.
  }
}

function syncSystemMediaControls() {
  if (!("mediaSession" in navigator)) return;
  if (!desktopIntegrationPreferences.value.systemMediaControls) {
    mediaSessionActions.forEach((action) => setMediaSessionAction(action, null));
    navigator.mediaSession.metadata = null;
    navigator.mediaSession.playbackState = "none";
    return;
  }

  setMediaSessionAction("play", () => { if (!isPlaying.value) togglePlayback(); });
  setMediaSessionAction("pause", () => { if (isPlaying.value) togglePlayback(); });
  setMediaSessionAction("previoustrack", previousTrack);
  setMediaSessionAction("nexttrack", nextTrack);
  setMediaSessionAction("seekto", (details) => {
    if (typeof details.seekTime !== "number" || playbackDuration.value <= 0) return;
    seekPlayback((details.seekTime / playbackDuration.value) * 100);
  });
  setMediaSessionAction("seekbackward", (details) => {
    const target = Math.max(0, currentPlaybackPosition() - (details.seekOffset ?? 10));
    if (playbackDuration.value > 0) seekPlayback((target / playbackDuration.value) * 100);
  });
  setMediaSessionAction("seekforward", (details) => {
    const target = Math.min(playbackDuration.value, currentPlaybackPosition() + (details.seekOffset ?? 10));
    if (playbackDuration.value > 0) seekPlayback((target / playbackDuration.value) * 100);
  });
  setMediaSessionAction("stop", () => {
    if (isPlaying.value) togglePlayback();
    seekPlayback(0);
  });

  const artwork = currentTrack.value.coverUrl ? [{ src: currentTrack.value.coverUrl }] : undefined;
  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: currentTrack.value.title,
      artist: currentTrack.value.artist,
      album: currentTrack.value.album,
      artwork
    });
  } catch {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: currentTrack.value.title,
      artist: currentTrack.value.artist,
      album: currentTrack.value.album
    });
  }
  navigator.mediaSession.playbackState = isPlaying.value ? "playing" : "paused";
  syncSystemMediaPosition();
}

function syncSystemMediaPosition() {
  if (!("mediaSession" in navigator) || !desktopIntegrationPreferences.value.systemMediaControls) return;
  const duration = playbackDuration.value;
  if (!Number.isFinite(duration) || duration <= 0) return;
  try {
    navigator.mediaSession.setPositionState({
      duration,
      playbackRate: audioElement.value?.playbackRate || 1,
      position: Math.min(duration, Math.max(0, currentPlaybackPosition()))
    });
  } catch {
    // Media Session position is supplemental; playback remains available without it.
  }
}

function handleTaskbarMediaAction(action: "previous" | "toggle" | "next") {
  switch (action) {
    case "previous":
      previousTrack();
      break;
    case "toggle":
      togglePlayback();
      break;
    case "next":
      nextTrack();
      break;
  }
}

function handleDesktopLyricsAction(action: DesktopLyricsAction) {
  if (action === "cycle-mode") {
    cyclePlayerBarPlayMode();
    return;
  }
  handleTaskbarMediaAction(action);
}

function handleShortcutAction(action: ShortcutAction) {
  switch (action) {
    case "toggle": case "previous": case "next":
      handleTaskbarMediaAction(action);
      break;
    case "volume-up":
      updateVolume(Math.min(100, volume.value + 5));
      break;
    case "volume-down":
      updateVolume(Math.max(0, volume.value - 5));
      break;
    case "cycle-mode":
      cyclePlayerBarPlayMode();
      break;
    case "favorite":
      if (currentTrack.value.id !== DEFAULT_TRACK_ID) void toggleLiked();
      break;
  }
}

function handleTrayMediaAction(action: TrayMediaAction) {
  switch (action) {
    case "previous":
      previousTrack();
      break;
    case "toggle":
      togglePlayback();
      break;
    case "next":
      nextTrack();
      break;
    case "favorite":
      void toggleLiked();
      break;
    case "desktop-lyrics":
      toggleDesktopLyrics();
      break;
    case "mini-player":
      if (nativeMiniMode.value || miniPlayerVisible.value) {
        void closeMiniPlayer();
      } else {
        void openMiniPlayer();
      }
      break;
    case "settings":
      openSettingsPage();
      break;
    case "play-mode:sequence":
      selectPlayMode("sequence");
      break;
    case "play-mode:loop":
      selectPlayMode("loop");
      break;
    case "play-mode:single":
      selectPlayMode("single");
      break;
    case "play-mode:shuffle":
      selectPlayMode("shuffle");
      break;
  }
}

function playLocalHomeTrack() {
  const track = localHomeTrack.value;
  if (track.id === DEFAULT_TRACK_ID) {
    selectView("library");
    return;
  }
  if (track.id === currentTrack.value.id) {
    togglePlayback();
    return;
  }
  void playTrack(track);
}

function playRandomLocalTrack() {
  const tracks = playbackQueue.value.length > 0 ? playbackQueue.value : currentLibrary.value;
  if (tracks.length === 0) {
    selectView("library");
    return;
  }
  const candidates = tracks.length > 1
    ? tracks.filter((track) => track.id !== currentTrack.value.id)
    : tracks;
  const track = candidates[Math.floor(Math.random() * candidates.length)] ?? tracks[0];
  void playTrack(track);
}

function playAllLocalTracks() {
  const tracks = filteredLocalLibraryTracks.value;
  const firstTrack = tracks[0];
  if (!firstTrack) {
    scanNotice.value = "当前列表没有可播放歌曲。";
    return;
  }
  playbackQueue.value = tracks.map((track) => createQueueTrack(track));
  void persistPlaybackQueue();
  void playTrack(firstTrack);
}

function toggleLocalToolMenu(menu: "library" | "filter") {
  localToolMenuOpen.value = localToolMenuOpen.value === menu ? null : menu;
}

function closeLocalToolMenu() {
  localToolMenuOpen.value = null;
}

function handleLocalToolMenuPointerDown(event: PointerEvent) {
  const target = event.target;
  if (target instanceof Node && !localLibraryToolsRef.value?.contains(target)) {
    closeLocalToolMenu();
  }
}

function playRandomAllLocalTracks() {
  const tracks = [...filteredLocalLibraryTracks.value];
  if (!tracks.length) {
    scanNotice.value = "当前列表没有可随机播放的歌曲。";
    return;
  }
  const shuffled = tracks
    .map((track) => ({ track, order: Math.random() }))
    .sort((left, right) => left.order - right.order)
    .map((item) => item.track);
  playbackQueue.value = shuffled.map((track) => createQueueTrack(track));
  void persistPlaybackQueue();
  void playTrack(shuffled[0]);
}

function resetHistoryFilters() {
  historySearchKeyword.value = "";
  historySourceFilter.value = "all";
  historySortMode.value = "recent";
}

function playAllHistoryTracks() {
  const tracks = filteredHistoryTracks.value;
  if (!tracks.length) {
    return;
  }
  playbackQueue.value = tracks.map((track) => createQueueTrack(track));
  void persistPlaybackQueue();
  void playTrack(tracks[0]);
}

function playRandomHistoryTracks() {
  const tracks = [...filteredHistoryTracks.value];
  if (!tracks.length) {
    return;
  }
  const shuffled = tracks
    .map((track) => ({ track, order: Math.random() }))
    .sort((left, right) => left.order - right.order)
    .map((item) => item.track);
  playbackQueue.value = shuffled.map((track) => createQueueTrack(track));
  void persistPlaybackQueue();
  void playTrack(shuffled[0]);
}

function playHistoryTrack(track: Track) {
  playbackQueue.value = filteredHistoryTracks.value.map((item) => createQueueTrack(item));
  void persistPlaybackQueue();
  void playTrack(track);
}

function historyTracksById(trackIds: string[]) {
  const tracksById = new Map(historySourceTracks.value.map((track) => [track.id, track]));
  return trackIds.map((trackId) => tracksById.get(trackId)).filter((track): track is Track => Boolean(track));
}

function playHistoryTrackById(trackId: string) {
  const track = historySourceTracks.value.find((candidate) => candidate.id === trackId);
  if (!track) return;
  playbackQueue.value = historySourceTracks.value.map((item) => createQueueTrack(item));
  void persistPlaybackQueue();
  void playTrack(track);
}

function playHistoryTrackList(trackIds: string[]) {
  playStreamingLibraryTracks(historyTracksById(trackIds));
}

function playHistoryTrackListRandom(trackIds: string[]) {
  const tracks = historyTracksById(trackIds)
    .map((track) => ({ track, order: Math.random() }))
    .sort((left, right) => left.order - right.order)
    .map((item) => item.track);
  playStreamingLibraryTracks(tracks);
}

function toggleHistoryTrackFavorite(trackId: string) {
  const track = historySourceTracks.value.find((candidate) => candidate.id === trackId);
  if (track) void toggleTrackLiked(track);
}

function changeHistorySource(source: string) {
  if (source === "all" || source === "local" || source === "netease" || source === "qq") {
    historySourceFilter.value = source;
  }
}

async function refreshHistoryTracks() {
  if (historyRefreshing.value) return;
  historyRefreshing.value = true;
  try {
    invalidatePageDataCache((key) => key.includes("/library/history"));
    const result = await loadHistory();
    historyTracks.value = Array.isArray(result)
      ? result
        .map(toTrack)
        .filter((track): track is Track => Boolean(track))
        .map((track) => {
          const libraryTrack = remoteTracks.value.find((item) => item.id === track.id);
          return { ...track, ...libraryTrack, history: true };
        })
      : [];
  } catch (error) {
    scanError.value = error instanceof Error ? error.message : "最近播放刷新失败，请稍后重试。";
  } finally {
    historyRefreshing.value = false;
  }
}

function playLocalLibraryRow(track: Track) {
  localTrackContextMenu.value = null;
  playbackQueue.value = filteredLocalLibraryTracks.value.map((item) => createQueueTrack(item));
  void persistPlaybackQueue();
  void playTrack(track);
}

function toggleLocalTrackSelection(track: Track) {
  const next = new Set(selectedLocalTrackIds.value);
  if (next.has(track.id)) {
    next.delete(track.id);
  } else {
    next.add(track.id);
  }
  selectedLocalTrackIds.value = next;
}

function openTrackContextMenu(track: Track, event: MouseEvent, queue: Track[] = [track]) {
  event.preventDefault();
  localTrackContextMenu.value = {
    track,
    queue: queue.length ? queue : [track],
    x: Math.max(8, Math.min(event.clientX, window.innerWidth - 190)),
    y: Math.max(8, Math.min(event.clientY, window.innerHeight - 300))
  };
}

function openLocalTrackContextMenu(track: Track, event: MouseEvent) {
  openTrackContextMenu(track, event, filteredLocalLibraryTracks.value);
}

function openCloudTrackContextMenu(payload: { track: CloudTrackView; event: MouseEvent }) {
  const queue = cloudTracks.value.map((track, index) => toCloudPlaybackTrack(track, index));
  const track = queue.find((candidate) => candidate.id === payload.track.id)
    ?? toCloudPlaybackTrack(payload.track);
  openTrackContextMenu(track, payload.event, queue);
}

function closeLocalTrackContextMenu() {
  localTrackContextMenu.value = null;
}

function playContextMenuTrack() {
  const menu = localTrackContextMenu.value;
  if (!menu) return;
  playbackQueue.value = menu.queue.map((track) => createQueueTrack(track));
  const selectedTrack = playbackQueue.value.find((track) => track.id === menu.track.id)
    ?? createQueueTrack(menu.track);
  void persistPlaybackQueue();
  closeLocalTrackContextMenu();
  void playTrack(selectedTrack);
}

function playContextMenuTrackNext() {
  const menu = localTrackContextMenu.value;
  if (!menu) return;
  const currentIndex = findCurrentQueueIndex();
  const insertIndex = currentIndex >= 0 ? currentIndex + 1 : playbackQueue.value.length;
  const queuedTrack = createQueueTrack(menu.track);
  playbackQueue.value = [
    ...playbackQueue.value.slice(0, insertIndex),
    queuedTrack,
    ...playbackQueue.value.slice(insertIndex)
  ];
  void persistPlaybackQueue();
  scanNotice.value = `已将「${menu.track.title}」设为下一首播放。`;
  closeLocalTrackContextMenu();
}

async function toggleContextMenuTrackFavorite() {
  const track = localTrackContextMenu.value?.track;
  if (!track) return;
  closeLocalTrackContextMenu();
  await toggleTrackLiked(track);
}

function openTrackPlaylistPicker(track: Track, mode: TrackPlaylistPickerMode) {
  trackPlaylistPicker.value = { tracks: [track], mode };
  scanError.value = "";
  closeLocalTrackContextMenu();
}

function closeTrackPlaylistPicker() {
  trackPlaylistPicker.value = null;
}

async function addTrackToRegularPlaylist(playlist: Playlist) {
  const picker = trackPlaylistPicker.value;
  if (!picker || picker.mode !== "regular") {
    return;
  }
  const track = picker.tracks[0];
  if (!track) return;

  if (playlist.id === "favorites") {
    if (favoriteTracks.value.some((item) => item.id === track.id && item.source === track.source)) {
      scanNotice.value = `「${track.title}」已经在「${playlist.title}」中。`;
      closeTrackPlaylistPicker();
      return;
    }
    favoriteTracks.value = [{ ...track, liked: true }, ...favoriteTracks.value];
    syncFavoriteFlag(track.id, true);
    closeTrackPlaylistPicker();
    try {
      await saveFavorite(toPersistedTrack(track));
      scanNotice.value = `已将「${track.title}」加入「${playlist.title}」。`;
    } catch {
      favoriteTracks.value = favoriteTracks.value.filter((item) => item.id !== track.id || item.source !== track.source);
      syncFavoriteFlag(track.id, false);
      scanError.value = `无法将「${track.title}」加入「${playlist.title}」，请确认后端已启动。`;
    }
    return;
  }

  const tracks = localPlaylistTrackMap.value[playlist.id] ?? [];
  if (tracks.some((item) => item.id === track.id && item.source === track.source)) {
    scanNotice.value = `「${track.title}」已经在「${playlist.title}」中。`;
    closeTrackPlaylistPicker();
    return;
  }
  localPlaylistTrackMap.value = {
    ...localPlaylistTrackMap.value,
    [playlist.id]: [{ ...track }, ...tracks]
  };
  persistLocalPlaylists();
  scanNotice.value = `已将「${track.title}」加入「${playlist.title}」。`;
  closeTrackPlaylistPicker();
}

function aggregateSourceLabel(source: string | undefined) {
  if (source === "netease" || source === "ncm") {
    return "网易云音乐";
  }
  if (source === "qq" || source === "qqmusic") {
    return "QQ 音乐";
  }
  if (!source || source === "local") {
    return "本地音乐";
  }
  return source;
}

function addTrackToSelectedAggregatePlaylist(playlist: AggregatePlaylist) {
  const picker = trackPlaylistPicker.value;
  if (!picker || picker.mode !== "aggregate") {
    return;
  }
  const track = picker.tracks[0];
  if (!track) return;
  const source = track.source || "local";
  const aggregateTrack: AggregateTrackSource = {
    id: track.id,
    title: track.title,
    artist: track.artist,
    album: track.album,
    duration: track.duration,
    source,
    sourceLabel: aggregateSourceLabel(source),
    coverUrl: track.coverUrl,
    audioUrl: track.audioUrl,
    filePath: track.filePath
  };
  const result = addTrackToAggregatePlaylist(playlist, aggregateTrack);
  if (!result.added) {
    scanNotice.value = `「${track.title}」的这个音源已经在「${playlist.name}」中。`;
    closeTrackPlaylistPicker();
    return;
  }
  aggregatePlaylists.value = aggregatePlaylists.value.map((item) => (
    item.id === playlist.id ? result.playlist : item
  ));
  writeAggregatePlaylists(aggregatePlaylists.value);
  scanNotice.value = `已将「${track.title}」加入聚合歌单「${playlist.name}」。`;
  closeTrackPlaylistPicker();
}

async function addTracksToStreamingPlaylist(playlist: Playlist) {
  const picker = trackPlaylistPicker.value;
  const activeAccount = selectedStreamingAccount.value;
  if (!picker || picker.mode !== "streaming" || !activeAccount || playlistMutationPending.value) return;
  const tracks = picker.tracks.filter(track => track.source === activeAccount.provider);
  if (!tracks.length) return;
  playlistMutationPending.value = true;
  try {
    await addAccountPlaylistTracks(playlist.id, tracks.map(track => track.id), activeAccount.provider);
    try {
      const refreshed = await loadAccountPlaylists(activeAccount.provider);
      if (selectedStreamingAccount.value?.userId === activeAccount.userId) {
        accountPlaylists.value = toAccountPlaylistListWithOverrides(
          refreshed,
          activeAccount.provider === "qq" ? "qq" : "netease"
        );
      }
    } catch {
      accountPlaylists.value = accountPlaylists.value.map(item => item.id === playlist.id
        ? { ...item, imageUrl: item.imageUrl || tracks[0]?.coverUrl }
        : item);
    }
    scanNotice.value = `已将 ${tracks.length} 首歌曲加入「${playlist.title}」。`;
    closeTrackPlaylistPicker();
    invalidatePageDataCacheForProvider(activeAccount.provider);
  } catch (error) {
    scanError.value = error instanceof Error ? error.message : "批量加入歌单失败，请稍后重试。";
  } finally {
    playlistMutationPending.value = false;
  }
}

function openAggregatePageFromPicker() {
  closeTrackPlaylistPicker();
  selectView("aggregate");
}

function showLocalTrackFileHint(track: Track) {
  scanNotice.value = track.filePath ? `文件位置：${track.filePath}` : "这首歌暂无本地文件路径信息。";
  closeLocalTrackContextMenu();
}

async function toggleLiked() {
  await toggleTrackLiked(currentTrack.value);
}

async function toggleTrackLiked(track: Track) {
  if (favoriteMutationPending.has(track.id)) return;
  if (playlistMutationPending.value && track.source === "qq") return;
  if (track.id === DEFAULT_TRACK_ID) {
    return;
  }

  const accountProvider: AccountProvider | null = track.source === "qq"
    ? "qq"
    : track.source === "netease" ? "netease" : null;
  const isAccountTrack = accountProvider !== null;
  const trackAccount = accountProvider
    ? accounts.value.find((candidate) => candidate.provider === accountProvider) ?? null
    : null;
  if (accountProvider && !trackAccount) {
    scanError.value = `喜欢${accountProvider === "qq" ? "QQ 音乐" : "网易云"}歌曲前请先登录对应账号。`;
    openProviderAuthPanel(accountProvider);
    return;
  }

  const wasLiked = Boolean(track.liked);
  favoriteMutationPending.add(track.id);
  const nextLiked = !wasLiked;
  const previousTracks = isAccountTrack ? accountFavoriteTracks.value : favoriteTracks.value;
  if (isAccountTrack) {
    syncAccountFavoriteFlag(track.id, nextLiked);
    accountFavoriteTracks.value = nextLiked
      ? [{ ...track, liked: true }, ...previousTracks.filter((item) => item.id !== track.id)]
      : previousTracks.filter((item) => item.id !== track.id);
  } else {
    syncFavoriteFlag(track.id, nextLiked);
    favoriteTracks.value = nextLiked
      ? [{ ...track, liked: true }, ...previousTracks.filter((item) => item.id !== track.id)]
      : previousTracks.filter((item) => item.id !== track.id);
  }

  try {
    if (nextLiked) {
      if (isAccountTrack) {
        await saveAccountFavorite(toPersistedTrack(track), accountProvider || "netease");
      } else {
        await saveFavorite(toPersistedTrack(track));
      }
    } else {
      if (isAccountTrack) {
        await removeAccountFavorite(track.id, accountProvider || "netease");
      } else {
        await removeFavorite(track.id);
      }
    }
  } catch (error) {
    if (isAccountTrack) {
      syncAccountFavoriteFlag(track.id, wasLiked);
      accountFavoriteTracks.value = wasLiked
        ? [{ ...track, liked: true }, ...accountFavoriteTracks.value.filter((item) => item.id !== track.id)]
        : accountFavoriteTracks.value.filter((item) => item.id !== track.id);
      scanError.value = error instanceof Error ? error.message : "流媒体喜欢状态保存失败，请稍后重试。";
    } else {
      syncFavoriteFlag(track.id, wasLiked);
      favoriteTracks.value = wasLiked
        ? [{ ...track, liked: true }, ...favoriteTracks.value.filter((item) => item.id !== track.id)]
        : favoriteTracks.value.filter((item) => item.id !== track.id);
      scanError.value = "喜欢状态保存失败，请确认后端已启动。";
    }
    showSearchToast(scanError.value);
  } finally {
    favoriteMutationPending.delete(track.id);
  }
}

function updateVolume(value: number) {
  volume.value = value;
  if (audioElement.value && activePlaybackFade === null) {
    audioElement.value.volume = value / 100;
  }
  schedulePlaybackStateSave();
}

function changePlaybackQuality(value: string) {
  if (
    currentPlaybackQualitySource.value === "netease"
    && NETEASE_QUALITY_OPTIONS.some((option) => option.value === value)
  ) {
    neteasePlaybackQuality.value = value as NeteasePlaybackQuality;
    return;
  }
  if (
    currentPlaybackQualitySource.value === "qq"
    && QQ_QUALITY_OPTIONS.some((option) => option.value === value)
  ) {
    qqPlaybackQuality.value = value as QqPlaybackQuality;
  }
}

function waitForQualityReload(audio: HTMLAudioElement, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const timeoutId = window.setTimeout(() => finish(new Error("音质切换超时")), 12_000);
    const finish = (error?: Error) => {
      window.clearTimeout(timeoutId);
      audio.removeEventListener("loadedmetadata", handleReady);
      audio.removeEventListener("error", handleError);
      signal?.removeEventListener("abort", handleAbort);
      if (error) reject(error);
      else resolve();
    };
    const handleReady = () => finish();
    const handleError = () => finish(new Error("音质资源加载失败"));
    const handleAbort = () => finish(new DOMException("Source switch cancelled", "AbortError"));
    audio.addEventListener("loadedmetadata", handleReady, { once: true });
    audio.addEventListener("error", handleError, { once: true });
    signal?.addEventListener("abort", handleAbort, { once: true });
    if (signal?.aborted) handleAbort();
  });
}

function cancelLocalSourceSwitch() {
  if (localSourceAbort || localAudioOverride.value) {
    audioElement.value?.pause();
    isPlaying.value = false;
    stopPlaybackClock();
  }
  localSourceAbort?.abort();
  localSourceAbort = undefined;
  localSourceBusy.value = false;
  qualityReloadToken += 1;
  isQualityReloading = false;
}

onBeforeUnmount(cancelLocalSourceSwitch);

function resetLocalSourceState() {
  cancelLocalSourceSwitch();
  localSourceSession.value += 1;
  localMatchRequest += 1;
  localAudioGroups.value = [];
  localSourceNotice.value = "";
  localAudioSelection.value = { provider: "local", quality: "local" };
  localAudioOverride.value = "";
  localAudioOwnerId.value = "";
}

watch(() => currentTrack.value.id, resetLocalSourceState, { flush: "sync" });

async function loadLocalAudioSources(force = false) {
  if (!hasLocalAudioSources.value) return;
  const track = currentTrack.value;
  const request = ++localMatchRequest;
  const key = JSON.stringify([track.id, track.title, track.artist, track.album, track.duration,
    accounts.value.map((item) => [item.provider, item.userId])]);
  const cached = localAudioMatchCache.get(key);
  if (!force && cached && cached.expires > Date.now()) {
    localAudioGroups.value = cached.groups;
    return;
  }
  localAudioGroups.value = ["netease", "qq"].map((provider) => ({ provider, state: "loading" })) as LocalAudioSourceGroup[];
  await Promise.all(localAudioGroups.value.map(async ({ provider }) => {
    let group: LocalAudioSourceGroup;
    try {
      const page = await searchCatalog(track.title, provider, "song", 30, 0);
      const candidates = page.songs.map((raw, index) => {
        const candidate = toTrack(raw, index);
        if (candidate) candidate.duration = Number((raw as Record<string, unknown>).duration) || 0;
        return candidate;
      }).filter((item): item is Track => item !== null);
      const match = matchLocalAudioSource(track, candidates, provider);
      group = { provider, state: match ? "matched" : "empty", track: match ?? undefined };
    } catch {
      group = { provider, state: "error" };
    }
    if (request !== localMatchRequest || currentTrack.value.id !== track.id) return;
    localAudioGroups.value = localAudioGroups.value.map((item) => item.provider === provider ? group : item);
  }));
  if (request === localMatchRequest && localAudioGroups.value.every((item) => item.state !== "error")) {
    if (localAudioMatchCache.size >= 40) localAudioMatchCache.delete(localAudioMatchCache.keys().next().value!);
    localAudioMatchCache.set(key, { expires: Date.now() + 300_000, groups: localAudioGroups.value });
  }
}

async function switchLocalAudioSource(selection: LocalAudioSelection, recovery = false) {
  const audio = audioElement.value;
  const track = currentTrack.value;
  if (!audio || !hasLocalAudioSources.value || localSourceBusy.value || isPlaybackStarting.value || (isSeeking.value && !recovery)) return;
  if (!recovery && selection.provider === localAudioSelection.value.provider && selection.quality === localAudioSelection.value.quality) return;
  let url = "";
  if (selection.provider !== "local") {
    const match = localAudioGroups.value.find((group) => group.provider === selection.provider)?.track;
    const options = selection.provider === "qq" ? QQ_QUALITY_OPTIONS : NETEASE_QUALITY_OPTIONS;
    if (!match || !options.some((item) => item.value === selection.quality)) return;
    url = applyOnlineAudioCachePolicy(loadCatalogAudio(match.id, selection.quality), onlineAudioCachePolicy.value);
  }
  const token = ++qualityReloadToken;
  const controller = new AbortController();
  localSourceAbort = controller;
  const ownsSwitch = () => token === qualityReloadToken && currentTrack.value.id === track.id && !controller.signal.aborted;
  const resumeAt = recovery && isSeeking.value
    ? playbackDuration.value * progress.value / 100 : audio.currentTime || currentTime.value;
  const shouldResume = recovery
    ? isSeeking.value ? wasPlayingBeforeSeek : isPlaying.value
    : !audio.paused && !audio.ended;
  if (recovery && isSeeking.value) {
    isSeeking.value = false;
    wasPlayingBeforeSeek = false;
  }
  pendingSeekTime = undefined;
  localSourceBusy.value = true;
  isQualityReloading = true;
  localSourceNotice.value = "";
  stopPlaybackClock();
  audio.pause();
  isPlaying.value = false;
  const load = async (override: string) => {
    localAudioOwnerId.value = override ? track.id : "";
    localAudioOverride.value = override;
    const ready = waitForQualityReload(audio, controller.signal);
    audio.src = resolveBackendUrl(override || track.audioUrl!);
    audio.load();
    await ready;
    if (!ownsSwitch()) return;
    if (override && Number.isFinite(audio.duration) && Math.abs(audio.duration - track.duration) > Math.max(5, track.duration * .03)) {
      throw new Error("Online audio is a preview or a different version");
    }
    audio.currentTime = Math.min(resumeAt, Number.isFinite(audio.duration) ? Math.max(0, audio.duration - .05) : resumeAt);
    currentTime.value = audio.currentTime;
    if (shouldResume) await audio.play();
    if (!ownsSwitch()) return;
    isPlaying.value = shouldResume;
    playbackClock.reset(audio, performance.now());
    if (shouldResume) startPlaybackClock();
  };
  try {
    await load(url);
    if (!ownsSwitch()) return;
    localAudioSelection.value = selection;
    localSourceNotice.value = recovery ? "在线音源中断，已切回本地音频。" : selection.provider === "local" ? "已切回本地音频。" : "已切换在线音源；实际音质以平台授权为准。";
  } catch {
    if (!ownsSwitch()) return;
    localAudioSelection.value = { provider: "local", quality: "local" };
    try {
      await load("");
      if (ownsSwitch()) localSourceNotice.value = "在线音源不可用（登录、会员权限或网络限制），已恢复本地音频。";
    } catch {
      if (ownsSwitch()) {
        localSourceNotice.value = "音源加载失败，本地音频也无法播放。";
        isPlaying.value = false;
      }
    }
  } finally {
    if (ownsSwitch()) {
      localSourceBusy.value = false;
      isQualityReloading = false;
      localSourceAbort = undefined;
    }
  }
}

async function restoreTrackAfterQualityReload(
  audio: HTMLAudioElement,
  track: Track,
  resumeAt: number,
  shouldResume: boolean
) {
  currentTrack.value = track;
  prepareAudioSource(track);
  audio.load();
  await waitForQualityReload(audio);
  audio.currentTime = Math.min(resumeAt, Number.isFinite(audio.duration) ? audio.duration : resumeAt);
  if (shouldResume) {
    await audio.play();
  }
}

async function reloadCurrentOnlineTrackForQuality(provider: AccountProvider) {
  const track = currentTrack.value;
  const audio = audioElement.value;
  if (
    !audio
    || track.preferredLocalPlayback
    || playbackQualitySource(track) !== provider
  ) {
    return;
  }

  const token = ++qualityReloadToken;
  const previousTrack = { ...track };
  const resumeAt = audio.currentTime;
  const shouldResume = !audio.paused && !audio.ended;
  const replacementTrack: Track = {
    ...track,
    audioUrl: applyOnlineAudioCachePolicy(
      loadCatalogAudio(track.id, requestedPlaybackQuality(track)),
      onlineAudioCachePolicy.value
    )
  };
  isQualityReloading = true;
  stopPlaybackClock();
  audio.pause();
  isPlaying.value = false;

  try {
    currentTrack.value = replacementTrack;
    prepareAudioSource(replacementTrack);
    audio.load();
    await waitForQualityReload(audio);
    if (token !== qualityReloadToken) return;
    audio.currentTime = Math.min(resumeAt, Number.isFinite(audio.duration) ? audio.duration : resumeAt);
    if (shouldResume) {
      await audio.play();
      playbackClock.reset(audio, performance.now());
      startPlaybackClock();
    }
    isPlaying.value = shouldResume;
    scanNotice.value = "音质设置已应用到当前歌曲。";
  } catch {
    if (token !== qualityReloadToken) return;
    try {
      await restoreTrackAfterQualityReload(audio, previousTrack, resumeAt, shouldResume);
      isPlaying.value = shouldResume;
      if (shouldResume) {
        playbackClock.reset(audio, performance.now());
        startPlaybackClock();
      }
    } catch {
      isPlaying.value = false;
    }
    scanError.value = "当前歌曲无法应用所选音质，已保留原播放源。";
  } finally {
    if (token === qualityReloadToken) {
      isQualityReloading = false;
    }
  }
}

function resetPlaybackClock() {
  const audio = audioElement.value;
  if (audio) {
    playbackClock.reset(audio, performance.now());
  }
}

function handleAudioSeeking() {
  pauseCurrentQqListeningSession();
  resetPlaybackClock();
}

function seekPlayback(value: number) {
  if (localSourceBusy.value) return;
  if (audioElement.value && playbackDuration.value > 0) {
    resetListeningSample();
    resetCurrentScrobbleSample();
    const audio = audioElement.value;
    const actualSeekableDuration = getSeekablePlaybackDuration(currentTrack.value.duration, audio.duration);
    const targetTime = Math.min(
      (playbackDuration.value * value) / 100,
      actualSeekableDuration
    );
    pendingSeekTime = targetTime;
    try {
      audio.currentTime = targetTime;
    } catch {
      // loadedmetadata will apply the pending seek once the media duration is known.
    }
    progress.value = (targetTime / playbackDuration.value) * 100;
    resetPlaybackClock();
    lyricClockTime = targetTime;
    currentTime.value = lyricClockTime;
    syncDesktopLyricsTime(lyricClockTime, true);
    updateLyricHighlightDom(lyricClockTime, true);
  }
}

function beginSeek() {
  if (isSeeking.value || localSourceBusy.value) {
    return;
  }
  const audio = audioElement.value;
  isSeeking.value = true;
  resetListeningSample();
  resetCurrentScrobbleSample();
  pauseCurrentQqListeningSession();
  wasPlayingBeforeSeek = Boolean(audio && !audio.paused && !audio.ended) || (!audio && isPlaying.value);
}

function previewSeek(value: number) {
  if (playbackDuration.value <= 0 || localSourceBusy.value) {
    return;
  }
  progress.value = Math.min(Number(value), previewProgressLimit.value);
}

function handleProgressInput(event: Event) {
  const input = event.target as HTMLInputElement;
  const value = Math.min(Number(input.value), previewProgressLimit.value);
  input.value = String(value);
  previewSeek(value);
}

function finishSeek(value: number) {
  if (!isSeeking.value) {
    return;
  }
  const shouldResume = wasPlayingBeforeSeek;
  const finalValue = Math.min(Number(value), previewProgressLimit.value);
  isSeeking.value = false;
  wasPlayingBeforeSeek = false;
  seekPlayback(finalValue);
  void persistPlaybackState();
  if (shouldResume) {
    const audio = audioElement.value;
    if (audio && currentTrack.value.audioUrl) {
      prepareAudioSource(currentTrack.value);
      void audio.play().then(() => {
        playbackClock.reset(audio, performance.now());
        isPlaying.value = true;
        startPlaybackClock();
        resetListeningSample();
        resetCurrentScrobbleSample();
        ensureQqListeningSession(currentTrack.value, audio.currentTime);
      }).catch(() => {
        isPlaying.value = false;
      });
    }
  }
}

function finishSeekFromEvent(event: Event) {
  const input = event.target as HTMLInputElement;
  const value = Math.min(Number(input.value), previewProgressLimit.value);
  input.value = String(value);
  finishSeek(value);
}

function formatLyricTime(time: number) {
  const safeTime = Math.max(0, Math.floor(Number.isFinite(time) ? time : 0));
  return `${Math.floor(safeTime / 60).toString().padStart(2, "0")}:${(safeTime % 60).toString().padStart(2, "0")}`;
}

function formatQueueTotalDuration(tracks: Track[]) {
  const totalSeconds = tracks.reduce((total, track) => total + (Number.isFinite(track.duration) ? track.duration : 0), 0);
  return `${Math.max(0, Math.ceil(totalSeconds / 60))}分钟`;
}

function shiftListeningMonth(offset: number) {
  const current = listeningCalendarMonth.value;
  listeningCalendarMonth.value = new Date(current.getFullYear(), current.getMonth() + offset, 1);
}

function selectListeningCalendarDate(dateKey: string) {
  if (dateKey) {
    selectedListeningDateKey.value = dateKey;
  }
}

function lyricCharacters(line: LyricLine) {
  return line.characters?.map((character) => character.text) ?? splitLyricCharacters(line.text);
}

function songInfoCharacters(text: string) {
  return splitLyricCharacters(text);
}

async function alignPlaybackTargetToAnchor(
  targetIsPreface: boolean,
  targetPrefaceLineIndex: number
) {
  await nextTick();
  const root = detailLyricsRef.value;
  if (!root) {
    return;
  }

  const songInfoLines = root.querySelectorAll<HTMLElement>("[data-song-info-line]");
  const target = targetIsPreface
    ? songInfoLines.item(targetPrefaceLineIndex)
    : root.querySelector<HTMLElement>(`[data-lyric-index="${activeLyricIndex.value}"]`);
  if (!target) {
    return;
  }

  cancelLyricAutoScroll();
  const rootRect = root.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();
  const anchorOffset = root.clientHeight * 0.38 - 42;
  const targetScrollTop = root.scrollTop
    + targetRect.top
    - rootRect.top
    - anchorOffset
    + targetRect.height / 2;
  const maxScrollTop = root.scrollHeight - root.clientHeight;
  root.scrollTo({ top: Math.max(0, Math.min(maxScrollTop, targetScrollTop)), behavior: "auto" });
  updateLyricAnchorFromScroll();
}

async function playFromTime(time: number) {
  const audio = audioElement.value;
  if (!audio || !Number.isFinite(time)) {
    return;
  }

  const targetIsPreface = prefaceAnchorActive.value;
  const targetPrefaceLineIndex = targetIsPreface ? prefaceAnchorLineIndex.value : -1;
  manualLyricsScroll.value = false;
  lastAutoFollowItemId = "";
  audio.currentTime = Math.max(0, time);
  lyricClockTime = audio.currentTime;
  currentTime.value = lyricClockTime;
  syncDesktopLyricsTime(lyricClockTime, true);
  resetPlaybackClock();
  updateLyricHighlightDom(lyricClockTime, true);
  await alignPlaybackTargetToAnchor(targetIsPreface, targetPrefaceLineIndex);

  if (!audio.src || !audio.paused) {
    return;
  }

  try {
    await audio.play();
    isPlaying.value = true;
    startPlaybackClock();
  } catch {
    isPlaying.value = false;
  }
}

function loadTrackLyrics(track: Track) {
  resetLyricHighlightDom();
  lyricLines.value = parseLyricContent(
    track.lyrics,
    track.lyricsTranslation,
    track.lyricsFormat
  );
}

async function hydrateRestoredTrackLyrics(track: Track, requestId: number) {
  if (track.source !== "qq" && track.source !== "netease" && track.source !== "cloud") return;
  try {
    const lyrics = await (track.source === "cloud" ? loadCloudLyrics(track.id) : loadCatalogLyrics(track.id));
    if (requestId !== trackAssetRequestId || currentTrack.value.id !== track.id || !lyrics.lyrics?.trim()) return;
    currentTrack.value = {
      ...currentTrack.value,
      lyrics: lyrics.lyrics,
      lyricsTranslation: lyrics.translation ?? currentTrack.value.lyricsTranslation,
      lyricsPhonetic: lyrics.phonetic ?? currentTrack.value.lyricsPhonetic,
      lyricsFormat: lyrics.format,
      lyricsSource: lyrics.source,
      lyricCredits: lyrics.credits?.length ? normalizeLyricCredits(lyrics.credits) : currentTrack.value.lyricCredits,
      hasLyrics: true
    };
    loadTrackLyrics(currentTrack.value);
  } catch { /* Stored lyrics remain usable while the platform is unavailable. */ }
}

function describeLocalLyricsState(track: Track) {
  if (track.source !== "local") {
    return "";
  }
  const hasLyrics = Boolean(track.lyrics?.trim());
  const isWordTimed = track.lyricsFormat === "QRC" || track.lyricsFormat === "YRC";
  const isLocalFile = track.lyricsSource === "embedded" || track.lyricsSource === "sidecar";
  if (hasLyrics && isLocalFile && isWordTimed) {
    return "已加载本地逐字歌词";
  }
  if (hasLyrics && isWordTimed) {
    const provider = track.lyricsSource?.includes("qq") ? "QQ音乐" : "网易云";
    return `联网匹配到逐字歌词（来自${provider}）`;
  }
  if (hasLyrics) {
    return "未找到逐字歌词，加载普通整行歌词";
  }
  return localLyricsOnlineMatchEnabled.value ? "" : "已关闭本地歌曲联网匹配歌词";
}

function shouldAutoMatchLocalLyrics(track: Track) {
  return track.source === "local"
    && track.id !== DEFAULT_TRACK_ID
    && localLyricsOnlineMatchEnabled.value;
}

function mergeMatchedLocalTrack(raw: PersistedTrack) {
  const current = currentTrack.value.id === raw.id
    ? currentTrack.value
    : remoteTracks.value.find((track) => track.id === raw.id);
  const parsed = toTrack(raw, Math.max(0, remoteTracks.value.findIndex((track) => track.id === raw.id)));
  if (!parsed) {
    return null;
  }
  const incomingCredits = parsed.lyricCredits?.length ? parsed.lyricCredits : parseLyricCredits(parsed.lyrics);
  const previousCredits = current?.lyricCredits?.length ? current.lyricCredits : parseLyricCredits(current?.lyrics);
  const merged: Track = {
    ...(current ?? parsed),
    ...parsed,
    lyricCredits: incomingCredits.length ? incomingCredits : previousCredits,
    primary: current?.primary ?? parsed.primary,
    secondary: current?.secondary ?? parsed.secondary,
    mark: current?.mark ?? parsed.mark,
    liked: current?.liked ?? parsed.liked,
    history: current?.history ?? parsed.history,
    queueKey: current?.queueKey ?? parsed.queueKey
  };
  remoteTracks.value = remoteTracks.value.map((track) => track.id === merged.id ? { ...track, ...merged } : track);
  playbackQueue.value = playbackQueue.value.map((track) => track.id === merged.id
    ? { ...track, ...merged, queueKey: track.queueKey }
    : track);
  if (currentTrack.value.id === merged.id) {
    currentTrack.value = merged;
    loadTrackLyrics(merged);
  }
  return merged;
}

async function matchLocalLyrics(track: Track, automatic = false, requestId = trackAssetRequestId) {
  if (track.source !== "local" || track.id === DEFAULT_TRACK_ID) {
    return;
  }
  if (!localLyricsOnlineMatchEnabled.value) {
    localLyricsMatchNotice.value = "已关闭本地歌曲联网匹配歌词";
    return;
  }
  const matchRequestId = ++localLyricsMatchRequestId;
  localLyricsMatchPending.value = true;
  localLyricsMatchNotice.value = automatic && track.lyrics?.trim()
    ? describeLocalLyricsState(track)
    : automatic ? "正在联网匹配歌词…" : "正在重新匹配歌词…";
  try {
    const result = await matchLocalTrackLyrics(
      track.id,
      saveMatchedLyricsBesideAudio.value,
      !automatic
    );
    if (matchRequestId !== localLyricsMatchRequestId || requestId !== trackAssetRequestId
      || currentTrack.value.id !== track.id || !localLyricsOnlineMatchEnabled.value) {
      return;
    }
    if (result.matched && result.track) {
      mergeMatchedLocalTrack({
        ...result.track,
        ...(result.lyricData ? {
          translation: result.lyricData.translation,
          phonetic: result.lyricData.phonetic,
          credits: result.lyricData.credits
        } : {})
      });
    }
    localLyricsMatchNotice.value = result.matched
      ? result.message
      : "联网匹配歌词失败，使用本地文件";
  } catch {
    if (matchRequestId === localLyricsMatchRequestId && requestId === trackAssetRequestId) {
      localLyricsMatchNotice.value = "联网匹配歌词失败，使用本地文件";
    }
  } finally {
    if (matchRequestId === localLyricsMatchRequestId) localLyricsMatchPending.value = false;
  }
}

watch(localLyricsOnlineMatchEnabled, (enabled) => {
  window.localStorage.setItem(LOCAL_LYRICS_MATCH_STORAGE_KEY, String(enabled));
  localLyricsMatchNotice.value = enabled
    ? "已开启本地歌曲联网匹配歌词"
    : "已关闭本地歌曲联网匹配歌词";
});

watch(saveMatchedLyricsBesideAudio, (enabled) => {
  window.localStorage.setItem(SAVE_MATCHED_LYRICS_BESIDE_AUDIO_STORAGE_KEY, String(enabled));
});

watch(useFilenameMetadataEnabled, (enabled) => {
  window.localStorage.setItem(USE_FILENAME_METADATA_STORAGE_KEY, String(enabled));
});

watch(duplicateRecognitionMode, (mode) => {
  window.localStorage.setItem(DUPLICATE_RECOGNITION_MODE_STORAGE_KEY, mode);
});

watch(startupHome, (home) => {
  writeStartupHome(home, window.localStorage);
});

watch(onlineAudioCachePolicy, (policy) => {
  writeOnlineAudioCachePolicy(policy, window.localStorage);
});

watch(appearancePreferences, (preferences) => {
  writeAppearancePreferences(window.localStorage, preferences);
}, { deep: true });

async function refreshAudioOutputDevices() {
  try {
    const devices = await enumerateAudioOutputDevices();
    audioOutputDevices.value = devices;
    const selectedDevice = devices.find((device) => (
      device.deviceId === audioOutputPreferences.value.deviceId
      || device.aliases?.includes(audioOutputPreferences.value.deviceId)
    ));
    if (selectedDevice && selectedDevice.deviceId !== audioOutputPreferences.value.deviceId) {
      audioOutputPreferences.value = { ...audioOutputPreferences.value, deviceId: selectedDevice.deviceId };
      audioOutputError.value = "";
    } else if (!selectedDevice) {
      audioOutputPreferences.value = { ...audioOutputPreferences.value, deviceId: "default" };
      audioOutputError.value = "先前选择的输出设备已断开，已切回系统默认。";
    }
  } catch (error) {
    audioOutputDevices.value = [{ deviceId: "default", label: "系统默认", isDefault: true }];
    audioOutputError.value = error instanceof Error ? error.message : "无法读取系统音频输出设备。";
  }
}

async function applyAudioOutputPreferencesToPlayback() {
  const audio = audioElement.value;
  if (!audio) return;
  audioOutputSupported.value = supportsAudioOutputSelection(audio);
  const routedDeviceId = resolveAudioOutputDeviceId(
    audioOutputPreferences.value.deviceId,
    audioOutputDevices.value
  );

  try {
    if (audioOutputController) {
      await audioOutputController.setDevice(routedDeviceId);
    } else {
      await applyAudioOutputDevice(audio, routedDeviceId);
    }
    audioOutputError.value = "";
  } catch (error) {
    audioOutputError.value = error instanceof Error ? error.message : "切换音频输出设备失败。";
    if (audioOutputPreferences.value.deviceId !== "default") {
      audioOutputPreferences.value = { ...audioOutputPreferences.value, deviceId: "default" };
    }
    return;
  }

  try {
    if (audioOutputPreferences.value.loudnessMatching && !audioOutputController) {
      audioOutputController = new AudioOutputController(audio);
      await audioOutputController.setDevice(routedDeviceId);
    }
    await audioOutputController?.setLoudnessMatching(audioOutputPreferences.value.loudnessMatching);
  } catch (error) {
    audioOutputError.value = error instanceof Error ? error.message : "响度匹配无法启动。";
    if (audioOutputPreferences.value.loudnessMatching) {
      audioOutputPreferences.value = { ...audioOutputPreferences.value, loudnessMatching: false };
    }
  }
}

function handleAudioOutputDeviceChange() {
  void refreshAudioOutputDevices().then(applyAudioOutputPreferencesToPlayback);
}

function handleAudioPlay() {
  resetPlaybackClock();
  if (audioElement.value) ensureQqListeningSession(currentTrack.value, audioElement.value.currentTime);
  void applyAudioOutputPreferencesToPlayback();
}

function handleAudioPause() {
  pauseCurrentQqListeningSession();
  void flushQqListeningSession(true);
}

watch(audioOutputPreferences, (preferences) => {
  writeAudioOutputPreferences(window.localStorage, preferences);
  void applyAudioOutputPreferencesToPlayback();
}, { deep: true });

const pendingMiniPlayerAfterAuth = ref(false);

function completePendingMiniPlayerOpen() {
  if (!pendingMiniPlayerAfterAuth.value) return;
  pendingMiniPlayerAfterAuth.value = false;
  void nextTick(() => openMiniPlayer());
}

function closeAuthPanel() {
  authPanelVisible.value = false;
  completePendingMiniPlayerOpen();
}

function applyOnboardingPreferences() {
  const selectedMode = resolveStartupMode(startupHome.value, appMode.value);
  writeStartupHome(startupHome.value, window.localStorage);
  if (selectedMode !== appMode.value) {
    appMode.value = selectedMode;
    activeView.value = "home";
    selectedPlaylist.value = null;
    selectedLocalAlbum.value = null;
    selectedStreamingArtist.value = null;
    if (selectedMode === "streaming") {
      ensureStreamingHomeForModeSwitch();
    }
  }
  writeAppMode(selectedMode);
  markOnboardingCompleted(window.localStorage);
}

async function finishOnboarding() {
  onboardingExitImmediately.value = false;
  applyOnboardingPreferences();
  if (onboardingLoginPreference.value === "after-guide") {
    pendingMiniPlayerAfterAuth.value = appearancePreferences.value.playerControls.openMiniAfterGuide;
    openProviderAuthPanel("netease");
    await nextTick();
    showFirstRunOnboarding.value = false;
    return;
  }
  showFirstRunOnboarding.value = false;
  if (appearancePreferences.value.playerControls.openMiniAfterGuide) {
    void nextTick(() => openMiniPlayer());
  }
}

function skipOnboarding() {
  onboardingExitImmediately.value = true;
  pendingMiniPlayerAfterAuth.value = false;
  applyOnboardingPreferences();
  showFirstRunOnboarding.value = false;
  void nextTick(() => { onboardingExitImmediately.value = false; });
}

function openOnboarding() {
  onboardingExitImmediately.value = false;
  pendingMiniPlayerAfterAuth.value = false;
  showFirstRunOnboarding.value = true;
}

async function setLaunchAtStartupPreference(enabled: boolean) {
  if (launchAtStartupPending.value) return;
  launchAtStartupPending.value = true;
  desktopIntegrationError.value = "";
  try {
    launchAtStartup.value = await window.listenMusic?.setLaunchAtStartup(enabled) ?? false;
  } catch {
    desktopIntegrationError.value = "开机启动设置失败，请检查系统权限后重试。";
  } finally {
    launchAtStartupPending.value = false;
  }
}

async function setGlobalShortcutsPreference(enabled: boolean) {
  if (globalShortcutsPending.value) return;
  globalShortcutsPending.value = true;
  desktopIntegrationError.value = "";
  try {
    const snapshot = await window.listenMusic?.updateShortcuts({ enabled });
    if (snapshot) globalShortcutsState.value = snapshot.config.enabled;
  } catch {
    desktopIntegrationError.value = "全局快捷键设置失败，请到快捷键页面检查按键冲突。";
  } finally {
    globalShortcutsPending.value = false;
  }
}

function setPlayerPresentationPreference(presentation: PlayerBarPresentation) {
  appearancePreferences.value.playerControls.presentation = presentation;
  if (presentation !== "full") {
    appearancePreferences.value.miniPlayer.layout.mode = presentation === "compact" ? "compact" : "standard";
  }
}

function handleSystemDarkModeChange(event: MediaQueryListEvent) {
  systemPrefersDark.value = event.matches;
}

function handleSystemReducedMotionChange(event: MediaQueryListEvent) {
  systemPrefersReducedMotion.value = event.matches;
}

onMounted(() => {
  systemDarkMediaQuery.addEventListener("change", handleSystemDarkModeChange);
  systemReducedMotionQuery.addEventListener("change", handleSystemReducedMotionChange);
});

onBeforeUnmount(() => {
  systemDarkMediaQuery.removeEventListener("change", handleSystemDarkModeChange);
  systemReducedMotionQuery.removeEventListener("change", handleSystemReducedMotionChange);
});

watch(activeSettingsSection, (section) => {
  mainScrollElement.value?.scrollTo({ top: 0, behavior: "auto" });
  if (section === "cache") {
    void refreshCacheSettings(true);
    void refreshListeningDataSummary();
    void refreshQqListeningDataSummaries(true);
  }
});

watch(
  [listeningDataDeleteMode, listeningDataDeleteYear, listeningDataDeleteMonth],
  () => {
    listeningDataNotice.value = "";
    if (activeSettingsSection.value === "cache") {
      void refreshListeningDataSummary();
    }
  }
);

watch(playbackFadeEnabled, (enabled) => {
  window.localStorage.setItem(PLAYBACK_FADE_ENABLED_STORAGE_KEY, String(enabled));
});

watch(playbackFadeDurationMs, (durationMs) => {
  const normalizedDuration = normalizeFadeDurationMs(durationMs);
  if (normalizedDuration !== durationMs) {
    playbackFadeDurationMs.value = normalizedDuration;
    return;
  }
  window.localStorage.setItem(PLAYBACK_FADE_DURATION_STORAGE_KEY, String(normalizedDuration));
});

watch(preferLocalDownloadPlayback, (enabled) => {
  window.localStorage.setItem(PREFER_LOCAL_DOWNLOAD_PLAYBACK_STORAGE_KEY, String(enabled));
});

watch(desktopIntegrationPreferences, (preferences) => {
  writeDesktopIntegrationPreferences(window.localStorage, preferences);
  void window.listenMusic?.setCloseBehavior(preferences.closeBehavior);
  if (preferences.closeBehavior === "tray" && !systemTrayEnabled.value) {
    systemTrayEnabled.value = true;
  }
  syncSystemMediaControls();
}, { deep: true, immediate: true });

watch(() => desktopIntegrationPreferences.value.rememberPlaybackPosition, (enabled, previous) => {
  if (previous && !enabled) void persistPlaybackState();
});

watch(currentTrack, syncSystemMediaControls);

watch(
  [neteasePlaybackQuality, qqPlaybackQuality, reloadCurrentTrackOnQualityChange],
  ([netease, qq, reloadCurrent]) => {
    writePlaybackQualityPreferences(window.localStorage, { netease, qq, reloadCurrent });
  }
);

watch(neteasePlaybackQuality, (quality, previousQuality) => {
  if (quality !== previousQuality && reloadCurrentTrackOnQualityChange.value) {
    void reloadCurrentOnlineTrackForQuality("netease");
  }
});

watch(qqPlaybackQuality, (quality, previousQuality) => {
  if (quality !== previousQuality && reloadCurrentTrackOnQualityChange.value) {
    void reloadCurrentOnlineTrackForQuality("qq");
  }
});

watch(taskbarThumbnailButtonsEnabled, (enabled) => {
  window.localStorage.setItem(TASKBAR_THUMBNAIL_BUTTONS_STORAGE_KEY, String(enabled));
  if (taskbarThumbnailButtonsSupported) {
    void window.listenMusic?.setTaskbarThumbnailButtons(enabled, isPlaying.value);
  }
});

watch(isPlaying, (playing) => {
  if (taskbarThumbnailButtonsSupported && taskbarThumbnailButtonsEnabled.value) {
    void window.listenMusic?.updateTaskbarPlaybackState(playing);
  }
  syncSystemMediaControls();
});

watch(systemTrayEnabled, (enabled) => {
  window.localStorage.setItem(SYSTEM_TRAY_ENABLED_STORAGE_KEY, String(enabled));
  if (!enabled && desktopIntegrationPreferences.value.closeBehavior === "tray") {
    desktopIntegrationPreferences.value.closeBehavior = "exit";
  }
  if (taskbarThumbnailButtonsSupported) {
    void window.listenMusic?.setSystemTrayEnabled(enabled, systemTrayState.value);
  }
});

watch(systemTrayState, (state) => {
  if (taskbarThumbnailButtonsSupported && systemTrayEnabled.value) {
    void window.listenMusic?.updateSystemTrayState(state);
  }
});

function syncDesktopLyricsPlaybackState() {
  window.listenMusic?.updateDesktopLyricsPlaybackState({
    ...desktopLyricsPlaybackState.value,
    currentTime: currentPlaybackPosition()
  });
}

function syncDesktopLyricsTime(time: number, force = false) {
  if (!desktopLyricsVisible.value || !Number.isFinite(time)) return;
  const now = performance.now();
  if (!force && now - lastDesktopLyricsTimeSentAt < 100) return;
  lastDesktopLyricsTimeSentAt = now;
  window.listenMusic?.updateDesktopLyricsTime(time, force);
}

watch(desktopLyricsPlaybackMetadata, syncDesktopLyricsPlaybackState, { deep: true, immediate: true });

watch(musicFolder, (directory) => {
  const normalized = directory.trim();
  if (normalized) {
    window.localStorage.setItem(LOCAL_LIBRARY_DIRECTORY_STORAGE_KEY, normalized);
  } else {
    window.localStorage.removeItem(LOCAL_LIBRARY_DIRECTORY_STORAGE_KEY);
  }
});

watch(autoScanLocalLibraryEnabled, (enabled) => {
  window.localStorage.setItem(AUTO_SCAN_LOCAL_LIBRARY_STORAGE_KEY, String(enabled));
});

function resetLyricsFollowState() {
  cancelLyricAutoScroll();
  if (lyricAnchorScrollFrame !== undefined) {
    window.cancelAnimationFrame(lyricAnchorScrollFrame);
    lyricAnchorScrollFrame = undefined;
  }
  if (resumeLyricsFollowTimer) {
    window.clearTimeout(resumeLyricsFollowTimer);
    resumeLyricsFollowTimer = undefined;
  }
  if (lyricAnchorHideTimer) {
    window.clearTimeout(lyricAnchorHideTimer);
    lyricAnchorHideTimer = undefined;
  }
  manualLyricsScroll.value = false;
  lyricAnchorVisible.value = false;
  lyricsDragging.value = false;
  lyricDragPointerId = undefined;
  prefaceAnchorActive.value = false;
  lastAutoFollowItemId = "";
}

function openSongDetail() {
  resetLyricHighlightDom();
  resetLyricsFollowState();
  streamingSourceMenuVisible.value = false;
  const audioTime = audioElement.value?.currentTime;
  if (typeof audioTime === "number" && Number.isFinite(audioTime)) {
    lyricClockTime = audioTime;
    currentTime.value = audioTime;
  }
  showSongDetail.value = true;
}

function closeSongDetail() {
  resetLyricHighlightDom();
  resetLyricsFollowState();
  showSongDetail.value = false;
}

function toggleSongDetail() {
  if (showSongDetail.value) {
    closeSongDetail();
  } else {
    openSongDetail();
  }
}

async function toggleDesktopLyrics() {
  syncDesktopLyricsPlaybackState();
  const bridge = window.listenMusic;
  if (!bridge) return;
  desktopLyricsVisible.value = await bridge.toggleDesktopLyricsWindow();
}

async function chooseMusicFolder() {
  let selected: string | null = null;
  scanNotice.value = "";
  scanError.value = "";
  try {
    selected = await selectMusicDirectory();
  } catch {
    scanError.value = "无法打开文件夹选择器，请确认后端已启动。";
    return false;
  }
  if (selected) {
    musicFolder.value = selected;
    return true;
  }
  scanNotice.value = "没有选择音乐库文件夹。";
  return false;
}

async function chooseMusicFolderAndScan() {
  const shouldOpenLocalHomeAfterScan = shouldShowLocalEmptyRoom.value || activeView.value === "settings";
  const selected = await chooseMusicFolder();
  if (selected) {
    await scanMusicFolder();
    if (shouldOpenLocalHomeAfterScan && remoteTracks.value.length > 0) {
      activeView.value = "home";
    }
  }
}

async function removeMusicFolderFromLibrary(directory: string) {
  if (localLibraryScanPending.value) return;
  localLibraryScanPending.value = true;
  scanNotice.value = "";
  scanError.value = "";
  try {
    const tracks = await removeLocalLibraryRoot(directory);
    remoteTracks.value = Array.isArray(tracks)
      ? tracks.map(toTrack).filter((track): track is Track => Boolean(track))
      : [];
    localLibraryRoots.value = await loadLocalLibraryRoots();
    favoriteTracks.value.forEach((track) => syncFavoriteFlag(track.id, true));
    if (selectedLocalFolderPath.value?.toLocaleLowerCase() === directory.toLocaleLowerCase()) {
      selectedLocalFolderPath.value = null;
    }
    if (musicFolder.value.trim().toLocaleLowerCase() === directory.trim().toLocaleLowerCase()) {
      musicFolder.value = localLibraryRoots.value[0] ?? "";
    }
    if (
      currentTrack.value.source === "local"
      && currentTrack.value.id !== DEFAULT_TRACK_ID
      && !remoteTracks.value.some((track) => track.id === currentTrack.value.id)
    ) {
      resetPlayerToDefault();
    }
    hasScannedLocalLibrary.value = localLibraryRoots.value.length > 0;
    scanNotice.value = "已从曲库移除文件夹，不会删除磁盘中的音乐文件。";
  } catch (error) {
    scanError.value = error instanceof Error ? error.message : "移除音乐文件夹失败，请确认后端已启动。";
  } finally {
    localLibraryScanPending.value = false;
  }
}

async function scanMusicFolder() {
  if (localLibraryScanPending.value) return;
  scanNotice.value = "";
  scanError.value = "";
  if (!musicFolder.value.trim()) {
    scanError.value = "请先选择音乐文件夹。";
    return;
  }
  localLibraryScanPending.value = true;
  try {
    const tracks = await scanLibrary(musicFolder.value.trim(), useFilenameMetadataEnabled.value);
    remoteTracks.value = Array.isArray(tracks)
      ? tracks.map(toTrack).filter((track): track is Track => Boolean(track))
      : [];
    localLibraryRoots.value = await loadLocalLibraryRoots();
    ignoredLocalFiles.value = await loadIgnoredLocalFiles();
    favoriteTracks.value.forEach((track) => syncFavoriteFlag(track.id, true));
    hasScannedLocalLibrary.value = true;
    localLibraryHydrated.value = true;
    activeView.value = "library";
    if (remoteTracks.value[0]) {
      currentTrack.value = remoteTracks.value[0];
      loadTrackLyrics(currentTrack.value);
    }
    scanNotice.value = `扫描完成，共找到 ${remoteTracks.value.length} 首歌曲`;
  } catch (error) {
    scanError.value = error instanceof Error ? error.message : "扫描失败，请检查文件夹路径和后端状态。";
  } finally {
    localLibraryScanPending.value = false;
  }
}

async function scanMusicFolderIncrementally() {
  if (localLibraryScanPending.value) {
    return;
  }
  scanNotice.value = "";
  scanError.value = "";
  const directory = musicFolder.value.trim();
  if (localLibraryRoots.value.length === 0 && !directory) {
    scanError.value = "请先选择音乐文件夹。";
    return;
  }

  localLibraryScanPending.value = true;
  scanNotice.value = "正在扫描音乐库…";
  showLocalLibraryScanToast();
  try {
    const result = localLibraryRoots.value.length > 0
      ? await scanAllLibrariesIncrementally(useFilenameMetadataEnabled.value)
      : await scanLibraryIncrementally(directory, useFilenameMetadataEnabled.value);
    remoteTracks.value = Array.isArray(result.tracks)
      ? result.tracks.map(toTrack).filter((track): track is Track => Boolean(track))
      : [];
    localLibraryRoots.value = await loadLocalLibraryRoots();
    ignoredLocalFiles.value = await loadIgnoredLocalFiles();
    favoriteTracks.value.forEach((track) => syncFavoriteFlag(track.id, true));
    hasScannedLocalLibrary.value = true;
    localLibraryHydrated.value = true;

    if (currentTrack.value.source === "local" && currentTrack.value.id !== DEFAULT_TRACK_ID) {
      const refreshedCurrentTrack = remoteTracks.value.find((track) => track.id === currentTrack.value.id);
      if (refreshedCurrentTrack) {
        currentTrack.value = refreshedCurrentTrack;
      } else if (remoteTracks.value[0]) {
        currentTrack.value = remoteTracks.value[0];
        loadTrackLyrics(currentTrack.value);
      } else {
        resetPlayerToDefault();
      }
    }

    scanNotice.value = `扫描完成，共找到 ${result.total} 首，新增 ${result.added} 首，移除失效 ${result.removed} 首`;
    showLocalLibraryScanToast(5_000);
  } catch (error) {
    scanNotice.value = "";
    scanError.value = error instanceof Error ? error.message : "扫描失败，请检查音乐库路径和后端状态。";
    showLocalLibraryScanToast(6_000);
  } finally {
    localLibraryScanPending.value = false;
  }
}

async function reparseAllLocalMetadata() {
  if (localLibraryScanPending.value) {
    return;
  }
  const directory = musicFolder.value.trim();
  scanNotice.value = "";
  scanError.value = "";
  if (!directory) {
    scanError.value = "请先选择音乐文件夹。";
    return;
  }

  localLibraryScanPending.value = true;
  scanNotice.value = "正在重新解析歌曲元信息…";
  showLocalLibraryScanToast();
  try {
    const result = await reparseLibraryMetadata(directory, useFilenameMetadataEnabled.value);
    remoteTracks.value = Array.isArray(result.tracks)
      ? result.tracks.map(toTrack).filter((track): track is Track => Boolean(track))
      : [];
    favoriteTracks.value.forEach((track) => syncFavoriteFlag(track.id, true));
    hasScannedLocalLibrary.value = true;
    localLibraryHydrated.value = true;
    const refreshedCurrentTrack = remoteTracks.value.find((track) => track.id === currentTrack.value.id);
    if (currentTrack.value.source === "local" && currentTrack.value.id !== DEFAULT_TRACK_ID) {
      if (refreshedCurrentTrack) {
        currentTrack.value = refreshedCurrentTrack;
        loadTrackLyrics(currentTrack.value);
      } else if (remoteTracks.value[0]) {
        currentTrack.value = remoteTracks.value[0];
        loadTrackLyrics(currentTrack.value);
      } else {
        resetPlayerToDefault();
      }
    }
    scanNotice.value = `重新解析完成，共处理 ${result.total} 首，使用文件名补全 ${result.filenameResolved} 首`;
    showLocalLibraryScanToast(5_000);
  } catch (error) {
    scanNotice.value = "";
    scanError.value = error instanceof Error ? error.message : "重新解析失败，请检查音乐库路径和后端状态。";
    showLocalLibraryScanToast(6_000);
  } finally {
    localLibraryScanPending.value = false;
  }
}

function showLocalLibraryScanToast(autoHideMs = 0) {
  if (localLibraryScanToastTimer) {
    window.clearTimeout(localLibraryScanToastTimer);
    localLibraryScanToastTimer = undefined;
  }
  localLibraryScanToastVisible.value = true;
  if (autoHideMs > 0) {
    localLibraryScanToastTimer = window.setTimeout(() => {
      localLibraryScanToastVisible.value = false;
      localLibraryScanToastTimer = undefined;
    }, autoHideMs);
  }
}

async function handleResetLocalLibrary() {
  const confirmed = window.confirm("确定要重置音乐库吗？这只会清空应用里的本地音乐库记录，不会删除你的音乐文件。");
  if (!confirmed) {
    return;
  }
  scanNotice.value = "";
  scanError.value = "";
  try {
    await resetLocalLibrary();
    remoteTracks.value = [];
    localLibraryRoots.value = [];
    ignoredLocalFiles.value = [];
    selectedDuplicateTrackIds.value = new Set();
    playbackQueue.value = [];
    hasScannedLocalLibrary.value = false;
    localLibraryHydrated.value = true;
    resetPlayerToDefault();
    activeView.value = "home";
    selectedPlaylist.value = null;
    scanNotice.value = "本地音乐库已重置。";
  } catch (error) {
    scanError.value = error instanceof Error ? error.message : "重置音乐库失败，请确认后端已启动。";
  }
}

function openDuplicateFinder() {
  selectedDuplicateTrackIds.value = new Set();
  duplicateFinderVisible.value = true;
  closeLocalToolMenu();
}

function closeDuplicateFinder() {
  if (duplicateRemovalPending.value) {
    return;
  }
  duplicateFinderVisible.value = false;
  selectedDuplicateTrackIds.value = new Set();
}

function toggleDuplicateTrackSelection(trackId: string) {
  const next = new Set(selectedDuplicateTrackIds.value);
  if (next.has(trackId)) {
    next.delete(trackId);
  } else {
    next.add(trackId);
  }
  selectedDuplicateTrackIds.value = next;
}

async function removeDuplicateLibraryRecords(trackIds: string[]) {
  const uniqueTrackIds = [...new Set(trackIds)].filter(Boolean);
  if (duplicateRemovalPending.value || uniqueTrackIds.length === 0) {
    return;
  }

  duplicateRemovalPending.value = true;
  scanError.value = "";
  try {
    const tracks = await ignoreLocalLibraryTracks(uniqueTrackIds);
    remoteTracks.value = Array.isArray(tracks)
      ? tracks.map(toTrack).filter((track): track is Track => Boolean(track))
      : [];
    ignoredLocalFiles.value = await loadIgnoredLocalFiles();
    selectedDuplicateTrackIds.value = new Set(
      [...selectedDuplicateTrackIds.value].filter((id) => !uniqueTrackIds.includes(id))
    );

    playbackQueue.value = playbackQueue.value.filter((track) => !uniqueTrackIds.includes(track.id));
    void persistPlaybackQueue();
    if (uniqueTrackIds.includes(currentTrack.value.id)) {
      resetPlayerToDefault();
    }
    scanNotice.value = `已从音乐库移除 ${uniqueTrackIds.length} 条记录，磁盘文件未改动。`;
  } catch (error) {
    scanError.value = error instanceof Error ? error.message : "移除库记录失败，请确认后端已启动。";
  } finally {
    duplicateRemovalPending.value = false;
  }
}

async function keepOnlyDuplicateTrack(group: LocalDuplicateGroup, keptTrackId: string) {
  const trackIds = group.tracks.map((track) => track.id).filter((id) => id !== keptTrackId);
  if (trackIds.length === 0 || !window.confirm(`保留「${group.title}」当前这条记录，并从音乐库移除其余 ${trackIds.length} 条吗？磁盘文件不会被删除。`)) {
    return;
  }
  await removeDuplicateLibraryRecords(trackIds);
}

async function removeSelectedDuplicateTracks() {
  const trackIds = [...selectedDuplicateTrackIds.value];
  if (trackIds.length === 0 || !window.confirm(`从音乐库移除选中的 ${trackIds.length} 条记录吗？磁盘文件不会被删除。`)) {
    return;
  }
  await removeDuplicateLibraryRecords(trackIds);
}

async function restoreAllIgnoredLocalFiles() {
  if (duplicateRemovalPending.value || ignoredLocalFiles.value.length === 0) {
    return;
  }
  duplicateRemovalPending.value = true;
  scanError.value = "";
  try {
    const result = await restoreIgnoredLocalFiles();
    ignoredLocalFiles.value = [];
    scanNotice.value = `已恢复 ${result.restored} 条忽略记录，正在重新扫描音乐库…`;
  } catch (error) {
    scanError.value = error instanceof Error ? error.message : "恢复忽略记录失败，请确认后端已启动。";
    return;
  } finally {
    duplicateRemovalPending.value = false;
  }
  await scanMusicFolderIncrementally();
}

function resetLyricHighlightDom() {
  renderedCharacterElements.forEach((element) => {
    element.classList.remove("is-sung");
    element.classList.remove("is-progressing");
    element.style.removeProperty("--lyric-character-progress");
  });
  renderedSongInfoLineElements.forEach((line) => {
    line.forEach((element) => {
      element.classList.remove("is-sung");
    });
  });
  renderedLyricIndex = -1;
  renderedCharacterCount = 0;
  renderedCharacterProgress = 0;
  renderedCharacterElements = [];
  renderedProgressCharacter = undefined;
  renderedSongInfoLineIndex = -1;
  renderedSongInfoCharacterCount = 0;
  renderedSongInfoLineElements = [];
  lyricAnchorIndex.value = -1;
}

function clearRenderedLyricHighlight() {
  renderedCharacterElements.forEach((element) => {
    element.classList.remove("is-sung");
    element.classList.remove("is-progressing");
    element.style.removeProperty("--lyric-character-progress");
  });
  renderedCharacterCount = 0;
  renderedCharacterProgress = 0;
  renderedProgressCharacter = undefined;
}

function updateSongInfoHighlightDom(time: number) {
  const root = detailLyricsRef.value;
  if (!showSongDetail.value || !root) {
    return;
  }

  if (renderedSongInfoLineElements.length === 0) {
    renderedSongInfoLineElements = Array.from(
      root.querySelectorAll<HTMLElement>("[data-song-info-line]")
    ).map((line) => Array.from(line.querySelectorAll<HTMLElement>(".song-info-character")));
  }

  const nextState = getPrefaceHighlightState(
    time,
    preludeEndTime.value,
    renderedSongInfoLineElements.map((line) => line.length),
    prefaceLineTimes.value
  );

  if (nextState.activeIndex !== renderedSongInfoLineIndex) {
    renderedSongInfoLineElements.forEach((line, index) => {
      if (index !== nextState.activeIndex) {
        line.forEach((element) => element.classList.remove("is-sung"));
      }
    });
    renderedSongInfoLineIndex = nextState.activeIndex;
    renderedSongInfoCharacterCount = 0;

    const activeItem = root.querySelectorAll<HTMLElement>("[data-song-info-line]")
      .item(nextState.activeIndex);
    const activeItemId = `preface:${nextState.activeIndex}`;
    if (
      activeItem
      && isPlaying.value
      && !manualLyricsScroll.value
      && lastAutoFollowItemId !== activeItemId
    ) {
      followActiveLyricItem(root, activeItem);
      lastAutoFollowItemId = activeItemId;
    }
  }

  if (nextState.activeIndex < 0) {
    return;
  }

  const activeLineElements = renderedSongInfoLineElements[nextState.activeIndex] ?? [];
  if (nextState.characterCount > renderedSongInfoCharacterCount) {
    for (let index = renderedSongInfoCharacterCount; index < nextState.characterCount; index += 1) {
      activeLineElements[index]?.classList.add("is-sung");
    }
  } else if (nextState.characterCount < renderedSongInfoCharacterCount) {
    for (let index = nextState.characterCount; index < renderedSongInfoCharacterCount; index += 1) {
      activeLineElements[index]?.classList.remove("is-sung");
    }
  }
  renderedSongInfoCharacterCount = nextState.characterCount;
}

function updateLyricHighlightDom(time: number, allowRewind = false) {
  updateSongInfoHighlightDom(time);
  const root = detailLyricsRef.value;
  if (!showSongDetail.value || !root || !lyricLines.value.length) {
    return;
  }

  const activeIndex = findActiveLyricIndex(time, lyricLines.value);
  if (activeIndex !== renderedLyricIndex) {
    clearRenderedLyricHighlight();
    const activeLine = activeIndex >= 0
      ? root.querySelector<HTMLElement>(`[data-lyric-index="${activeIndex}"]`)
      : null;
    renderedLyricIndex = activeIndex;
    renderedCharacterElements = activeLine
      ? Array.from(activeLine.querySelectorAll<HTMLElement>(".lyric-character"))
      : [];
  }

  if (activeIndex >= 0 && renderedCharacterElements.length === 0) {
    const activeLine = root.querySelector<HTMLElement>(`[data-lyric-index="${activeIndex}"]`);
    activeLine?.classList.add("is-active");
    renderedCharacterElements = activeLine
      ? Array.from(activeLine.querySelectorAll<HTMLElement>(".lyric-character"))
      : [];
  }

  const rawCharacterProgress = activeIndex >= 0
    ? getLyricCharacterProgress(time, lyricLines.value)
    : 0;
  const characterProgress = stabilizeLyricCharacterProgress(
    renderedCharacterProgress,
    rawCharacterProgress,
    allowRewind
  );
  const nextCharacterCount = Math.floor(characterProgress);

  if (nextCharacterCount > renderedCharacterCount) {
    for (let index = renderedCharacterCount; index < nextCharacterCount; index += 1) {
      renderedCharacterElements[index]?.classList.add("is-sung");
    }
  } else if (nextCharacterCount < renderedCharacterCount) {
    for (let index = nextCharacterCount; index < renderedCharacterCount; index += 1) {
      renderedCharacterElements[index]?.classList.remove("is-sung");
    }
  }
  renderedCharacterCount = nextCharacterCount;
  renderedCharacterProgress = characterProgress;

  const hasWordTiming = Boolean(lyricLines.value[activeIndex]?.characters?.length);
  const nextProgressCharacter = hasWordTiming && nextCharacterCount < renderedCharacterElements.length
    ? renderedCharacterElements[nextCharacterCount]
    : undefined;
  if (renderedProgressCharacter && renderedProgressCharacter !== nextProgressCharacter) {
    renderedProgressCharacter.classList.remove("is-progressing");
    renderedProgressCharacter.style.removeProperty("--lyric-character-progress");
  }
  if (nextProgressCharacter) {
    const progress = Math.max(0, Math.min(1, characterProgress - nextCharacterCount));
    nextProgressCharacter.classList.add("is-progressing");
    nextProgressCharacter.style.setProperty("--lyric-character-progress", `${progress * 100}%`);
  }
  renderedProgressCharacter = nextProgressCharacter;
}

function stopPlaybackClock() {
  if (playbackFrameId !== undefined) {
    window.cancelAnimationFrame(playbackFrameId);
    playbackFrameId = undefined;
  }
}

function startPlaybackClock() {
  stopPlaybackClock();

  const tick = () => {
    playbackFrameId = undefined;
    const audio = audioElement.value;
    if (!audio || audio.paused || audio.ended) {
      return;
    }

    const time = playbackClock.read(audio, performance.now());
    lyricClockTime = time;
    syncDesktopLyricsTime(time);
    syncMiniPlayerTime(time);
    const nextIndex = findActiveLyricIndex(time, lyricLines.value);
    if (nextIndex !== activeLyricIndex.value) {
      currentTime.value = time;
    }
    updateLyricHighlightDom(time);
    playbackFrameId = window.requestAnimationFrame(tick);
  };

  tick();
}

function updateProgressFromAudio() {
  const audio = audioElement.value;
  if (!audio || !audio.duration || isSeeking.value || localSourceBusy.value) {
    return;
  }
  const lyricTime = audio.paused
    ? audio.currentTime
    : playbackClock.synchronize(audio, performance.now());
  lyricClockTime = lyricTime;
  syncDesktopLyricsTime(lyricTime);
  syncMiniPlayerTime(lyricTime);
  progress.value = playbackDuration.value > 0
    ? Math.min(100, (audio.currentTime / playbackDuration.value) * 100)
    : 0;
  const nextIndex = findActiveLyricIndex(lyricClockTime, lyricLines.value);
  if (nextIndex !== activeLyricIndex.value) {
    currentTime.value = lyricClockTime;
  }
  updateLyricHighlightDom(lyricClockTime);
  if (Math.abs(audio.currentTime - lastPlaybackStateSaveSecond) >= 5) {
    schedulePlaybackStateSave(0);
  }
  syncSystemMediaPosition();
  recordCurrentTrackListening(audio.currentTime);
  recordCurrentTrackScrobble(audio.currentTime);
  recordCurrentQqListening(audio.currentTime);
}

function updateMediaDuration() {
  const audio = audioElement.value;
  const duration = audio?.duration;
  mediaDuration.value = Number.isFinite(duration) && (duration ?? 0) > 0 ? duration : undefined;
  syncSystemMediaPosition();
  if (!audio || pendingSeekTime === undefined || mediaDuration.value === undefined) {
    return;
  }
  const targetTime = Math.min(pendingSeekTime, mediaDuration.value);
  audio.currentTime = targetTime;
  progress.value = playbackDuration.value > 0
    ? (targetTime / playbackDuration.value) * 100
    : 0;
  pendingSeekTime = undefined;
}

function handleAudioEnded() {
  stopPlaybackClock();
  resetListeningSample();
  resetCurrentScrobbleSample();
  void finishQqListeningSession();
  void persistPlaybackState();
  if (currentTrack.value.source === "netease" && isPreviewPlayback(currentTrack.value.duration, mediaDuration.value)) {
    isPlaying.value = false;
    scanError.value = "网易云当前只提供试听片段；完整播放需要登录拥有该歌曲播放权限的网易云账号。";
    return;
  }
  if (playMode.value === "single") {
    if (audioElement.value) {
      audioElement.value.currentTime = 0;
      void audioElement.value.play().then(() => {
        startListeningScrobbleSession(currentTrack.value);
        ensureQqListeningSession(currentTrack.value, audioElement.value?.currentTime ?? 0);
        startPlaybackClock();
      });
    }
    return;
  }

  const tracks = getPlaybackQueue();
  const currentIndex = findCurrentQueueIndex();
  if (playMode.value === "sequence" && currentIndex === tracks.length - 1) {
    isPlaying.value = false;
    return;
  }
  nextTrack();
}

async function handleAudioError() {
  const audio = audioElement.value;
  if (isQualityReloading) {
    return;
  }
  if (localAudioOverride.value && hasLocalAudioSources.value) {
    await switchLocalAudioSource({ provider: "local", quality: "local" }, true);
    return;
  }
  if (!isPlaybackStarting.value && audio && currentTrack.value.preferredLocalPlayback) {
    stopPlaybackClock();
    isPlaying.value = false;
    try {
      currentTrack.value = await playAudioWithNetworkFallback(
        audio,
        currentTrack.value,
        volume.value / 100,
        true
      );
      playbackClock.reset(audio, performance.now());
      isPlaying.value = true;
      scanError.value = "";
      startPlaybackClock();
      return;
    } catch {
      // Continue into the normal playback error state when the network source also fails.
    }
  }
  stopPlaybackClock();
  resetListeningSample();
  listeningScrobbleSession = undefined;
  isPlaying.value = false;
  scanError.value = currentTrack.value.source === "netease"
    ? "网易云音频加载失败，可能是版权或地区限制，请换一首歌曲。"
    : "当前音频格式无法播放，稍后会补充格式兼容处理。";
}

function showQueue() {
  queuePanelVisible.value = !queuePanelVisible.value;
}

async function locateCurrentQueueTrack() {
  queuePanelVisible.value = true;
  await nextTick();
  document.querySelector(".queue-track.active")?.scrollIntoView({ block: "center", behavior: "smooth" });
}

function playQueueTrack(track: Track) {
  void playTrack(track);
}

function appendQueueTrackToEnd(track: Track) {
  if (track.id === DEFAULT_TRACK_ID) {
    return;
  }
  playbackQueue.value = [...playbackQueue.value, createQueueTrack(track)];
  void persistPlaybackQueue();
}

function startQueueDrag(track: Track) {
  draggedQueueKey.value = track.queueKey ?? track.id;
}

function dropQueueTrack(targetTrack: Track) {
  const sourceKey = draggedQueueKey.value;
  const targetKey = targetTrack.queueKey ?? targetTrack.id;
  draggedQueueKey.value = null;
  if (!sourceKey || sourceKey === targetKey) {
    return;
  }

  const sourceIndex = findQueueIndexByKey(sourceKey);
  const targetIndex = findQueueIndexByKey(targetKey);
  if (sourceIndex < 0 || targetIndex < 0) {
    return;
  }

  const nextQueue = [...playbackQueue.value];
  const [movedTrack] = nextQueue.splice(sourceIndex, 1);
  nextQueue.splice(targetIndex, 0, movedTrack);
  playbackQueue.value = nextQueue;
  void persistPlaybackQueue();
}

function finishQueueDrag() {
  draggedQueueKey.value = null;
}

function removeQueueTrack(queueKey: string) {
  const currentQueueIndex = findCurrentQueueIndex();
  const removingIndex = findQueueIndexByKey(queueKey);
  if (removingIndex < 0) {
    return;
  }

  const isCurrentTrack = removingIndex === currentQueueIndex;
  const wasPlaying = isCurrentTrack && Boolean(audioElement.value && !audioElement.value.paused && !audioElement.value.ended);
  const nextQueueTrack = playbackQueue.value[removingIndex + 1];
  const previousQueueTrack = playbackQueue.value[removingIndex - 1];
  playbackQueue.value = playbackQueue.value.filter((track, index) => queueTrackKey(track, index) !== queueKey);
  void persistPlaybackQueue();

  if (!isCurrentTrack) {
    return;
  }

  audioElement.value?.pause();
  stopPlaybackClock();
  isPlaying.value = false;
  const replacement = nextQueueTrack ?? previousQueueTrack;
  if (replacement && wasPlaying) {
    void playTrack(replacement);
  } else if (!replacement) {
    resetPlayerToDefault();
  }
}

function clearPlaybackQueue() {
  playbackQueue.value = [];
  void persistPlaybackQueue();
  resetPlayerToDefault();
}

function resetPlayerToDefault() {
  trackAssetRequestId += 1;
  isPlaybackStarting.value = false;
  audioElement.value?.pause();
  void finishQqListeningSession();
  if (audioElement.value) {
    audioElement.value.removeAttribute("src");
    audioElement.value.load();
  }
  stopPlaybackClock();
  isPlaying.value = false;
  currentTrack.value = defaultTrack;
  progress.value = 0;
  currentTime.value = 0;
  mediaDuration.value = undefined;
  pendingSeekTime = undefined;
  lyricClockTime = 0;
  lyricLines.value = [];
  resetLyricHighlightDom();
  currentCoverFailedKey.value = "";
  currentCoverFallbackActive.value = false;
  void persistPlaybackState();
}

function cyclePlayerBarPlayMode() {
  const modes: PlayMode[] = ["sequence", "loop", "single", "shuffle"];
  const currentIndex = modes.indexOf(playMode.value);
  playMode.value = modes[(currentIndex + 1) % modes.length];
  void persistPlaybackState();
}

function selectPlayMode(mode: PlayMode) {
  playMode.value = mode;
  void persistPlaybackState();
}

let miniModeRequestId = 0;
let miniQueueResizeRequestId = 0;
let miniQueueLeaveResolver: (() => void) | null = null;

function waitForMiniQueueLeave() {
  return new Promise<void>((resolve) => {
    miniQueueLeaveResolver = resolve;
  });
}

function handleMiniQueueTransitionEnd() {
  const resolve = miniQueueLeaveResolver;
  miniQueueLeaveResolver = null;
  resolve?.();
}

async function setMiniQueueVisible(visible: boolean) {
  const requestId = ++miniQueueResizeRequestId;
  handleMiniQueueTransitionEnd();
  if (!nativeMiniMode.value) {
    miniQueueShellOpen.value = visible;
    miniQueueVisible.value = visible;
    return;
  }

  if (visible) {
    miniQueueShellOpen.value = true;
    miniQueueVisible.value = true;
    await nextTick();
    try {
      const resized = await window.listenMusic?.setMiniQueueExpanded(true);
      if (requestId !== miniQueueResizeRequestId) return;
      if (resized === false) {
        miniQueueShellOpen.value = false;
        miniQueueVisible.value = false;
      }
    } catch {
      if (requestId === miniQueueResizeRequestId) {
        miniQueueShellOpen.value = false;
        miniQueueVisible.value = false;
      }
    }
    return;
  }

  const leaveFinished = waitForMiniQueueLeave();
  miniQueueVisible.value = false;
  try {
    const [, resized] = await Promise.all([
      leaveFinished,
      window.listenMusic?.setMiniQueueExpanded(false)
    ]);
    if (requestId !== miniQueueResizeRequestId) return;
    miniQueueShellOpen.value = false;
    if (resized === false) {
      miniQueueVisible.value = false;
    }
  } catch {
    if (requestId === miniQueueResizeRequestId) {
      miniQueueShellOpen.value = false;
      miniQueueVisible.value = false;
    }
  }
}

function toggleMiniQueue() {
  void setMiniQueueVisible(!miniQueueVisible.value);
}

function dismissMiniQueue() {
  if (miniQueueVisible.value) void setMiniQueueVisible(false);
}

function addMiniQueueTrackToPlaylist(track: Track, playlistId: string) {
  const playlist = playlistOverviewSource.value.find((item) => item.id === playlistId);
  if (!playlist) return;
  trackPlaylistPicker.value = { tracks: [track], mode: "regular" };
  void addTrackToRegularPlaylist(playlist);
}

function createMiniPlaylistWithTrack(track: Track, name: string) {
  const playlist = createUserPlaylist(name.trim());
  localPlaylistTrackMap.value = {
    ...localPlaylistTrackMap.value,
    [playlist.id]: [{ ...track }]
  };
  persistLocalPlaylists();
  scanNotice.value = `已新建「${playlist.title}」并加入「${track.title}」。`;
}

async function copyMiniQueueTrackInfo(track: Track) {
  const text = `${track.title} - ${track.artist}`;
  try {
    if (window.listenMusic?.copyText) {
      await window.listenMusic.copyText(text);
    } else {
      await navigator.clipboard.writeText(text);
    }
    scanNotice.value = `已复制：${text}`;
  } catch {
    scanError.value = "复制歌曲信息失败，请稍后再试。";
  }
}

async function openMiniPlayer() {
  const requestId = ++miniModeRequestId;
  const enterMiniMode = window.listenMusic?.enterMiniMode;
  miniPlayerVisible.value = !enterMiniMode;
  miniQueueVisible.value = false;
  miniQueueShellOpen.value = false;
  showSongDetail.value = false;
  queuePanelVisible.value = false;
  authPanelVisible.value = false;

  nativeMiniMode.value = false;
  await nextTick();
  if (!enterMiniMode) return;

  try {
    syncMiniPlayerSnapshot();
    const entered = await enterMiniMode({
      showInTaskbar: appearancePreferences.value.playerControls.miniShowInTaskbar,
      alwaysOnTop: appearancePreferences.value.playerControls.miniAlwaysOnTop
    });
    if (requestId === miniModeRequestId) {
      nativeMiniMode.value = entered;
      miniPlayerVisible.value = true;
      if (entered) syncMiniPlayerSnapshot();
    }
  } catch {
    if (requestId === miniModeRequestId) {
      nativeMiniMode.value = false;
      miniPlayerVisible.value = true;
    }
  }
}

function miniPresentationTrack(track: Track): MiniPlayerTrack {
  return { id: track.id, title: track.title, artist: track.artist, album: track.album,
    duration: track.duration, primary: track.primary, secondary: track.secondary,
    mark: track.mark, liked: track.liked, history: track.history, queueKey: track.queueKey };
}

function syncMiniPlayerSnapshot() {
  const bridge = window.listenMusic;
  if (!bridge?.updateMiniPlayerSnapshot) return;
  const snapshot: MiniPlayerSnapshot = {
    track: miniPresentationTrack(currentTrack.value),
    queue: playbackQueue.value.map((track, index) => ({ ...miniPresentationTrack(track), queueKey: queueTrackKey(track, index) })),
    playlists: playlistOverviewSource.value.map(({ id, title, count }) => ({ id, title, count })),
    coverUrl: currentCoverUrl.value,
    isPlaying: isPlaying.value, progress: progress.value, lyric: currentLyricText.value,
    lyricLines: lyricLines.value, source: currentTrack.value.source, lyricsFormat: currentTrack.value.lyricsFormat,
    lyricsSource: currentTrack.value.lyricsSource,
    themeStyle: songDetailThemeStyle.value, preferences: appearancePreferences.value.miniPlayer,
    volume: volume.value, playMode: playMode.value, currentTime: lyricClockTime,
    duration: playbackDuration.value, alwaysOnTop: appearancePreferences.value.playerControls.miniAlwaysOnTop,
    showInTaskbar: appearancePreferences.value.playerControls.miniShowInTaskbar
  };
  bridge.updateMiniPlayerSnapshot(JSON.parse(JSON.stringify(snapshot)));
}

function handleMiniPlayerAction(action: MiniPlayerAction) {
  switch (action.type) {
    case "toggle": void togglePlayback(); return;
    case "previous": void previousTrack(); return;
    case "next": void nextTrack(); return;
    case "like": void toggleLiked(); return;
    case "mode": cyclePlayerBarPlayMode(); return;
    case "volume": updateVolume(action.value); return;
    case "pin": appearancePreferences.value.playerControls.miniAlwaysOnTop = action.value; return;
    case "appearance": appearancePreferences.value.miniPlayer = action.preferences; return;
  }
  if (!("key" in action)) return;
  const track = playbackQueue.value.find((item, index) => queueTrackKey(item, index) === action.key || (!item.queueKey && item.id === action.key));
  if (!track) return;
  switch (action.type) {
    case "queue-play": void playQueueTrack(track); break;
    case "queue-like": void toggleTrackLiked(track); break;
    case "queue-remove": removeQueueTrack(action.key); break;
    case "queue-copy": void copyMiniQueueTrackInfo(track); break;
    case "queue-add": addMiniQueueTrackToPlaylist(track, action.playlistId); break;
    case "queue-create": createMiniPlaylistWithTrack(track, action.name); break;
  }
}

watch([currentTrack, playbackQueue, playlistOverviewSource, currentCoverUrl, isPlaying,
  currentLyricText, lyricLines, songDetailThemeStyle, appearancePreferences, volume,
  playMode, playbackDuration], () => {
  if (!nativeMiniMode.value || miniSnapshotTimer !== undefined) return;
  miniSnapshotTimer = window.setTimeout(() => { miniSnapshotTimer = undefined; syncMiniPlayerSnapshot(); }, 80);
}, { deep: true });

function syncMiniPlayerTime(time: number, force = false) {
  if (!nativeMiniMode.value || !Number.isFinite(time)) return;
  const now = performance.now();
  if (!force && now - lastMiniPlayerTimeSentAt < 100) return;
  lastMiniPlayerTimeSentAt = now;
  const progress = playbackDuration.value > 0 ? Math.max(0, Math.min(100, time / playbackDuration.value * 100)) : 0;
  window.listenMusic?.updateMiniPlayerTime?.(time, progress);
}

watch(currentTime, time => syncMiniPlayerTime(time, true));

function handlePlayerBarProximity(event: PointerEvent) {
  if (appearancePreferences.value.playerControls.visibility !== "hover") return;
  playerBarPointerNearby.value = event.clientY >= window.innerHeight - 112;
}

function clearPlayerBarProximity() {
  if (appearancePreferences.value.playerControls.visibility === "hover") {
    playerBarPointerNearby.value = false;
  }
}

async function closeMiniPlayer() {
  const requestId = ++miniModeRequestId;
  miniQueueVisible.value = false;
  miniQueueShellOpen.value = false;
  if (nativeMiniMode.value) {
    try {
      const restored = await window.listenMusic?.exitMiniMode();
      if (restored === false || requestId !== miniModeRequestId) return;
    } catch {
      return;
    }
  }
  nativeMiniMode.value = false;
  miniPlayerVisible.value = false;
}

function resumeLyricsFollow() {
  if (resumeLyricsFollowTimer) {
    window.clearTimeout(resumeLyricsFollowTimer);
  }
  resumeLyricsFollowTimer = window.setTimeout(() => {
    lastAutoFollowItemId = "";
    manualLyricsScroll.value = false;
  }, 3000);
}

function handleLyricsManualScroll() {
  cancelLyricAutoScroll();
  manualLyricsScroll.value = true;
  lyricAnchorVisible.value = true;
  lastAutoFollowItemId = "";
  resumeLyricsFollow();
  if (lyricAnchorHideTimer) {
    window.clearTimeout(lyricAnchorHideTimer);
  }
  lyricAnchorHideTimer = window.setTimeout(() => {
    lyricAnchorVisible.value = false;
  }, 3000);
}

function handleLyricPointerDown(event: PointerEvent) {
  if (event.button !== 0 || (event.target as HTMLElement).closest("button")) {
    return;
  }
  const root = detailLyricsRef.value;
  if (!root) {
    return;
  }
  lyricDragPointerId = event.pointerId;
  lyricDragStartY = event.clientY;
  lyricDragStartScrollTop = root.scrollTop;
  lyricsDragging.value = true;
  root.setPointerCapture(event.pointerId);
  handleLyricsManualScroll();
}

function handleLyricPointerMove(event: PointerEvent) {
  if (event.pointerId !== lyricDragPointerId) {
    return;
  }
  const root = detailLyricsRef.value;
  if (!root) {
    return;
  }
  root.scrollTop = lyricDragStartScrollTop - (event.clientY - lyricDragStartY);
  event.preventDefault();
  handleLyricsManualScroll();
}

function handleLyricPointerEnd(event: PointerEvent) {
  if (event.pointerId !== lyricDragPointerId) {
    return;
  }
  const root = detailLyricsRef.value;
  if (root?.hasPointerCapture(event.pointerId)) {
    root.releasePointerCapture(event.pointerId);
  }
  lyricsDragging.value = false;
  lyricDragPointerId = undefined;
  handleLyricsManualScroll();
}

function firstLyricTextCenter(line: HTMLElement) {
  const original = line.querySelector<HTMLElement>(".lyric-original") ?? line;
  const walker = document.createTreeWalker(original, NodeFilter.SHOW_TEXT);
  let node: Node | null;
  while ((node = walker.nextNode())) {
    const start = node.textContent?.search(/\S/) ?? -1;
    if (start < 0) continue;
    const range = document.createRange();
    range.setStart(node, start);
    range.setEnd(node, start + 1);
    const rect = range.getBoundingClientRect();
    if (rect.height > 0) return rect.top + rect.height / 2;
  }
  const rect = original.getBoundingClientRect();
  return rect.top + rect.height / 2;
}

function updateLyricAnchorFromScroll() {
  const root = detailLyricsRef.value;
  if (!root) {
    return;
  }

  const availableWidth = Math.max(0, window.innerWidth - Math.max(0, root.getBoundingClientRect().left));
  root.style.maxWidth = `${availableWidth}px`;
  const anchorOffset = root.clientHeight * 0.38 - 42;
  // CSS percentage offsets exclude the scroller padding; share the measured anchor instead.
  root.style.setProperty("--lyric-anchor-offset", `${anchorOffset}px`);
  const songInfoLines = root.querySelectorAll<HTMLElement>("[data-song-info-line]");
  const lyricLineElements = root.querySelectorAll<HTMLElement>("[data-lyric-index]");
  lyricLineElements.forEach((line) => {
    const original = line.querySelector<HTMLElement>(".lyric-original");
    if (original) {
      // Reserve the centered 1.25x transform's overhang for every wrapped line.
      line.style.setProperty("--lyric-scale-room", `${original.offsetHeight * 0.125}px`);
    }
  });
  const firstSongInfoLine = songInfoLines.item(0);
  const firstTimelineItem = firstSongInfoLine ?? lyricLineElements.item(0);
  if (firstTimelineItem) {
    const rootRect = root.getBoundingClientRect();
    const firstTimelineCenterWithoutSpacer = root.scrollTop
      + firstLyricTextCenter(firstTimelineItem)
      - rootRect.top
      - lyricStartSpacerHeight.value;
    lyricStartSpacerHeight.value = Math.max(
      0,
      anchorOffset - firstTimelineCenterWithoutSpacer
    );
  } else {
    lyricStartSpacerHeight.value = 0;
  }
  const lastLyricLine = lyricLineElements.item(lyricLineElements.length - 1);
  const lyricList = lastLyricLine?.closest<HTMLElement>(".song-detail-lyrics-list");
  const listPaddingBottom = lyricList
    ? Number.parseFloat(window.getComputedStyle(lyricList).paddingBottom) || 0
    : 0;
  const scrollPaddingBottom = Number.parseFloat(window.getComputedStyle(root).paddingBottom) || 0;
  lyricEndSpacerHeight.value = lastLyricLine
    ? Math.max(0, root.clientHeight - anchorOffset
      - (lastLyricLine.getBoundingClientRect().bottom - firstLyricTextCenter(lastLyricLine))
      - listPaddingBottom - scrollPaddingBottom)
    : 0;
  const anchorY = root.getBoundingClientRect().top + anchorOffset;
  let nextPrefaceAnchorLineIndex = -1;
  songInfoLines.forEach((line, index) => {
    const lineRect = line.getBoundingClientRect();
    if (lineRect.top <= anchorY && lineRect.bottom >= anchorY) {
      nextPrefaceAnchorLineIndex = index;
    }
  });
  prefaceAnchorLineIndex.value = nextPrefaceAnchorLineIndex;
  prefaceAnchorActive.value = nextPrefaceAnchorLineIndex >= 0;
  if (prefaceAnchorActive.value) {
    lyricAnchorIndex.value = -1;
    return;
  }

  let nextAnchorIndex = -1;
  root.querySelectorAll<HTMLElement>("[data-lyric-index]").forEach((line) => {
    const index = Number(line.dataset.lyricIndex);
    if (!Number.isInteger(index)) {
      return;
    }
    const lineRect = line.getBoundingClientRect();
    if (lineRect.top <= anchorY && lineRect.bottom >= anchorY) {
      nextAnchorIndex = index;
    }
  });
  lyricAnchorIndex.value = nextAnchorIndex;
}

function handleLyricScroll() {
  if (lyricAutoScrollActive || lyricAnchorScrollFrame !== undefined) {
    return;
  }
  lyricAnchorScrollFrame = window.requestAnimationFrame(() => {
    lyricAnchorScrollFrame = undefined;
    updateLyricAnchorFromScroll();
  });
}

function cancelLyricAutoScroll() {
  if (lyricAutoScrollFrame !== undefined) {
    window.cancelAnimationFrame(lyricAutoScrollFrame);
    lyricAutoScrollFrame = undefined;
  }
  lyricAutoScrollActive = false;
}

function animateLyricScroll(root: HTMLElement, targetTop: number) {
  cancelLyricAutoScroll();
  const maximumTop = Math.max(0, root.scrollHeight - root.clientHeight);
  const startTop = root.scrollTop;
  const endTop = Math.max(0, Math.min(maximumTop, targetTop));
  const distance = endTop - startTop;
  if (Math.abs(distance) < 1) {
    root.scrollTop = endTop;
    updateLyricAnchorFromScroll();
    return;
  }

  const startedAt = performance.now();
  const duration = Math.min(420, Math.max(280, Math.abs(distance) * 1.15));
  lyricAutoScrollActive = true;
  const tick = (now: number) => {
    if (root !== detailLyricsRef.value) {
      cancelLyricAutoScroll();
      return;
    }
    const progress = Math.min(1, (now - startedAt) / duration);
    const easedProgress = progress < 0.5
      ? 4 * progress * progress * progress
      : 1 - Math.pow(-2 * progress + 2, 3) / 2;
    root.scrollTop = startTop + distance * easedProgress;
    if (progress < 1) {
      lyricAutoScrollFrame = window.requestAnimationFrame(tick);
      return;
    }
    lyricAutoScrollFrame = undefined;
    updateLyricAnchorFromScroll();
    lyricAutoScrollActive = false;
  };
  lyricAutoScrollFrame = window.requestAnimationFrame(tick);
}

function followActiveLyricItem(root: HTMLElement, activeLine: HTMLElement) {
  const rootRect = root.getBoundingClientRect();
  const anchorOffset = root.clientHeight * 0.38 - 42;
  const targetTop = root.scrollTop
    + firstLyricTextCenter(activeLine)
    - rootRect.top
    - anchorOffset;
  animateLyricScroll(root, targetTop);
}

async function refreshLyricLayout() {
  await nextTick();
  updateLyricAnchorFromScroll();
  await nextTick();
  const root = detailLyricsRef.value;
  const activeLine = root?.querySelector<HTMLElement>(".lyric-line.is-active");
  if (root && activeLine && isPlaying.value && !manualLyricsScroll.value) {
    followActiveLyricItem(root, activeLine);
  }
}

function handleLyricViewportResize() {
  if (lyricResizeFrame !== undefined) window.cancelAnimationFrame(lyricResizeFrame);
  lyricResizeFrame = window.requestAnimationFrame(() => {
    lyricResizeFrame = undefined;
    void refreshLyricLayout();
  });
}

watch(detailLyricsRef, (root, _previous, onCleanup) => {
  if (!root) return;
  const observer = new ResizeObserver(() => { void refreshLyricLayout(); });
  observer.observe(root);
  onCleanup(() => observer.disconnect());
});
watch(() => appearancePreferences.value.lyrics, refreshLyricLayout, { deep: true });

watch([activeLyricIndex, showSongDetail, lyricLines, manualLyricsScroll, isPlaying], async () => {
  if (!showSongDetail.value) {
    return;
  }
  await nextTick();
  updateSongInfoHighlightDom(lyricClockTime);
  updateLyricAnchorFromScroll();
  if (!isPlaying.value || manualLyricsScroll.value || activeLyricIndex.value < 0) {
    return;
  }
  updateLyricHighlightDom(lyricClockTime);
  const root = detailLyricsRef.value;
  const activeLine = root?.querySelector<HTMLElement>(".is-active");
  const activeItemId = `lyric:${activeLyricIndex.value}`;
  if (!root || !activeLine || lastAutoFollowItemId === activeItemId) {
    return;
  }
  followActiveLyricItem(root, activeLine);
  lastAutoFollowItemId = activeItemId;
});

onMounted(async () => {
  window.addEventListener("keydown", handleGlobalNavigationShortcut);
  window.addEventListener("resize", handleLyricViewportResize);
  window.addEventListener("focus", handleListeningStatsReconnect);
  window.addEventListener("focus", handleAudioOutputDeviceChange);
  window.addEventListener("online", handleListeningStatsReconnect);
  document.addEventListener("pointerdown", handleLocalToolMenuPointerDown);
  navigator.mediaDevices?.addEventListener?.("devicechange", handleAudioOutputDeviceChange);
  removeTaskbarMediaActionListener = window.listenMusic?.onTaskbarMediaAction(handleTaskbarMediaAction);
  removeTrayMediaActionListener = window.listenMusic?.onTrayMediaAction(handleTrayMediaAction);
  removeDesktopLyricsActionListener = window.listenMusic?.onDesktopLyricsAction(handleDesktopLyricsAction);
  removeMiniPlayerActionListener = window.listenMusic?.onMiniPlayerAction?.(handleMiniPlayerAction);
  removeMiniModeVisibilityListener = window.listenMusic?.onMiniModeVisibility?.((visible) => {
    nativeMiniMode.value = visible;
    miniPlayerVisible.value = visible;
    if (!visible) { miniQueueVisible.value = false; miniQueueShellOpen.value = false; }
  });
  removeShortcutActionListener = window.listenMusic?.onShortcutAction(handleShortcutAction);
  removeShortcutsChangedListener = window.listenMusic?.onShortcutsChanged((snapshot) => {
    globalShortcutsState.value = snapshot.config.enabled;
  });
  removeWindowCloseBehaviorListener = window.listenMusic?.onWindowCloseBehavior((behavior) => {
    if (behavior === "mini") void openMiniPlayer();
  });
  void window.listenMusic?.getShortcuts().then((snapshot) => {
    globalShortcutsState.value = snapshot.config.enabled;
  }).catch(() => {
    desktopIntegrationError.value = "无法读取全局快捷键状态。";
  });
  void window.listenMusic?.getLaunchAtStartup().then((enabled) => {
    launchAtStartup.value = enabled;
  }).catch(() => {
    desktopIntegrationError.value = "无法读取开机启动状态。";
  });
  let desktopLyricsVisibilityReceived = false;
  removeDesktopLyricsVisibilityListener = window.listenMusic?.onDesktopLyricsVisibilityChanged((visible) => {
    desktopLyricsVisibilityReceived = true;
    desktopLyricsVisible.value = visible;
  });
  void window.listenMusic?.getDesktopLyricsSnapshot().then((snapshot) => {
    if (snapshot && !desktopLyricsVisibilityReceived) {
      desktopLyricsVisible.value = snapshot.visible;
    }
  }).catch((error) => {
    console.warn("Failed to read desktop lyrics visibility", error);
  });
  if (taskbarThumbnailButtonsSupported) {
    void window.listenMusic?.setTaskbarThumbnailButtons(taskbarThumbnailButtonsEnabled.value, isPlaying.value);
    void window.listenMusic?.setSystemTrayEnabled(systemTrayEnabled.value, systemTrayState.value);
  }
  await refreshAudioOutputDevices();
  await applyAudioOutputPreferencesToPlayback();
  await migrateLegacyAggregatePlaylists();
  await refreshBackendData();
  if (autoScanLocalLibraryEnabled.value && (localLibraryRoots.value.length > 0 || musicFolder.value.trim())) {
    await scanMusicFolderIncrementally();
  }
});
onBeforeUnmount(() => {
  void finishQqListeningSession();
  if (qqListeningRetryTimer !== undefined) {
    window.clearTimeout(qqListeningRetryTimer);
    qqListeningRetryTimer = undefined;
  }
  window.removeEventListener("resize", handleLyricViewportResize);
  if (lyricResizeFrame !== undefined) window.cancelAnimationFrame(lyricResizeFrame);
  cancelLyricAutoScroll();
  if (lyricAnchorScrollFrame !== undefined) window.cancelAnimationFrame(lyricAnchorScrollFrame);
  playbackFadeToken += 1;
  activePlaybackFade = null;
  clearSleepTimerHandles();
  window.removeEventListener("keydown", handleGlobalNavigationShortcut);
  window.removeEventListener("focus", handleListeningStatsReconnect);
  window.removeEventListener("focus", handleAudioOutputDeviceChange);
  window.removeEventListener("online", handleListeningStatsReconnect);
  document.removeEventListener("pointerdown", handleLocalToolMenuPointerDown);
  navigator.mediaDevices?.removeEventListener?.("devicechange", handleAudioOutputDeviceChange);
  removeTaskbarMediaActionListener?.();
  removeTrayMediaActionListener?.();
  removeDesktopLyricsActionListener?.();
  removeShortcutActionListener?.();
  removeShortcutsChangedListener?.();
  removeWindowCloseBehaviorListener?.();
  removeDesktopLyricsVisibilityListener?.();
  removeMiniPlayerActionListener?.();
  removeMiniModeVisibilityListener?.();
  if (miniSnapshotTimer !== undefined) window.clearTimeout(miniSnapshotTimer);
  mediaSessionActions.forEach((action) => setMediaSessionAction(action, null));
  audioOutputController?.dispose();
  stopPlaybackClock();
  void persistPlaybackState();
  writeListeningStats(listeningStats.value);
  if (listeningStatsSaveTimer) {
    window.clearTimeout(listeningStatsSaveTimer);
    listeningStatsSaveTimer = undefined;
  }
  queueListeningStatsSave(listeningStats.value);
  if (resumeLyricsFollowTimer) {
    window.clearTimeout(resumeLyricsFollowTimer);
  }
  if (lyricAnchorHideTimer) {
    window.clearTimeout(lyricAnchorHideTimer);
  }
  if (playbackStateSaveTimer) {
    window.clearTimeout(playbackStateSaveTimer);
  }
  if (searchDebounceTimer) {
    window.clearTimeout(searchDebounceTimer);
  }
  if (searchToastTimer) {
    window.clearTimeout(searchToastTimer);
  }
  if (localLibraryScanToastTimer) {
    window.clearTimeout(localLibraryScanToastTimer);
  }
});
</script>

<template>
  <WindowTitlebar :dark="windowTitlebarDark" />
  <Transition :name="onboardingExitImmediately ? 'onboarding-shell-immediate' : 'onboarding-shell'" appear>
    <FirstRunOnboarding
      v-if="showFirstRunOnboarding && !nativeMiniMode"
      v-model="appearancePreferences"
      v-model:startup-preference="startupHome"
      v-model:login-preference="onboardingLoginPreference"
      v-model:netease-quality="neteasePlaybackQuality"
      v-model:audio-cache-policy="onlineAudioCachePolicy"
      v-model:audio-output-preferences="audioOutputPreferences"
      v-model:auto-scan-local-library="autoScanLocalLibraryEnabled"
      v-model:use-filename-metadata="useFilenameMetadataEnabled"
      v-model:local-lyrics-online-match="localLyricsOnlineMatchEnabled"
      v-model:close-behavior="desktopIntegrationPreferences.closeBehavior"
      v-model:taskbar-thumbnail-buttons="taskbarThumbnailButtonsEnabled"
      v-model:system-media-controls="desktopIntegrationPreferences.systemMediaControls"
      v-model:global-shortcuts="globalShortcutsEnabled"
      v-model:remember-playback-position="desktopIntegrationPreferences.rememberPlaybackPosition"
      :launch-at-startup="launchAtStartup"
      :launch-at-startup-pending="launchAtStartupPending"
      :global-shortcuts-pending="globalShortcutsPending"
      :desktop-integration-error="desktopIntegrationError"
      :audio-output-devices="audioOutputDevices"
      :audio-output-supported="audioOutputSupported"
      :audio-output-error="audioOutputError"
      :local-library-roots="localLibraryRoots"
      :local-library-pending="localLibraryScanPending"
      :local-library-notice="scanNotice"
      :local-library-error="scanError"
      :library-track-count="currentLibrary.length"
      :desktop-lyrics-visible="desktopLyricsVisible"
      :sleep-timer-remaining-seconds="sleepTimerRemainingSeconds"
      @toggle-desktop-lyrics="toggleDesktopLyrics"
      @toggle-sleep-timer="toggleOnboardingSleepTimer"
      @add-music-folder="chooseMusicFolderAndScan"
      @remove-music-folder="removeMusicFolderFromLibrary"
      @update:launch-at-startup="setLaunchAtStartupPreference"
      @complete="finishOnboarding"
      @skip="skipOnboarding"
    />
  </Transition>
  <div
    v-show="!nativeMiniMode"
    class="app-shell"
    :class="[{ 'is-sidebar-collapsed': sidebarCollapsed && activeView !== 'settings', 'is-onboarding-active': showFirstRunOnboarding }, appearanceClassNames]"
    :style="appearanceStyle"
    @pointermove="handlePlayerBarProximity"
    @pointerleave="clearPlayerBarProximity"
  >
    <div
      v-if="!showSongDetail"
      class="shell-controls"
      :class="{ 'is-sidebar-collapsed': sidebarCollapsed && activeView !== 'settings' }"
    >
      <button
        class="shell-control-button"
        :class="{ 'is-settings-back': activeView === 'settings' }"
        type="button"
        :title="activeView === 'settings' ? '返回' : sidebarCollapsed ? '展开侧栏' : '收起侧栏'"
        :aria-label="activeView === 'settings' ? '返回' : '菜单'"
        @click="handleShellMenuButton"
      >
        <span v-if="activeView === 'settings'" class="settings-back-icon" aria-hidden="true"></span>
        <span v-else aria-hidden="true">☰</span>
      </button>
      <button class="shell-control-button" type="button" title="设置" aria-label="设置" @click="openSettingsPage">
        <span aria-hidden="true">⚙</span>
      </button>
      <div class="account-menu-anchor">
        <button
          class="shell-control-button"
          :class="{ active: accountMenuVisible }"
          type="button"
          title="账号管理"
          aria-label="账号管理"
          :aria-expanded="accountMenuVisible"
          @click.stop="toggleAccountMenu"
        >
          <UserRound :size="18" :stroke-width="1.7" aria-hidden="true" />
        </button>
        <AccountMenu
          :visible="accountMenuVisible"
          :accounts="accounts"
          @close="closeAccountMenu"
          @login="openProviderAuthPanel"
          @logout="handleProviderLogout"
        />
      </div>
    </div>

    <div class="sidebar-slot" :class="{ 'is-collapsed': sidebarCollapsed && activeView !== 'settings' }">
      <aside v-if="activeView === 'settings'" class="settings-sidebar" aria-label="设置导航">
        <label class="settings-sidebar-search">
          <span aria-hidden="true">⌕</span>
          <input v-model="settingsSearchKeyword" type="search" placeholder="搜索设置" />
        </label>
        <nav class="settings-sidebar-nav" aria-label="设置分类">
          <button
            v-for="section in visibleSettingsSections"
            :key="section.id"
            type="button"
            :class="{ active: activeSettingsSection === section.id }"
            @click="activeSettingsSection = section.id"
          >
            <span aria-hidden="true">{{ section.icon }}</span>
            <strong>{{ section.title }}</strong>
          </button>
        </nav>
      </aside>
      <SidebarNav
        v-else
        :active-view="activeView"
        :mode="appMode"
        :account="account"
        :playlists="sidebarPlaylists"
        @navigate="selectView"
        @select-playlist="selectPlaylist"
        @toggle-mode="toggleAppMode"
        @login="openAuthPanel"
      />
    </div>

    <div class="workspace" :class="{ 'is-settings-workspace': activeView === 'settings' }">
      <main ref="mainScrollElement" class="main-scroll"
        :class="{ 'has-local-controls-inset': appMode === 'local' && ['library', 'artists', 'albums', 'playlists', 'aggregate', 'folders', 'history', 'playlist', 'liked'].includes(activeView) }"
        @scroll.passive="handleMainScroll">
        <Transition :name="pageTransitionName" mode="out-in" @before-enter="resetLocalPageScroll">
          <div :key="pageTransitionKey" class="page-transition-frame">
        <section
          v-if="activeView !== 'settings' && activeView !== 'playlists' && activeView !== 'aggregate' && activeView !== 'folders' && activeView !== 'history' && !['streaming-recent', 'listening-ranking', 'account-following', 'account-followers', 'account-user-profile'].includes(activeView) && !selectedPlaylist && !selectedLocalAlbum && !selectedStreamingArtist && !(appMode === 'local' && activeView === 'home' && !submittedKeyword) && !(appMode === 'local' && activeView === 'library' && !submittedKeyword) && !(appMode === 'local' && activeView === 'artists' && !submittedKeyword)"
          class="page-heading"
          :class="{
            'streaming-home-heading': appMode === 'streaming' && activeView === 'home' && !submittedKeyword,
            'is-discovery-heading': appMode === 'streaming' && activeView === 'discover' && !submittedKeyword,
            'is-qq-discovery-heading': appMode === 'streaming' && activeView === 'discover' && streamingSource === 'qq' && !submittedKeyword,
            'is-library-heading': appMode === 'streaming' && activeView === 'streaming-library' && !submittedKeyword,
            'is-cloud-heading': appMode === 'streaming' && activeView === 'cloud' && !submittedKeyword,
            'is-library-subpage-heading': appMode === 'streaming' && ['streaming-recent', 'listening-ranking'].includes(activeView) && !submittedKeyword,
            'is-search-heading': appMode === 'streaming' && Boolean(submittedKeyword)
          }"
        >
          <div>
            <p v-if="appMode === 'streaming' && submittedKeyword" class="eyebrow search-eyebrow">搜索</p>
            <p v-else-if="!(appMode === 'streaming' && ['home', 'cloud'].includes(activeView))" class="eyebrow">LISTEN TO WHAT MATTERS</p>
            <h1>{{ pageTitle }}</h1>
            <p v-if="!(appMode === 'streaming' && (submittedKeyword || activeView === 'cloud'))" class="page-subtitle">{{ pageSubtitle }}</p>
          </div>
          <template v-if="appMode === 'local'">
            <div class="page-actions" v-if="activeView === 'library'">
              <button class="report-link" type="button" @click="chooseMusicFolder">选择文件夹</button>
              <button class="report-link primary" type="button" @click="scanMusicFolder">扫描音乐</button>
            </div>
          </template>
          <div v-if="appMode === 'streaming' && ['home', 'discover', 'streaming-library', 'cloud'].includes(activeView)" class="streaming-home-tools">
            <div
              class="streaming-home-search"
              :class="{ 'is-focused': streamingSearchFocused }"
              role="search"
              @click="focusStreamingSearch"
            >
              <Search class="streaming-search-icon" :size="18" :stroke-width="1.7" aria-hidden="true" />
              <input
                ref="streamingSearchInput"
                v-model="keyword"
                type="text"
                placeholder="搜索歌曲、歌手、专辑或文件夹"
                aria-label="搜索歌曲、歌手、专辑或文件夹"
                @focus="streamingSearchFocused = true"
                @blur="streamingSearchFocused = false"
                @keydown.enter="submitSearch"
              />
              <button
                v-if="keyword"
                class="streaming-search-clear"
                type="button"
                aria-label="清空搜索"
                title="清空搜索"
                @mousedown.prevent
                @click.stop="clearStreamingSearch"
              >
                <X :size="13" :stroke-width="2" aria-hidden="true" />
              </button>
            </div>
            <div v-if="!submittedKeyword && !['streaming-library', 'cloud'].includes(activeView)" class="streaming-source-switch">
              <button
                class="streaming-source-trigger"
                :class="{ active: streamingSourceMenuVisible, 'is-qq': streamingSource === 'qq', 'has-avatar': selectedStreamingAccount?.avatarUrl }"
                type="button"
                aria-label="切换主页音源"
                :title="`当前音源：${streamingProviderName}`"
                :aria-expanded="streamingSourceMenuVisible"
                @click.stop="toggleStreamingSourceMenu"
              >
                <img
                  v-if="selectedStreamingAccount?.avatarUrl"
                  class="streaming-source-trigger-avatar"
                  :src="selectedStreamingAccount.avatarUrl"
                  :alt="`${selectedStreamingAccount.nickname}头像`"
                />
                <Cloud v-else :size="18" :stroke-width="1.7" aria-hidden="true" />
                <ChevronDown :size="12" :stroke-width="1.8" aria-hidden="true" />
              </button>
              <Transition name="source-menu">
                <div v-if="streamingSourceMenuVisible" class="streaming-source-layer">
                  <button class="streaming-source-backdrop" type="button" aria-label="关闭音源菜单" @click="streamingSourceMenuVisible = false"></button>
                  <div class="streaming-source-menu" role="menu" aria-label="主页音源">
                    <button type="button" role="menuitemradio" :aria-checked="streamingSource === 'netease'" @click="selectStreamingSource('netease')">
                      <img
                        v-if="neteaseAccount?.avatarUrl"
                        class="streaming-source-mark is-avatar"
                        :src="neteaseAccount.avatarUrl"
                        :alt="`${neteaseAccount.nickname}头像`"
                      />
                      <span v-else class="streaming-source-mark is-netease" aria-hidden="true">易</span>
                      <span><strong>网易云音乐</strong><small>{{ accounts.some((item) => item.provider === 'netease') ? '已登录' : '未登录' }}</small></span>
                      <Check v-if="streamingSource === 'netease'" :size="16" :stroke-width="2" aria-hidden="true" />
                    </button>
                    <button type="button" role="menuitemradio" :aria-checked="streamingSource === 'qq'" @click="selectStreamingSource('qq')">
                      <img
                        v-if="qqAccount?.avatarUrl"
                        class="streaming-source-mark is-avatar"
                        :src="qqAccount.avatarUrl"
                        :alt="`${qqAccount.nickname}头像`"
                      />
                      <span v-else class="streaming-source-mark is-qq" aria-hidden="true">Q</span>
                      <span><strong>QQ 音乐</strong><small>{{ accounts.some((item) => item.provider === 'qq') ? '已登录' : '未登录' }}</small></span>
                      <Check v-if="streamingSource === 'qq'" :size="16" :stroke-width="2" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </Transition>
            </div>
          </div>
        </section>

        <StreamingSearchPage
          v-if="appMode === 'streaming' && submittedKeyword && !selectedPlaylist && !selectedStreamingArtist"
          :keyword="submittedKeyword"
          :tab="searchTab"
          :provider="streamingSource"
          :tracks="catalogResults"
          :playlists="searchPlaylists"
          :artists="searchArtists"
          :page="searchPage"
          :page-size="searchPageSize"
          :total="searchTotal"
          :loading="searchState === 'loading'"
          :error="searchError"
          :current-track-id="currentTrack.id"
          :playing="isPlaying"
          @change-tab="changeSearchTab"
          @change-provider="selectStreamingSource"
          @change-page="changeSearchPage"
          @play-track="playTrack"
          @toggle-favorite="toggleTrackLiked"
          @context-menu="openTrackContextMenu($event.track, $event.event, catalogResults)"
          @select-playlist="selectPlaylist"
          @play-playlist="playPlaylist"
          @select-artist="selectStreamingArtist"
        />

        <StreamingArtistDetailPage
          v-if="appMode === 'streaming' && selectedStreamingArtist"
          :artist="selectedStreamingArtist"
          :detail="streamingArtistDetail"
          :tracks="streamingArtistTracks"
          :albums="streamingArtistAlbums"
          :playlists="streamingArtistPlaylists"
          :active-tab="streamingArtistTab"
          :loading="streamingArtistState === 'loading'"
          :error="streamingArtistError"
          :followed="streamingArtistFollowed"
          :follow-pending="streamingArtistFollowPending"
          :current-track-id="currentTrack.id"
          :playing="isPlaying"
          :tracks-total="streamingArtistTracksTotal"
          :tracks-has-more="streamingArtistTracksHasMore"
          :tracks-loading-more="streamingArtistTracksLoading"
          :albums-total="streamingArtistAlbumsTotal"
          :albums-has-more="streamingArtistAlbumsHasMore"
          :albums-loading-more="streamingArtistAlbumsLoading"
          @back="closeStreamingArtistDetail"
          @tab-change="changeStreamingArtistTab"
          @play-all="playStreamingArtistTracks(false)"
          @play-random="playStreamingArtistTracks(true)"
          @play-track="playTrack"
          @context-menu="openTrackContextMenu($event.track, $event.event, streamingArtistTracks)"
          @toggle-follow="toggleStreamingArtistFollow"
          @toggle-favorite="toggleTrackLiked"
        />

        <StreamingLibraryPage
          v-if="appMode === 'streaming' && activeView === 'streaming-library' && !submittedKeyword"
          :account="selectedStreamingAccount"
          :accounts="accounts"
          :profile="accountProfile"
          :following-count="Math.max(accountProfile?.follows ?? 0, accountFollowing.length)"
          :favorite-tracks="accountFavoriteTracks"
          :recent-tracks="accountRecentTracks"
          :ranking-tracks="accountListeningRank"
          :playlists="accountLibraryPlaylists"
          :provider="streamingSource"
          :loading="accountContentState === 'loading'"
          :error="accountContentError"
          @change-provider="selectStreamingSource"
          @open-following="openAccountSocial('following')"
          @open-followers="openAccountSocial('followers')"
          @open-favorites="openAccountFavorites"
          @play-favorites="playAccountFavorites"
          @open-recent="openStreamingLibraryView('streaming-recent')"
          @open-ranking="openStreamingLibraryView('listening-ranking')"
          @open-playlist="openAccountPlaylistInUnifiedView"
          @create-playlist="openStreamingPlaylistCreateDialog"
          @delete-playlist="deleteStreamingPlaylist"
          @login="openProviderAuthPanel(streamingSource)"
        />

        <StreamingCloudPage
          v-if="appMode === 'streaming' && activeView === 'cloud' && !submittedKeyword"
          :account="neteaseAccount"
          provider-name="网易云音乐"
          :tracks="cloudTracks"
          :loading="cloudState === 'loading'"
          :uploading="cloudUploading"
          :error="cloudError"
          :current-track-id="currentTrack.id"
          :playing="isPlaying"
          @upload="uploadCloudTracks"
          @refresh="refreshCloudData"
          @play-all="playAllCloudTracks"
          @play-track="playCloudTrack"
          @context-menu="openCloudTrackContextMenu"
          @download="saveCloudTrack"
          @login="openProviderAuthPanel('netease')"
        />

        <StreamingSocialPage
          v-if="appMode === 'streaming' && ['account-following', 'account-followers'].includes(activeView) && !submittedKeyword && !selectedStreamingArtist"
          :mode="activeView === 'account-following' ? 'following' : 'followers'"
          :users="activeView === 'account-following' ? accountFollowing : accountFollowers"
          :total="activeView === 'account-following' ? Math.max(accountProfile?.follows ?? 0, (accountSocialPage - 1) * ACCOUNT_SOCIAL_PAGE_SIZE + accountFollowing.length) : Math.max(accountProfile?.followers ?? 0, (accountSocialPage - 1) * ACCOUNT_SOCIAL_PAGE_SIZE + accountFollowers.length)"
          :page="accountSocialPage"
          :page-size="ACCOUNT_SOCIAL_PAGE_SIZE"
          :has-more="accountSocialHasMore"
          v-model:search-keyword="keyword"
          :loading="accountSocialState === 'loading'"
          :error="accountSocialError"
          @back="navigateBack"
          @search="performSearch(1)"
          @change-page="changeAccountSocialPage"
          @open-user="openSocialUser"
          @open-artist="openSocialArtist"
        />

        <StreamingUserProfilePage
          v-if="appMode === 'streaming' && activeView === 'account-user-profile' && !submittedKeyword"
          :profile="selectedSocialProfile"
          v-model:search-keyword="keyword"
          :loading="selectedSocialProfileState === 'loading'"
          :error="selectedSocialProfileError"
          @back="navigateBack"
          @search="performSearch(1)"
        />

        <StreamingDailyMixPage
          v-if="appMode === 'streaming' && activeView === 'history' && !submittedKeyword"
          :tracks="historySourceTracks"
          :provider-name="historySourceName"
          :current-track-id="currentTrack.id"
          :is-playing="isPlaying || isPlaybackStarting"
          :cover-url="historySourceTracks[0]?.coverUrl"
          :refreshing="historyRefreshing"
          :reorderable="false"
          :source-options="historySourceOptions"
          :source-value="historySourceFilter"
          cover-mark="近"
          title="最近播放"
          label="最近"
          @back="navigateBack"
          @play="playHistoryTrackById"
          @context-menu="openTrackContextMenu($event.track, $event.event, historySourceTracks)"
          @play-all="playHistoryTrackList"
          @play-random="playHistoryTrackListRandom"
          @toggle-favorite="toggleHistoryTrackFavorite"
          @source-change="changeHistorySource"
          @refresh="refreshHistoryTracks"
          @search-global="searchFromStreamingDailyMix"
        />

        <StreamingDailyMixPage
          v-if="appMode === 'streaming' && activeView === 'streaming-recent' && !submittedKeyword"
          :tracks="accountRecentTracks"
          :provider-name="streamingProviderName"
          :current-track-id="currentTrack.id"
          :is-playing="isPlaying || isPlaybackStarting"
          :cover-url="accountRecentTracks[0]?.coverUrl"
          :refreshing="accountContentState === 'loading'"
          :reorderable="false"
          batch-mode="recent"
          :run-batch="runAccountRecentTrackBatch"
          :mutation-pending="playlistMutationPending"
          title="最近播放"
          label="最近"
          @back="navigateBack"
          @play="playAccountRecentTrack"
          @context-menu="openTrackContextMenu($event.track, $event.event, accountRecentTracks)"
          @play-all="playAccountRecentTrackList"
          @play-random="playAccountRecentTrackListRandom"
          @toggle-favorite="toggleAccountRecentFavorite"
          @refresh="refreshStreamingLibraryData"
          @search-global="searchFromStreamingDailyMix"
        />

        <StreamingDailyMixPage
          v-if="appMode === 'streaming' && activeView === 'listening-ranking' && !submittedKeyword"
          :tracks="accountListeningRank"
          :provider-name="streamingProviderName"
          :current-track-id="currentTrack.id"
          :is-playing="isPlaying || isPlaybackStarting"
          :cover-url="accountListeningRank[0]?.coverUrl"
          :refreshing="qqListeningRankPending"
          :reorderable="false"
          title="听歌排行"
          label="排行"
          @back="navigateBack"
          @play="playAccountListeningRankTrack"
          @context-menu="openTrackContextMenu($event.track, $event.event, accountListeningRank)"
          @play-all="playAccountListeningRankTrackList"
          @play-random="playAccountListeningRankTrackListRandom"
          @toggle-favorite="toggleAccountListeningRankFavorite"
          @refresh="refreshAccountListeningRank"
          @search-global="searchFromStreamingDailyMix"
        >
          <template #toolbar-tools>
            <div class="qq-listening-range" :aria-label="`${streamingProviderName}听歌排行时间范围`">
              <div class="qq-listening-range-options" role="group" aria-label="排行范围">
                <button type="button" :disabled="qqListeningRankPending" :class="{ active: qqListeningRankPeriod === 'week' }" @click="changeQqListeningRankPeriod('week')">最近一周</button>
                <button type="button" :disabled="qqListeningRankPending" :class="{ active: qqListeningRankPeriod === 'all' }" @click="changeQqListeningRankPeriod('all')">全部</button>
              </div>
              <p v-if="qqListeningRankError" class="qq-listening-range-error" role="status">{{ qqListeningRankError }}</p>
            </div>
          </template>
        </StreamingDailyMixPage>

        <AggregatePlaylistPage
          v-if="activeView === 'aggregate'"
          :playlists="aggregatePlaylists"
          :available-sources="availableAggregateSources"
          @create="handleCreateAggregatePlaylist"
          @play="playAggregateSource"
          @play-list="playAggregatePlaylistSources"
          @remove-group="removeGroupFromAggregatePlaylist"
          @reorder="reorderAggregatePlaylistGroups"
          @set-cover="chooseAggregatePlaylistCover"
        />

        <Transition name="settings-toast">
          <div
            v-if="localLibraryScanToastVisible"
            class="settings-scan-toast"
            :class="{ error: Boolean(scanError) }"
            role="status"
            aria-live="polite"
          >
            <RefreshCw
              :size="18"
              :class="{ 'is-spinning': localLibraryScanPending }"
              aria-hidden="true"
            />
            <div>
              <strong>{{ localLibraryScanPending ? "正在扫描" : scanError ? "扫描失败" : "扫描完成" }}</strong>
              <span>{{ scanError || scanNotice }}</span>
            </div>
          </div>
        </Transition>

        <template v-if="activeView === 'settings'">
          <section class="settings-page" aria-label="设置">
            <header class="settings-page-header">
              <p class="eyebrow">TIAOLV MUSIC SETTINGS</p>
              <h1>{{ activeSettingsTitle }}</h1>
              <p>管理调律音乐的本地音乐库、播放体验和界面偏好。</p>
            </header>

            <template v-if="activeSettingsSection === 'general'">
            <article class="settings-card">
              <div class="settings-card-heading">
                <span class="settings-icon" aria-hidden="true">⌂</span>
                <div>
                  <h2>本地音乐库设置</h2>
                  <p>管理本地音乐文件夹和扫描记录。</p>
                </div>
              </div>

              <div class="settings-field settings-library-field">
                <div class="settings-library-path">
                  <span>已添加音乐库文件夹</span>
                  <strong>{{ localLibraryRoots.length > 0 ? `${localLibraryRoots.length} 个文件夹` : "未选择" }}</strong>
                  <span v-for="root in localLibraryRoots" :key="root" class="settings-library-root">{{ root }}</span>
                </div>
                <div class="settings-actions">
                  <button class="settings-action" type="button" :disabled="localLibraryScanPending" @click="chooseMusicFolder">
                    <FolderOpen :size="15" aria-hidden="true" />
                    选择本地音乐库
                  </button>
                  <button
                    class="settings-action primary"
                    type="button"
                    :disabled="localLibraryScanPending || (localLibraryRoots.length === 0 && !musicFolder.trim())"
                    :aria-busy="localLibraryScanPending"
                    @click="scanMusicFolderIncrementally"
                  >
                    <RefreshCw :size="15" :class="{ 'is-spinning': localLibraryScanPending }" aria-hidden="true" />
                    扫描音乐库
                  </button>
                  <button class="settings-action danger" type="button" :disabled="localLibraryScanPending" @click="handleResetLocalLibrary">
                    <span aria-hidden="true">↺</span>
                    重置音乐库
                  </button>
                </div>
              </div>

              <div class="settings-toggle-field">
                <div>
                  <strong>自动扫描音乐库</strong>
                  <span>开启后，软件每次启动会对全部已添加音乐库文件夹执行一次增量扫描。</span>
                </div>
                <label class="settings-switch">
                  <input v-model="autoScanLocalLibraryEnabled" type="checkbox" />
                  <i aria-hidden="true"></i>
                  <span>{{ autoScanLocalLibraryEnabled ? "已开启" : "已关闭" }}</span>
                </label>
              </div>

              <div class="settings-toggle-field">
                <div>
                  <strong>使用文件名补全歌曲信息</strong>
                  <span>当歌曲内置标签为空或明显乱码时，按「歌手 - 歌名」格式解析文件名补全信息，仅用于展示与歌词匹配，不会修改音频原始文件。</span>
                </div>
                <label class="settings-switch">
                  <input v-model="useFilenameMetadataEnabled" type="checkbox" />
                  <i aria-hidden="true"></i>
                  <span>{{ useFilenameMetadataEnabled ? "已开启" : "已关闭" }}</span>
                </label>
              </div>

              <div class="settings-toggle-field">
                <div>
                  <strong>重复歌曲识别模式</strong>
                  <span v-if="duplicateRecognitionMode === 'path'">仅拦截相同文件路径；不同路径的文件会分别保留。</span>
                  <span v-else>按歌名 + 歌手识别，仅标记疑似重复曲目；存在误识别可能，不会自动移除歌曲。</span>
                </div>
                <select v-model="duplicateRecognitionMode" class="settings-select-control" aria-label="重复歌曲识别模式">
                  <option value="path">仅路径去重（推荐）</option>
                  <option value="metadata">标记疑似重复歌曲</option>
                </select>
              </div>

              <div class="settings-toggle-field">
                <div>
                  <strong>本地歌曲联网匹配歌词</strong>
                  <span>本地没有歌词时，按歌名和歌手匹配网易云或 QQ 音乐歌词。</span>
                </div>
                <label class="settings-switch">
                  <input v-model="localLyricsOnlineMatchEnabled" type="checkbox" />
                  <i aria-hidden="true"></i>
                  <span>{{ localLyricsOnlineMatchEnabled ? "已开启" : "已关闭" }}</span>
                </label>
              </div>

              <div class="settings-toggle-field">
                <div>
                  <strong>将联网下载的歌词保存到音乐同目录</strong>
                  <span>关闭时仅保存到软件缓存；开启后按歌词格式生成同名文件，且不会覆盖已有歌词。</span>
                </div>
                <label class="settings-switch">
                  <input v-model="saveMatchedLyricsBesideAudio" type="checkbox" />
                  <i aria-hidden="true"></i>
                  <span>{{ saveMatchedLyricsBesideAudio ? "已开启" : "已关闭" }}</span>
                </label>
              </div>
            </article>
            <article class="settings-card settings-compact-card">
              <div class="settings-toggle-field settings-startup-field">
                <div>
                  <strong>启动后进入</strong>
                  <span>选择每次打开应用时默认显示的主页。</span>
                </div>
                <div class="settings-segmented-control" role="radiogroup" aria-label="启动后进入">
                  <button
                    type="button"
                    role="radio"
                    :aria-checked="startupHome === 'local'"
                    :class="{ active: startupHome === 'local' }"
                    @click="startupHome = 'local'"
                  >
                    <House :size="15" aria-hidden="true" />
                    本地音乐主页
                  </button>
                  <button
                    type="button"
                    role="radio"
                    :aria-checked="startupHome === 'streaming'"
                    :class="{ active: startupHome === 'streaming' }"
                    @click="startupHome = 'streaming'"
                  >
                    <Compass :size="15" aria-hidden="true" />
                    流媒体主页
                  </button>
                  <button
                    type="button"
                    role="radio"
                    :aria-checked="startupHome === 'last-used'"
                    :class="{ active: startupHome === 'last-used' }"
                    @click="startupHome = 'last-used'"
                  >
                    <Network :size="15" aria-hidden="true" />
                    上次使用
                  </button>
                </div>
              </div>
              <div class="settings-toggle-field settings-startup-field">
                <div>
                  <strong>关闭窗口后</strong>
                  <span>选择退出应用、留在系统托盘，或切换到迷你播放器。</span>
                </div>
                <div class="settings-segmented-control settings-player-segments" role="radiogroup" aria-label="关闭窗口后">
                  <button type="button" role="radio" :aria-checked="desktopIntegrationPreferences.closeBehavior === 'exit'" :class="{ active: desktopIntegrationPreferences.closeBehavior === 'exit' }" @click="desktopIntegrationPreferences.closeBehavior = 'exit'"><Power :size="15" aria-hidden="true" />退出</button>
                  <button type="button" role="radio" :aria-checked="desktopIntegrationPreferences.closeBehavior === 'tray'" :class="{ active: desktopIntegrationPreferences.closeBehavior === 'tray' }" @click="desktopIntegrationPreferences.closeBehavior = 'tray'"><PanelBottom :size="15" aria-hidden="true" />托盘</button>
                  <button type="button" role="radio" :aria-checked="desktopIntegrationPreferences.closeBehavior === 'mini'" :class="{ active: desktopIntegrationPreferences.closeBehavior === 'mini' }" @click="desktopIntegrationPreferences.closeBehavior = 'mini'"><AppWindow :size="15" aria-hidden="true" />迷你播放器</button>
                </div>
              </div>
              <div class="settings-toggle-field">
                <div>
                  <strong>开机自动启动</strong>
                  <span>登录 Windows 后自动启动调律音乐。</span>
                </div>
                <label class="settings-switch">
                  <input type="checkbox" :checked="launchAtStartup" :disabled="launchAtStartupPending" @change="setLaunchAtStartupPreference(($event.target as HTMLInputElement).checked)" />
                  <i aria-hidden="true"></i>
                  <span>{{ launchAtStartup ? "已开启" : "已关闭" }}</span>
                </label>
              </div>
              <div class="settings-toggle-field">
                <div>
                  <strong>记住播放进度</strong>
                  <span>下次启动时恢复上次歌曲，并从停下的位置继续。</span>
                </div>
                <label class="settings-switch">
                  <input v-model="desktopIntegrationPreferences.rememberPlaybackPosition" type="checkbox" />
                  <i aria-hidden="true"></i>
                  <span>{{ desktopIntegrationPreferences.rememberPlaybackPosition ? "已开启" : "已关闭" }}</span>
                </label>
              </div>
              <p v-if="desktopIntegrationError" class="settings-platform-note">{{ desktopIntegrationError }}</p>
              <div class="settings-toggle-field settings-onboarding-field">
                <div>
                  <strong>欢迎向导</strong>
                  <span>重新走一遍首次使用引导：外观、听歌偏好、曲库与声音设置。</span>
                </div>
                <button class="settings-onboarding-button" type="button" @click="openOnboarding">
                  <Sparkles :size="16" :stroke-width="1.8" aria-hidden="true" />
                  重新打开
                </button>
              </div>
            </article>
            </template>
            <article v-else-if="activeSettingsSection === 'playback'" class="settings-card">
              <div class="settings-card-heading">
                <span class="settings-icon" aria-hidden="true">♪</span>
                <div>
                  <h2>播放控制</h2>
                  <p>管理系统播放入口与播放器交互。</p>
                </div>
              </div>

              <div class="settings-toggle-field">
                <div>
                  <strong>主播放栏形态</strong>
                  <span>选择主窗口底部播放控制的尺寸与布局。</span>
                </div>
                <div class="settings-segmented-control settings-player-segments" role="radiogroup" aria-label="主播放栏形态">
                  <button
                    type="button"
                    role="radio"
                    :aria-checked="appearancePreferences.playerControls.presentation === 'full'"
                    :class="{ active: appearancePreferences.playerControls.presentation === 'full' }"
                    @click="setPlayerPresentationPreference('full')"
                  >完整播放栏</button>
                  <button
                    type="button"
                    role="radio"
                    :aria-checked="appearancePreferences.playerControls.presentation === 'capsule'"
                    :class="{ active: appearancePreferences.playerControls.presentation === 'capsule' }"
                    @click="setPlayerPresentationPreference('capsule')"
                  >迷你胶囊</button>
                  <button
                    type="button"
                    role="radio"
                    :aria-checked="appearancePreferences.playerControls.presentation === 'compact'"
                    :class="{ active: appearancePreferences.playerControls.presentation === 'compact' }"
                    @click="setPlayerPresentationPreference('compact')"
                  >紧凑模式</button>
                </div>
              </div>

              <div class="settings-toggle-field">
                <div>
                  <strong>播放栏可见性</strong>
                  <span>控制主播放栏常驻、靠近时显示或完全隐藏。</span>
                </div>
                <div class="settings-segmented-control settings-player-segments" role="radiogroup" aria-label="播放栏可见性">
                  <button
                    type="button"
                    role="radio"
                    :aria-checked="appearancePreferences.playerControls.visibility === 'always'"
                    :class="{ active: appearancePreferences.playerControls.visibility === 'always' }"
                    @click="appearancePreferences.playerControls.visibility = 'always'"
                  >常显</button>
                  <button
                    type="button"
                    role="radio"
                    :aria-checked="appearancePreferences.playerControls.visibility === 'hover'"
                    :class="{ active: appearancePreferences.playerControls.visibility === 'hover' }"
                    @click="appearancePreferences.playerControls.visibility = 'hover'"
                  >指针靠近时浮现</button>
                  <button
                    type="button"
                    role="radio"
                    :aria-checked="appearancePreferences.playerControls.visibility === 'hidden'"
                    :class="{ active: appearancePreferences.playerControls.visibility === 'hidden' }"
                    @click="appearancePreferences.playerControls.visibility = 'hidden'"
                  >隐藏播放栏</button>
                </div>
              </div>

              <div class="settings-toggle-field">
                <div>
                  <strong>迷你播放器显示在任务栏</strong>
                  <span>开启时可在任务栏切换迷你播放器；关闭后仅作为浮窗存在。</span>
                </div>
                <label class="settings-switch">
                  <input v-model="appearancePreferences.playerControls.miniShowInTaskbar" type="checkbox" />
                  <i aria-hidden="true"></i>
                  <span>{{ appearancePreferences.playerControls.miniShowInTaskbar ? "已开启" : "已关闭" }}</span>
                </label>
              </div>

              <div class="settings-toggle-field">
                <div>
                  <strong>迷你播放器置顶</strong>
                  <span>让迷你播放器保持在其他窗口之上。</span>
                </div>
                <label class="settings-switch">
                  <input v-model="appearancePreferences.playerControls.miniAlwaysOnTop" type="checkbox" />
                  <i aria-hidden="true"></i>
                  <span>{{ appearancePreferences.playerControls.miniAlwaysOnTop ? "已开启" : "已关闭" }}</span>
                </label>
              </div>

              <div class="settings-toggle-field">
                <div>
                  <strong>完成欢迎向导后打开迷你播放器</strong>
                  <span>再次运行欢迎向导并完成后，自动进入迷你播放器。</span>
                </div>
                <label class="settings-switch">
                  <input v-model="appearancePreferences.playerControls.openMiniAfterGuide" type="checkbox" />
                  <i aria-hidden="true"></i>
                  <span>{{ appearancePreferences.playerControls.openMiniAfterGuide ? "已开启" : "已关闭" }}</span>
                </label>
              </div>

              <div class="settings-toggle-field">
                <div>
                  <strong>音频输出设备</strong>
                  <span>选择歌曲实际播放到的系统设备，设备拔插后会自动刷新。</span>
                </div>
                <select v-model="audioOutputPreferences.deviceId" class="settings-select-control" aria-label="音频输出设备">
                  <option v-for="device in audioOutputDevices" :key="device.deviceId" :value="device.deviceId" :disabled="!audioOutputSupported && !device.isDefault">
                    {{ device.label }}
                  </option>
                </select>
              </div>

              <div class="settings-toggle-field">
                <div>
                  <strong>输出模式</strong>
                  <span>使用系统共享音频输出，可与其他应用同时播放。</span>
                </div>
                <span class="settings-output-mode-badge">兼容模式</span>
              </div>

              <div class="settings-toggle-field">
                <div>
                  <strong>响度匹配</strong>
                  <span>动态调整不同歌曲的播放增益，减轻切歌时的音量突变。</span>
                </div>
                <label class="settings-switch">
                  <input v-model="audioOutputPreferences.loudnessMatching" type="checkbox" />
                  <i aria-hidden="true"></i>
                  <span>{{ audioOutputPreferences.loudnessMatching ? "已开启" : "已关闭" }}</span>
                </label>
              </div>

              <p v-if="audioOutputError" class="settings-platform-note">{{ audioOutputError }}</p>

              <div class="settings-toggle-field">
                <div>
                  <strong>睡眠定时器</strong>
                  <span>倒计时结束后自动暂停播放；关闭软件后不会保留本次计时。</span>
                </div>
                <select :value="sleepTimerPreset" class="settings-select-control" aria-label="睡眠定时器" @change="setSleepTimer(Number(($event.target as HTMLSelectElement).value))">
                  <option value="0">关闭</option>
                  <option value="15">15 分钟</option>
                  <option value="30">30 分钟</option>
                  <option value="45">45 分钟</option>
                  <option value="60">60 分钟</option>
                </select>
              </div>

              <div class="settings-toggle-field settings-fade-field">
                <div class="settings-fade-copy">
                  <strong>音乐渐进渐出</strong>
                  <span>切换上一首或下一首时平滑淡出淡入，暂停、播放和拖动进度不触发。</span>
                </div>
                <div class="settings-fade-controls">
                  <label class="settings-fade-duration">
                    <span>过渡时长（毫秒）</span>
                    <input
                      v-model.number="playbackFadeDurationMs"
                      class="settings-fade-slider"
                      type="range"
                      min="10"
                      max="2000"
                      step="10"
                      :disabled="!playbackFadeEnabled"
                      aria-label="渐进渐出过渡时长"
                    />
                    <output>{{ playbackFadeDurationMs }} ms</output>
                  </label>
                  <label class="settings-switch">
                    <input v-model="playbackFadeEnabled" type="checkbox" />
                    <i aria-hidden="true"></i>
                    <span>{{ playbackFadeEnabled ? "已开启" : "已关闭" }}</span>
                  </label>
                </div>
              </div>

              <div class="settings-toggle-field">
                <div>
                  <strong>网易云播放音质</strong>
                  <span>自动按 Hi-Res、无损、极高和标准依次回退。</span>
                </div>
                <select v-model="neteasePlaybackQuality" class="settings-select-control" aria-label="网易云播放音质">
                  <option v-for="option in NETEASE_QUALITY_OPTIONS" :key="option.value" :value="option.value">
                    {{ option.label }}
                  </option>
                </select>
              </div>

              <div class="settings-toggle-field">
                <div>
                  <strong>QQ 音乐播放音质</strong>
                  <span>自动按无损、高清和标准依次回退。</span>
                </div>
                <select v-model="qqPlaybackQuality" class="settings-select-control" aria-label="QQ 音乐播放音质">
                  <option v-for="option in QQ_QUALITY_OPTIONS" :key="option.value" :value="option.value">
                    {{ option.label }}
                  </option>
                </select>
              </div>

              <div class="settings-toggle-field">
                <div>
                  <strong>切换音质后重载当前歌曲</strong>
                  <span>关闭时从下一曲开始生效；开启后保留当前进度重新加载在线音源。</span>
                </div>
                <label class="settings-switch">
                  <input v-model="reloadCurrentTrackOnQualityChange" type="checkbox" />
                  <i aria-hidden="true"></i>
                  <span>{{ reloadCurrentTrackOnQualityChange ? "已开启" : "已关闭" }}</span>
                </label>
              </div>

              <div class="settings-toggle-field">
                <div>
                  <strong>优先播放本地下载品质</strong>
                  <span>开启后，网络环境下播放已下载歌曲时，将优先选择本地高品质文件播放。</span>
                </div>
                <label class="settings-switch">
                  <input v-model="preferLocalDownloadPlayback" type="checkbox" />
                  <i aria-hidden="true"></i>
                  <span>{{ preferLocalDownloadPlayback ? "已开启" : "已关闭" }}</span>
                </label>
              </div>

              <template v-if="taskbarThumbnailButtonsSupported">
              <div class="settings-toggle-field">
                <div>
                  <strong>系统托盘图标</strong>
                  <span>在 Windows 通知区域显示调律音乐，并通过右键菜单控制播放、歌词和迷你播放器。</span>
                </div>
                <label class="settings-switch">
                  <input v-model="systemTrayEnabled" type="checkbox" />
                  <i aria-hidden="true"></i>
                  <span>{{ systemTrayEnabled ? "已开启" : "已关闭" }}</span>
                </label>
              </div>

              <div class="settings-toggle-field">
                <div>
                  <strong>任务栏缩略图按钮</strong>
                  <span>在 Windows 任务栏窗口预览中直接控制上一首、播放与下一首。</span>
                </div>
                <label class="settings-switch">
                  <input v-model="taskbarThumbnailButtonsEnabled" type="checkbox" />
                  <i aria-hidden="true"></i>
                  <span>{{ taskbarThumbnailButtonsEnabled ? "已开启" : "已关闭" }}</span>
                </label>
              </div>

              <div class="settings-toggle-field">
                <div>
                  <strong>系统媒体控制</strong>
                  <span>在 Windows 音量条、媒体叠层与锁屏界面显示并控制当前歌曲。</span>
                </div>
                <label class="settings-switch">
                  <input v-model="desktopIntegrationPreferences.systemMediaControls" type="checkbox" />
                  <i aria-hidden="true"></i>
                  <span>{{ desktopIntegrationPreferences.systemMediaControls ? "已开启" : "已关闭" }}</span>
                </label>
              </div>
              </template>
              <p v-else class="settings-platform-note">系统托盘和任务栏缩略图按钮仅支持 Windows。</p>
            </article>
            <AppearanceSettings v-else-if="activeSettingsSection === 'appearance'" v-model="appearancePreferences" :background-error="appearanceImageError" />
            <DesktopLyricsSettings v-else-if="activeSettingsSection === 'desktop-lyrics'" />
            <template v-else-if="activeSettingsSection === 'cache'">
              <article class="settings-card settings-cache-card">
                <div class="settings-card-heading">
                  <span class="settings-icon" aria-hidden="true">
                    <Database :size="22" :stroke-width="1.8" />
                  </span>
                  <div>
                    <h2>缓存管理</h2>
                    <p>管理封面、歌词、在线元数据和背景图片缓存，不包含离线下载文件。</p>
                  </div>
                </div>

                <section class="settings-cache-usage" aria-label="缓存占用">
                  <div class="settings-cache-total">
                    <span>缓存占用</span>
                    <strong>{{ formatCacheSize(totalCacheBytes) }}</strong>
                    <small>{{ totalCacheEntries }} 个缓存文件</small>
                  </div>
                  <div>
                    <span>封面</span>
                    <strong>{{ formatCacheSize(cacheStatistics.cover.bytes) }}</strong>
                    <small>{{ cacheStatistics.cover.entries }} 项</small>
                  </div>
                  <div>
                    <span>歌词</span>
                    <strong>{{ formatCacheSize(cacheStatistics.lyrics.bytes) }}</strong>
                    <small>{{ cacheStatistics.lyrics.entries }} 项</small>
                  </div>
                  <div>
                    <span>元数据</span>
                    <strong>{{ formatCacheSize(cacheStatistics.metadata.bytes) }}</strong>
                    <small>{{ cacheStatistics.metadata.entries }} 项</small>
                  </div>
                  <div>
                    <span>背景图片</span>
                    <strong>{{ formatCacheSize(backgroundCacheStatistics.bytes) }}</strong>
                    <small>{{ backgroundCacheStatistics.entries }} 项</small>
                  </div>
                </section>

                <div class="settings-cache-clear background-cache-clear">
                  <div>
                    <strong>背景图片缓存</strong>
                    <span>清理导入副本并恢复纯色背景，不删除原始图片。</span>
                    <span class="background-cache-path">{{ backgroundCacheStatistics.directory }}</span>
                  </div>
                  <button class="settings-action danger" type="button"
                    :disabled="cacheSettingsPending || backgroundCacheStatistics.entries === 0"
                    @click="clearBackgroundCacheOnly">清理背景图片</button>
                </div>

                <div class="settings-cache-directory">
                  <div class="settings-cache-copy">
                    <strong>缓存目录</strong>
                    <span>缓存资源与用户离线下载文件相互独立。</span>
                  </div>
                  <div class="settings-cache-directory-controls">
                    <input
                      :value="cacheSettings.directory"
                      type="text"
                      readonly
                      aria-label="当前缓存目录"
                      title="当前缓存目录"
                    />
                    <button
                      class="settings-action"
                      type="button"
                      :disabled="cacheSettingsPending || !cacheSettingsLoaded"
                      @click="chooseCacheDirectory"
                    >
                      <FolderOpen :size="15" aria-hidden="true" />
                      选择文件夹
                    </button>
                    <button
                      class="settings-action"
                      type="button"
                      :disabled="cacheSettingsPending || !cacheSettingsLoaded"
                      @click="restoreCacheDirectory"
                    >
                      <RefreshCw :size="15" aria-hidden="true" />
                      恢复默认
                    </button>
                  </div>
                </div>

                <div class="settings-toggle-field">
                  <div>
                    <strong>封面缓存</strong>
                    <span>复用本地库、QQ 音乐和网易云已获取的专辑封面，减少重复请求。</span>
                  </div>
                  <label class="settings-switch">
                    <input
                      v-model="cacheSettings.coverEnabled"
                      type="checkbox"
                      :disabled="cacheSettingsPending || !cacheSettingsLoaded"
                      @change="saveCacheSettings('封面缓存设置已保存。')"
                    />
                    <i aria-hidden="true"></i>
                    <span>{{ cacheSettings.coverEnabled ? "已开启" : "已关闭" }}</span>
                  </label>
                </div>

                <div class="settings-toggle-field">
                  <div>
                    <strong>歌词缓存</strong>
                    <span>缓存 LRC、翻译歌词和 QRC/YRC 逐字歌词，不保存账号 Cookie。</span>
                  </div>
                  <label class="settings-switch">
                    <input
                      v-model="cacheSettings.lyricsEnabled"
                      type="checkbox"
                      :disabled="cacheSettingsPending || !cacheSettingsLoaded"
                      @change="saveCacheSettings('歌词缓存设置已保存。')"
                    />
                    <i aria-hidden="true"></i>
                    <span>{{ cacheSettings.lyricsEnabled ? "已开启" : "已关闭" }}</span>
                  </label>
                </div>

                <div class="settings-toggle-field">
                  <div>
                    <strong>元数据缓存</strong>
                    <span>缓存在线匹配的艺人、专辑和曲目信息，不覆盖本地音频内置标签。</span>
                  </div>
                  <label class="settings-switch">
                    <input
                      v-model="cacheSettings.metadataEnabled"
                      type="checkbox"
                      :disabled="cacheSettingsPending || !cacheSettingsLoaded"
                      @change="saveCacheSettings('元数据缓存设置已保存。')"
                    />
                    <i aria-hidden="true"></i>
                    <span>{{ cacheSettings.metadataEnabled ? "已开启" : "已关闭" }}</span>
                  </label>
                </div>

                <div class="settings-cache-clear">
                  <div>
                    <strong>一键清理缓存</strong>
                    <span>删除封面、歌词、元数据和背景图片缓存，不会删除本地音乐、歌单数据和离线下载。</span>
                  </div>
                  <button
                    class="settings-action danger"
                    type="button"
                    :disabled="cacheSettingsPending || totalCacheEntries === 0"
                    @click="clearAllManagedCache"
                  >
                    <span aria-hidden="true">×</span>
                    一键清理缓存
                  </button>
                </div>

                <p
                  v-if="cacheSettingsPending || cacheSettingsNotice || cacheSettingsError"
                  class="settings-cache-status"
                  :class="{ error: Boolean(cacheSettingsError) }"
                  role="status"
                >
                  {{ cacheSettingsPending ? "正在处理缓存设置…" : cacheSettingsError || cacheSettingsNotice }}
                </p>
              </article>

              <article class="settings-card settings-listening-data-card">
                <div class="settings-card-heading">
                  <span class="settings-icon" aria-hidden="true">
                    <Headphones :size="22" :stroke-width="1.8" />
                  </span>
                  <div>
                    <h2>聆听数据</h2>
                    <p>查看占用范围并清理指定月份或年份的聆听足迹。</p>
                  </div>
                </div>

                <section class="settings-listening-summary" aria-label="聆听足迹汇总">
                  <div>
                    <span>记录歌曲</span>
                    <strong>{{ listeningDataSummary?.trackCount ?? 0 }}</strong>
                    <small>首歌曲</small>
                  </div>
                  <div>
                    <span>活跃天数</span>
                    <strong>{{ listeningDataSummary?.activeDays ?? 0 }}</strong>
                    <small>天有聆听记录</small>
                  </div>
                  <div>
                    <span>累计时长</span>
                    <strong>{{ formatListeningDuration(listeningDataSummary?.listenedSeconds ?? 0) }}</strong>
                    <small>仅统计聆听足迹</small>
                  </div>
                </section>

                <div class="settings-listening-retention">
                  <div class="settings-listening-retention-heading">
                    <div>
                      <strong>删除聆听足迹</strong>
                      <span>选择范围后先预览，再确认删除；最近播放记录不会改变。</span>
                    </div>
                    <div class="settings-listening-mode" aria-label="删除范围">
                      <button
                        type="button"
                        :class="{ active: listeningDataDeleteMode === 'month' }"
                        :aria-pressed="listeningDataDeleteMode === 'month'"
                        @click="listeningDataDeleteMode = 'month'"
                      >按月删除</button>
                      <button
                        type="button"
                        :class="{ active: listeningDataDeleteMode === 'year' }"
                        :aria-pressed="listeningDataDeleteMode === 'year'"
                        @click="listeningDataDeleteMode = 'year'"
                      >按年删除</button>
                      <button
                        type="button"
                        :class="{ active: listeningDataDeleteMode === 'all' }"
                        :aria-pressed="listeningDataDeleteMode === 'all'"
                        @click="listeningDataDeleteMode = 'all'"
                      >删除全部</button>
                    </div>
                  </div>

                  <div class="settings-listening-range-row">
                    <div v-if="listeningDataDeleteMode !== 'all'" class="settings-listening-selectors">
                      <label>
                        <span>年份</span>
                        <select v-model.number="listeningDataDeleteYear" class="settings-select-control">
                          <option v-for="year in listeningDataAvailableYears" :key="year" :value="year">
                            {{ year }} 年
                          </option>
                        </select>
                      </label>
                      <label v-if="listeningDataDeleteMode === 'month'">
                        <span>月份</span>
                        <select v-model.number="listeningDataDeleteMonth" class="settings-select-control">
                          <option v-for="month in 12" :key="month" :value="month">
                            {{ month }} 月
                          </option>
                        </select>
                      </label>
                    </div>
                    <div v-else class="settings-listening-all-note">
                      将清空所有年份的聆听时长、播放次数和日历足迹。
                    </div>

                    <div class="settings-listening-preview" aria-live="polite">
                      <span>{{ listeningDataDeleteRangeLabel }}可删除</span>
                      <strong v-if="listeningDataSummaryPending">正在统计…</strong>
                      <strong v-else>
                        {{ listeningDataSummary?.rangeTrackCount ?? 0 }} 首 ·
                        {{ listeningDataSummary?.rangeActiveDays ?? 0 }} 天 ·
                        {{ formatListeningDuration(listeningDataSummary?.rangeListenedSeconds ?? 0) }}
                      </strong>
                    </div>
                  </div>

                  <div class="settings-listening-delete-row">
                    <p>只删除聆听足迹；不会影响最近播放、歌单、本地音乐、缓存和离线下载。</p>
                    <button
                      class="settings-action danger"
                      type="button"
                      :disabled="listeningDataDeletePending || listeningDataSummaryPending || listeningDataSelectionEmpty"
                      @click="deleteSelectedListeningStats"
                    >
                      <Trash2 :size="15" aria-hidden="true" />
                      {{ listeningDataDeletePending
                        ? "正在删除…"
                        : listeningDataDeleteMode === "all" ? "删除全部足迹" : "删除所选足迹" }}
                    </button>
                  </div>
                </div>

                <p
                  v-if="listeningDataNotice || listeningDataError"
                  class="settings-cache-status"
                  :class="{ error: Boolean(listeningDataError) }"
                  role="status"
                >
                  {{ listeningDataError || listeningDataNotice }}
                </p>
              </article>

              <article class="settings-card settings-listening-data-card settings-qq-listening-data-card">
                <div class="settings-card-heading">
                  <span class="settings-icon" aria-hidden="true">
                    <Headphones :size="22" :stroke-width="1.8" />
                  </span>
                  <div>
                    <h2>QQ 本地听歌排行</h2>
                    <p>按 QQ 账号分别保存在本机；清理不会影响 QQ 音乐云端最近播放。</p>
                  </div>
                </div>

                <div v-if="qqListeningDataSummaries.length" class="settings-qq-listening-body">
                  <label class="settings-qq-account-picker">
                    <span>QQ 账号</span>
                    <select v-model="selectedQqListeningDataAccountId" class="settings-select-control">
                      <option v-for="summary in qqListeningDataSummaries" :key="summary.accountId" :value="summary.accountId">
                        {{ summary.nickname || summary.accountId }}
                      </option>
                    </select>
                  </label>

                  <section class="settings-listening-summary" aria-label="QQ 本地听歌排行汇总">
                    <div>
                      <span>记录歌曲</span>
                      <strong>{{ selectedQqListeningDataSummary?.trackCount ?? 0 }}</strong>
                      <small>首歌曲</small>
                    </div>
                    <div>
                      <span>累计时长</span>
                      <strong>{{ formatListeningDuration(selectedQqListeningDataSummary?.listenedSeconds ?? 0) }}</strong>
                      <small>仅此 QQ 账号</small>
                    </div>
                    <div>
                      <span>记录日期</span>
                      <strong class="settings-qq-date-range">
                        {{ selectedQqListeningDataSummary?.firstDate || "-" }} 至 {{ selectedQqListeningDataSummary?.lastDate || "-" }}
                      </strong>
                      <small>关闭应用后仍会保留</small>
                    </div>
                  </section>

                  <div class="settings-listening-retention">
                    <div class="settings-listening-retention-heading">
                      <div>
                        <strong>删除 QQ 排行记录</strong>
                        <span>只能在这里主动删除；切换账号和退出登录不会清空。</span>
                      </div>
                      <div class="settings-listening-mode" aria-label="QQ 排行删除范围">
                        <button type="button" :class="{ active: qqListeningDataDeleteMode === 'range' }" @click="qqListeningDataDeleteMode = 'range'">日期范围</button>
                        <button type="button" :class="{ active: qqListeningDataDeleteMode === 'all' }" @click="qqListeningDataDeleteMode = 'all'">该账号全部</button>
                      </div>
                    </div>

                    <div v-if="qqListeningDataDeleteMode === 'range'" class="settings-listening-selectors settings-qq-date-selectors">
                      <label>
                        <span>开始日期</span>
                        <input v-model="qqListeningDataDeleteFrom" type="date" :max="qqListeningDataDeleteTo || undefined" />
                      </label>
                      <label>
                        <span>结束日期</span>
                        <input v-model="qqListeningDataDeleteTo" type="date" :min="qqListeningDataDeleteFrom || undefined" />
                      </label>
                    </div>
                    <p v-else class="settings-listening-all-note">将清空这个 QQ 账号保存在本机的全部听歌排行。</p>

                    <div class="settings-listening-delete-row">
                      <p>不会影响 QQ 音乐云端最近播放，也不会修改歌曲、喜欢和歌单。</p>
                      <button
                        class="settings-action danger"
                        type="button"
                        :disabled="qqListeningDataDeletePending || qqListeningDataPending || !selectedQqListeningDataAccountId || !qqListeningDataRangeValid"
                        @click="deleteSelectedQqListeningStats"
                      >
                        <Trash2 :size="15" aria-hidden="true" />
                        {{ qqListeningDataDeletePending ? "正在删除…" : qqListeningDataDeleteMode === "all" ? "删除账号全部排行" : "删除所选日期排行" }}
                      </button>
                    </div>
                  </div>
                </div>
                <p v-else-if="!qqListeningDataPending" class="settings-qq-listening-empty">还没有任何 QQ 账号的本地听歌排行。</p>

                <p
                  v-if="qqListeningDataPending || qqListeningDataNotice || qqListeningDataError"
                  class="settings-cache-status"
                  :class="{ error: Boolean(qqListeningDataError) }"
                  role="status"
                >
                  {{ qqListeningDataPending ? "正在读取 QQ 本地听歌排行…" : qqListeningDataError || qqListeningDataNotice }}
                </p>
              </article>
            </template>
            <ShortcutSettings v-else-if="activeSettingsSection === 'shortcuts'" />
            <AboutSettings v-else-if="activeSettingsSection === 'about'" />
            <article v-else class="settings-card settings-placeholder">
              <div class="settings-card-heading">
                <span class="settings-icon" aria-hidden="true">◇</span>
                <div>
                  <h2>{{ activeSettingsTitle }}</h2>
                  <p>这个设置分组会在后续继续完善。</p>
                </div>
              </div>
            </article>
          </section>
        </template>

        <template v-if="shouldShowLocalEmptyRoom">
          <section class="local-empty-room" aria-label="添加本地音乐库">
            <header class="local-home-header local-empty-header">
              <div>
                <p class="local-home-date">{{ localHomeDateLabel }} · 本地音乐库</p>
                <h2 class="local-home-greeting">{{ localHomeGreeting }}</h2>
                <p class="local-home-subtitle">让熟悉的旋律，陪你度过此刻。</p>
              </div>
            </header>

            <article class="local-empty-card">
              <div class="local-empty-content">
                <div class="local-empty-icon" aria-hidden="true">♫</div>
                <p class="local-empty-kicker">Twilight Echo · 唱片房间</p>
                <h1>这里还很安静</h1>
                <p class="local-empty-description">添加本地音乐文件夹后，封面、专辑与听歌足迹会自动在这里生成你的唱片房间。</p>
                <button class="local-empty-action" type="button" @click="chooseMusicFolderAndScan">
                  <span aria-hidden="true">▣</span>
                  添加音乐库文件夹
                </button>
                <p v-if="scanNotice" class="local-empty-message">{{ scanNotice }}</p>
                <p v-if="scanError" class="local-empty-message error">{{ scanError }}</p>
                <div class="local-empty-features" aria-label="本地音乐库能力">
                  <span>▣ 批量扫描</span>
                  <span>◎ 无损格式</span>
                  <span>⌁ 聆听统计</span>
                </div>
              </div>
            </article>
          </section>
        </template>

        <template v-else-if="appMode === 'local' && activeView === 'home' && !submittedKeyword">
          <section class="local-home-page">
            <header class="local-home-header">
              <div>
                <p class="local-home-date">{{ localHomeDateLabel }} · 本地音乐库</p>
                <h2 class="local-home-greeting">{{ localHomeGreeting }}</h2>
                <p class="local-home-subtitle">让熟悉的旋律，陪你度过此刻。</p>
              </div>
              <button class="local-home-random" type="button" @click="playRandomLocalTrack">
                <span class="local-home-random-icon" aria-hidden="true">↝</span>
                <span><strong>随机漫游</strong><small>从 {{ currentLibrary.length }} 首喜欢里抽一首</small></span>
                <span class="local-home-random-arrow" aria-hidden="true">↗</span>
              </button>
            </header>

            <article
              class="local-home-last-played"
              :style="{
                '--home-accent-primary': localHomeTrack.primary,
                '--home-accent-secondary': localHomeTrack.secondary,
                '--home-cover-image': localHomeCoverUrl ? `url('${localHomeCoverUrl}')` : 'none'
              }"
            >
              <div class="local-home-last-copy">
                <span class="local-home-last-label">上次播放</span>
                <h3 class="local-home-track-title">{{ localHomeTrackLabel }}</h3>
                <p class="local-home-track-artist">{{ localHomeTrack.artist }}</p>
                <p class="local-home-track-meta">
                  <span>{{ localHomeTrack.album || '本地音乐' }}</span>
                  <i aria-hidden="true">·</i>
                  <span>{{ localHomeTrackFormat }}</span>
                </p>
                <div v-if="isLocalHomeCurrentTrack && localHomeDuration > 0" class="local-home-progress">
                  <div class="local-home-progress-track">
                    <span :style="{ width: `${localHomeProgress}%` }"></span>
                    <input
                      class="local-home-progress-input"
                      type="range"
                      min="0"
                      max="100"
                      step="0.1"
                      :value="localHomeProgress"
                      aria-label="播放进度"
                      @pointerdown="beginSeek"
                      @keydown="beginSeek"
                      @input="handleProgressInput"
                      @pointerup="finishSeekFromEvent"
                      @pointercancel="finishSeekFromEvent"
                      @change="finishSeekFromEvent"
                    />
                  </div>
                  <div class="local-home-progress-times"><span>{{ formatLyricTime(localHomeCurrentTime) }}</span><span>{{ formatLyricTime(localHomeDuration) }}</span></div>
                </div>
                <div class="local-home-controls">
                  <button type="button" title="上一首" aria-label="上一首" @click="previousTrack"><span class="transport-icon transport-icon-previous" aria-hidden="true"></span></button>
                  <button class="local-home-play" type="button" :title="isLocalHomeCurrentTrack && isPlaying ? '暂停' : '播放'" :aria-label="isLocalHomeCurrentTrack && isPlaying ? '暂停' : '播放'" @click="playLocalHomeTrack">
                    <span v-if="isLocalHomeCurrentTrack && isPlaying" class="pause-icon" aria-hidden="true"></span>
                    <span v-else class="play-icon" aria-hidden="true"></span>
                  </button>
                  <button type="button" title="下一首" aria-label="下一首" @click="nextTrack"><span class="transport-icon transport-icon-next" aria-hidden="true"></span></button>
                  <button class="local-home-shuffle" type="button" title="随机播放" aria-label="随机播放" @click="playRandomLocalTrack"><span aria-hidden="true">⤨</span> 随机畅听</button>
                </div>
              </div>
              <div class="local-home-cover-wrap">
                <span class="local-home-format-badge">{{ localHomeTrackFormat }}</span>
                <div class="local-home-cover" :style="{ background: `linear-gradient(135deg, ${localHomeTrack.primary}, ${localHomeTrack.secondary})` }">
                  <img v-if="localHomeCoverUrl" :src="localHomeCoverUrl" :alt="`${localHomeTrack.title}封面`" />
                  <span v-else aria-hidden="true">{{ localHomeTrack.mark }}</span>
                </div>
              </div>
            </article>

            <article class="local-home-stats-panel" aria-label="本地音乐库统计">
              <div v-for="item in localLibraryStats" :key="item.label" class="local-home-stat">
                <strong>{{ item.value }}</strong>
                <span>{{ item.label }}</span>
              </div>
            </article>

            <section class="local-home-recent-panel" aria-label="最近添加">
              <header class="local-home-section-heading">
                <div>
                  <h3>最近添加</h3>
                  <p>刚收进音乐库的声音，先听为敬。</p>
                </div>
                <button type="button" @click="selectView('library')">全部歌曲 <span aria-hidden="true">→</span></button>
              </header>
              <div class="local-home-recent-grid">
                <button
                  v-for="track in localRecentlyAddedTracks"
                  :key="track.id"
                  class="local-home-recent-card"
                  type="button"
                  @click="playTrack(track)"
                  @contextmenu.prevent="openTrackContextMenu(track, $event, currentLibrary)"
                >
                  <span class="local-home-recent-cover" :style="{ background: `linear-gradient(135deg, ${track.primary}, ${track.secondary})` }">
                    <img v-if="resolveBackendUrl(track.coverUrl)" :src="resolveBackendUrl(track.coverUrl)" :alt="`${track.title}封面`" @error="handleTrackCoverError($event, track)" />
                    <span v-else aria-hidden="true">{{ track.mark }}</span>
                    <i>{{ getLocalTrackFormat(track) }}</i>
                  </span>
                  <strong>{{ track.title }}</strong>
                  <small>{{ track.artist }} · {{ track.album || '本地音乐' }}</small>
                </button>
              </div>
            </section>

            <section class="local-listening-footprints" aria-label="聆听足迹">
              <header class="local-listening-heading">
                <div>
                  <h3>聆听足迹</h3>
                  <p>每一次重播，都在慢慢画出你的音乐偏好。</p>
                </div>
                <button type="button" @click="selectView('history')">最近播放 <span aria-hidden="true">→</span></button>
              </header>

              <div class="local-listening-grid">
                <article class="local-top-tracks-card">
                  <header>
                    <strong>TOP TRACKS</strong>
                    <span>按累计聆听时长排序</span>
                  </header>
                  <div v-if="localTopListeningTracks.length > 0" class="local-top-tracks-list">
                    <button
                      v-for="(item, index) in localTopListeningTracks"
                      :key="item.track.id"
                      class="local-top-track-row"
                      type="button"
                      @click="playTrack(item.track)"
                      @contextmenu.prevent="openTrackContextMenu(item.track, $event, currentLibrary)"
                    >
                      <span class="local-top-track-rank">{{ (index + 1).toString().padStart(2, "0") }}</span>
                      <span class="local-top-track-cover" :style="{ background: `linear-gradient(135deg, ${item.track.primary}, ${item.track.secondary})` }">
                        <img v-if="resolveBackendUrl(item.track.coverUrl)" :src="resolveBackendUrl(item.track.coverUrl)" :alt="`${item.track.title}封面`" @error="handleTrackCoverError($event, item.track)" />
                        <span v-else aria-hidden="true">{{ item.track.mark }}</span>
                      </span>
                      <span class="local-top-track-copy">
                        <strong>{{ item.track.title }}</strong>
                        <small>{{ item.track.artist }}</small>
                        <i><b :style="{ width: `${item.percent}%` }"></b></i>
                      </span>
                      <span class="local-top-track-meta">{{ item.playCount }} 次 · {{ item.listenedMinutes }} 分钟</span>
                    </button>
                  </div>
                  <p v-else class="local-listening-empty">播放本地音乐后，这里会生成你的歌曲排行榜。</p>
                </article>

                <article class="local-calendar-card">
                  <header>
                    <strong>CALENDAR</strong>
                    <div class="local-calendar-controls">
                      <button type="button" title="上个月" aria-label="上个月" @click="shiftListeningMonth(-1)">‹</button>
                      <span>{{ listeningCalendarTitle }}</span>
                      <button type="button" title="下个月" aria-label="下个月" @click="shiftListeningMonth(1)">›</button>
                    </div>
                  </header>
                  <div class="local-calendar-weekdays" aria-hidden="true">
                    <span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span><span>日</span>
                  </div>
                  <div class="local-calendar-days">
                    <button
                      v-for="day in listeningCalendarDays"
                      :key="day.key"
                      type="button"
                      :disabled="!day.dateKey"
                      :class="[`heat-${day.intensity}`, { 'is-blank': !day.dateKey, 'is-selected': day.isSelected }]"
                      :title="day.dateKey ? `${day.dateKey} · ${day.minutes} 分钟` : ''"
                      @click="selectListeningCalendarDate(day.dateKey)"
                    >
                      {{ day.day }}
                    </button>
                  </div>
                  <footer>
                    <strong>{{ listeningMonthSummary.activeDays }} 天在听 · 共 {{ listeningMonthSummary.totalMinutes }} 分钟</strong>
                    <span>选中 {{ selectedListeningDaySummary }} 分钟</span>
                    <i aria-hidden="true"><b></b><b></b><b></b><b></b><b></b></i>
                  </footer>
                </article>
              </div>
            </section>

            <section class="local-featured-albums" aria-label="专辑精选">
              <header class="local-listening-heading">
                <div>
                  <h3>专辑精选</h3>
                  <p>从头到尾听完一张专辑，是留给音乐最温柔的时间。</p>
                </div>
                <button type="button" @click="selectView('albums')">全部专辑 <span aria-hidden="true">→</span></button>
              </header>
              <div v-if="localFeaturedAlbums.length > 0" class="local-album-row">
                <button
                  v-for="album in localFeaturedAlbums"
                  :key="album.id"
                  class="local-album-card"
                  type="button"
                  @click="openLocalAlbum(album)"
                >
                  <span class="local-album-cover" :style="{ background: `linear-gradient(135deg, ${album.primary}, ${album.secondary})` }">
                    <img v-if="resolveBackendUrl(album.coverUrl)" :src="resolveBackendUrl(album.coverUrl)" :alt="`${album.title}封面`" />
                    <span v-else aria-hidden="true">{{ album.mark }}</span>
                  </span>
                  <strong>{{ album.title }}</strong>
                  <small>{{ album.artistText }}</small>
                </button>
              </div>
              <p v-else class="local-listening-empty">扫描带有专辑信息的本地音乐后，这里会展示专辑精选。</p>
            </section>
          </section>
        </template>

        <template v-else-if="appMode === 'local' && activeView === 'library' && !submittedKeyword">
          <section class="local-library-page" aria-label="本地音乐">
            <header class="local-library-header">
              <div class="local-library-title">
                <h1>本地音乐</h1>
                <div class="local-library-primary-actions">
                  <button type="button" @click="playAllLocalTracks">
                    <span aria-hidden="true">▷</span>
                    播放全部
                  </button>
                  <button type="button" @click="playRandomAllLocalTracks">
                    <span aria-hidden="true">⤨</span>
                    随机播放
                  </button>
                </div>
              </div>

              <div ref="localLibraryToolsRef" class="local-library-tools" aria-label="本地音乐工具区">
                <div class="local-tool-menu local-tool-menu-library">
                  <button
                    class="local-tool-trigger"
                    type="button"
                    aria-haspopup="menu"
                    :aria-expanded="localToolMenuOpen === 'library'"
                    @click="toggleLocalToolMenu('library')"
                  >
                    库管理
                    <span :class="{ open: localToolMenuOpen === 'library' }" aria-hidden="true">⌄</span>
                  </button>
                  <div v-if="localToolMenuOpen === 'library'" class="local-tool-popover" role="menu">
                    <button type="button" role="menuitem" @click="chooseMusicFolderAndScan(); closeLocalToolMenu()">添加文件夹</button>
                    <button type="button" role="menuitem" :disabled="localLibraryScanPending" @click="scanMusicFolderIncrementally(); closeLocalToolMenu()">扫描本地音乐库</button>
                    <button type="button" role="menuitem" :disabled="localLibraryScanPending" @click="reparseAllLocalMetadata(); closeLocalToolMenu()">重新解析全部歌曲文件名元信息</button>
                    <button type="button" role="menuitem" @click="openDuplicateFinder">查找重复歌曲</button>
                    <button type="button" role="menuitem" :disabled="duplicateRemovalPending || ignoredLocalFiles.length === 0" @click="restoreAllIgnoredLocalFiles(); closeLocalToolMenu()">恢复已忽略歌曲（{{ ignoredLocalFiles.length }}）</button>
                    <button type="button" role="menuitem" :disabled="localLibraryScanPending" @click="scanMusicFolderIncrementally(); closeLocalToolMenu()">清理失效文件</button>
                  </div>
                </div>
                <div class="local-tool-menu local-tool-menu-filter">
                  <button
                    class="local-tool-trigger"
                    type="button"
                    aria-haspopup="menu"
                    :aria-expanded="localToolMenuOpen === 'filter'"
                    @click="toggleLocalToolMenu('filter')"
                  >
                    筛选器
                    <span :class="{ open: localToolMenuOpen === 'filter' }" aria-hidden="true">⌄</span>
                  </button>
                  <div v-if="localToolMenuOpen === 'filter'" class="local-tool-popover" role="menu">
                    <button type="button" role="menuitem" @click="scanNotice = '已选择按歌手筛选，后续会展开歌手分组。'; closeLocalToolMenu()">按歌手</button>
                    <button type="button" role="menuitem" @click="scanNotice = '已选择按专辑筛选，后续会展开专辑分组。'; closeLocalToolMenu()">按专辑</button>
                    <button type="button" role="menuitem" @click="scanNotice = '已选择按格式筛选，后续会展开格式分组。'; closeLocalToolMenu()">按格式</button>
                  </div>
                </div>
                <label class="local-network-toggle">
                  <span>网络搜索</span>
                  <input v-model="localLibraryNetworkSearchEnabled" type="checkbox" />
                  <i aria-hidden="true"></i>
                </label>
                <label class="local-library-search">
                  <span aria-hidden="true">⌕</span>
                  <input v-model="localLibrarySearchKeyword" type="search" placeholder="搜索歌曲、歌手、专辑或文件夹" />
                </label>
              </div>
            </header>

            <div v-if="scanNotice || scanError" class="local-library-notice" :class="{ error: Boolean(scanError) }">
              {{ scanError || scanNotice }}
            </div>

            <section class="local-library-table" aria-label="所有歌曲列表">
              <div class="local-library-table-header">
                <span>#</span>
                <span>标题</span>
                <span>专辑</span>
                <span>时长</span>
              </div>

              <div v-if="filteredLocalLibraryTracks.length > 0" class="local-library-table-body">
                <div
                  v-for="(track, index) in filteredLocalLibraryTracks"
                  :key="track.id"
                  class="local-library-row"
                  :class="{ active: track.id === currentTrack.id, selected: selectedLocalTrackIds.has(track.id) }"
                  role="button"
                  tabindex="0"
                  @click="playLocalLibraryRow(track)"
                  @keydown.enter="playLocalLibraryRow(track)"
                  @contextmenu.prevent="openLocalTrackContextMenu(track, $event)"
                >
                  <span class="local-library-index">
                    <span
                      v-if="track.id === currentTrack.id"
                      class="track-playback-indicator"
                      :class="{ paused: !isPlaying && !isPlaybackStarting }"
                      :aria-label="(isPlaying || isPlaybackStarting) ? '正在播放' : '已暂停'"
                    >
                      <span v-if="isPlaying || isPlaybackStarting" class="track-playback-bars" aria-hidden="true"><i></i><i></i><i></i></span>
                      <Pause v-else :size="17" :stroke-width="2.4" aria-hidden="true" />
                    </span>
                    <button
                      v-else
                      class="local-library-select"
                      type="button"
                      :aria-label="selectedLocalTrackIds.has(track.id) ? `取消选择 ${track.title}` : `选择 ${track.title}`"
                      @click.stop="toggleLocalTrackSelection(track)"
                    >
                      <span v-if="selectedLocalTrackIds.has(track.id)" aria-hidden="true">✓</span>
                      <span v-else>{{ index + 1 }}</span>
                    </button>
                  </span>
                  <span class="local-library-track-title">
                    <span class="local-library-cover" :style="{ background: `linear-gradient(135deg, ${track.primary}, ${track.secondary})` }">
                      <img v-if="track.coverUrl && !failedCoverIds.has(trackCoverKey(track))" :src="resolveBackendUrl(track.coverUrl)" :alt="`${track.title}封面`" @error="handleTrackCoverError($event, track)" />
                      <span v-else aria-hidden="true">{{ track.mark }}</span>
                    </span>
                    <span class="local-library-track-copy">
                      <span class="local-library-track-name">
                        <strong>{{ track.title }}</strong>
                        <small v-if="duplicateTrackIds.has(track.id)" class="local-duplicate-badge">疑似重复</small>
                      </span>
                      <small>{{ track.artist }}</small>
                    </span>
                  </span>
                  <span class="local-library-album">{{ track.album || "未知专辑" }}</span>
                  <span class="local-library-duration">
                    <strong>{{ formatLyricTime(track.duration) }}</strong>
                    <small>{{ localTrackAudioInfo(track) }}</small>
                  </span>
                </div>
              </div>
              <p v-else class="local-library-empty">
                {{ localLibrarySearchKeyword ? "没有找到匹配的本地歌曲。" : "还没有本地歌曲，先添加音乐库文件夹。" }}
              </p>
            </section>

          </section>
        </template>

        <template v-else-if="appMode === 'local' && activeView === 'artists' && !submittedKeyword">
          <section v-if="!selectedLocalArtist" class="local-artists-page" aria-label="艺术家">
            <header class="local-artists-header">
              <div class="local-artists-title">
                <h1>艺术家</h1>
                <span>共 {{ filteredLocalArtists.length }} 位艺术家</span>
              </div>
              <div class="local-artists-tools" aria-label="艺术家筛选工具">
                <select v-model="localArtistSortMode" aria-label="艺术家排序">
                  <option value="name-asc">名称 A-Z</option>
                  <option value="name-desc">名称 Z-A</option>
                  <option value="count-desc">歌曲数量多→少</option>
                  <option value="count-asc">歌曲数量少→多</option>
                </select>
                <select v-model="localArtistGenreFilter" aria-label="艺术家流派筛选">
                  <option v-for="genre in localArtistGenres" :key="genre" :value="genre">{{ genre }}</option>
                </select>
                <label class="local-artist-search">
                  <span aria-hidden="true">⌕</span>
                  <input v-model="localArtistSearchKeyword" type="search" placeholder="搜索歌曲、歌手、专辑或文件夹" />
                </label>
              </div>
            </header>

            <div v-if="localArtistGroups.length > 0" class="local-artist-groups">
              <section
                v-for="group in localArtistGroups"
                :key="group.letter"
                class="local-artist-group"
                :data-artist-letter="group.letter"
              >
                <h2>{{ group.letter }}</h2>
                <div class="local-artist-grid">
                  <button
                    v-for="artist in group.artists"
                    :key="artist.id"
                    class="local-artist-card"
                    type="button"
                    @click="openLocalArtist(artist)"
                  >
                    <span class="local-artist-cover" :style="{ background: `linear-gradient(135deg, ${artist.primary}, ${artist.secondary})` }">
                      <img v-if="resolveBackendUrl(artist.coverUrl)" :src="resolveBackendUrl(artist.coverUrl)" :alt="`${artist.name}封面`" />
                      <span v-else aria-hidden="true">{{ artist.mark }}</span>
                    </span>
                    <strong>{{ artist.name }}</strong>
                    <small>{{ artist.trackCount }} 首</small>
                  </button>
                </div>
              </section>
            </div>
            <p v-else class="local-artist-empty">没有找到匹配的艺术家。</p>

          </section>

          <section v-else class="local-artist-detail" aria-label="艺术家详情">
            <header class="local-artist-detail-hero">
              <button type="button" @click="closeLocalArtistDetail">‹ 返回艺术家</button>
              <div class="local-artist-detail-copy">
                <span>ARTIST</span>
                <h1>{{ selectedLocalArtist.name }}</h1>
                <p>{{ selectedLocalArtist.trackCount }} 首歌曲 · {{ localArtistAlbums.length }} 张专辑</p>
              </div>
            </header>

            <section class="local-artist-detail-section">
              <div class="local-listening-heading">
                <div>
                  <h3>专辑</h3>
                  <p>这个艺术家在本地音乐库里的专辑集合。</p>
                </div>
              </div>
              <div v-if="localArtistAlbums.length > 0" class="local-album-row">
                <button
                  v-for="album in localArtistAlbums"
                  :key="album.id"
                  class="local-album-card"
                  type="button"
                  @click="openLocalAlbum(album)"
                >
                  <span class="local-album-cover" :style="{ background: `linear-gradient(135deg, ${album.primary}, ${album.secondary})` }">
                    <img v-if="resolveBackendUrl(album.coverUrl)" :src="resolveBackendUrl(album.coverUrl)" :alt="`${album.title}封面`" />
                    <span v-else aria-hidden="true">{{ album.mark }}</span>
                  </span>
                  <strong>{{ album.title }}</strong>
                  <small>{{ album.artistText }}</small>
                </button>
              </div>
              <p v-else class="local-listening-empty">这个艺术家还没有可归类的专辑。</p>
            </section>

            <section class="local-artist-detail-section">
              <div class="local-listening-heading">
                <div>
                  <h3>歌曲</h3>
                  <p>点击歌曲即可播放。</p>
                </div>
              </div>
              <div class="local-artist-track-list">
                <button
                  v-for="(track, index) in selectedLocalArtist.tracks"
                  :key="track.id"
                  type="button"
                  :class="{ active: track.id === currentTrack.id }"
                  @click="playTrack(track)"
                  @contextmenu.prevent="openTrackContextMenu(track, $event, selectedLocalArtist.tracks)"
                >
                  <span>{{ (index + 1).toString().padStart(2, "0") }}</span>
                  <strong>{{ track.title }}</strong>
                  <small>{{ track.album || "未知专辑" }}</small>
                  <em>{{ formatLyricTime(track.duration) }}</em>
                </button>
              </div>
            </section>
          </section>
        </template>

        <template v-if="appMode === 'local' && activeView === 'albums' && !submittedKeyword && !selectedLocalAlbum">
          <section class="local-albums-page" aria-label="全部专辑">
            <div v-if="localAlbums.length > 0" class="local-album-grid">
              <button
                v-for="album in localAlbums"
                :key="album.id"
                class="local-album-card"
                type="button"
                @click="openLocalAlbum(album)"
              >
                <span class="local-album-cover" :style="{ background: `linear-gradient(135deg, ${album.primary}, ${album.secondary})` }">
                  <img v-if="resolveBackendUrl(album.coverUrl)" :src="resolveBackendUrl(album.coverUrl)" :alt="`${album.title}封面`" />
                  <span v-else aria-hidden="true">{{ album.mark }}</span>
                </span>
                <strong>{{ album.title }}</strong>
                <small>{{ album.artistText }}</small>
              </button>
            </div>
            <p v-else class="empty-state">还没有读取到本地专辑，先扫描音乐文件夹。</p>
          </section>
        </template>

        <template v-if="appMode === 'local' && activeView === 'albums' && !submittedKeyword && selectedLocalAlbum">
          <section class="local-album-detail-page" aria-label="专辑详情">
            <header class="local-album-detail-header">
              <div class="local-album-detail-title-row">
                <button class="local-album-detail-back" type="button" @click="closeLocalAlbumDetail">
                  <ArrowLeft :size="16" :stroke-width="1.8" aria-hidden="true" />
                  返回
                </button>
                <h1>{{ selectedLocalAlbum.title }}</h1>
                <span>{{ selectedLocalAlbumSummary }}</span>
              </div>

              <div class="local-album-detail-tools">
                <details class="local-album-filter" :open="localAlbumFilterOpen" @toggle="localAlbumFilterOpen = ($event.target as HTMLDetailsElement).open">
                  <summary><Filter :size="14" :stroke-width="1.8" aria-hidden="true" />筛选器<ChevronDown :size="13" aria-hidden="true" /></summary>
                  <div class="local-album-filter-panel">
                    <label>
                      <span>排序方式</span>
                      <select v-model="localAlbumSortMode">
                        <option value="default">默认顺序</option>
                        <option value="title">标题 A-Z</option>
                        <option value="duration">时长</option>
                      </select>
                    </label>
                  </div>
                </details>
                <label class="local-album-search">
                  <Search :size="15" :stroke-width="1.7" aria-hidden="true" />
                  <input v-model="localAlbumSearchKeyword" type="search" placeholder="搜索歌曲、歌手、专辑或文件夹" />
                </label>
              </div>
            </header>

            <div class="local-album-detail-actions">
              <button type="button" :disabled="filteredLocalAlbumTracks.length === 0" @click="playLocalAlbumAll">
                <Play :size="14" :stroke-width="1.8" aria-hidden="true" />播放全部
              </button>
              <button type="button" :disabled="filteredLocalAlbumTracks.length === 0" @click="playLocalAlbumRandom">
                <Shuffle :size="14" :stroke-width="1.8" aria-hidden="true" />随机播放
              </button>
            </div>

            <section class="local-album-track-table" aria-label="专辑歌曲">
              <div class="local-album-track-head" aria-hidden="true">
                <span>#</span><span>标题</span><span>专辑</span><span>时长</span>
              </div>
              <div v-if="filteredLocalAlbumTracks.length" class="local-album-track-list">
                <button
                  v-for="(track, index) in filteredLocalAlbumTracks"
                  :key="track.id"
                  class="local-album-track-row"
                  :class="{ active: track.id === currentTrack.id }"
                  type="button"
                  @click="playLocalAlbumTrack(track)"
                  @contextmenu.prevent="openTrackContextMenu(track, $event, filteredLocalAlbumTracks)"
                >
                  <span
                    class="local-album-track-status"
                    :class="{ current: track.id === currentTrack.id }"
                    :aria-label="track.id === currentTrack.id ? ((isPlaying || isPlaybackStarting) ? '正在播放' : '已暂停') : undefined"
                  >
                    <span v-if="track.id === currentTrack.id" class="track-playback-indicator" :class="{ paused: !isPlaying && !isPlaybackStarting }">
                      <span v-if="isPlaying || isPlaybackStarting" class="track-playback-bars" aria-hidden="true"><i></i><i></i><i></i></span>
                      <Pause v-else :size="17" :stroke-width="2.4" aria-hidden="true" />
                    </span>
                    <span v-else>{{ (index + 1).toString().padStart(2, "0") }}</span>
                  </span>
                  <span class="local-album-track-main">
                    <span class="local-album-track-cover" :style="{ background: `linear-gradient(135deg, ${track.primary}, ${track.secondary})` }">
                      <img v-if="track.coverUrl && !failedCoverIds.has(trackCoverKey(track))" :src="resolveBackendUrl(track.coverUrl)" :alt="`${track.title}封面`" @error="handleTrackCoverError($event, track)" />
                      <span v-else aria-hidden="true">{{ track.mark }}</span>
                    </span>
                    <span class="local-album-track-copy"><strong>{{ track.title }}</strong><small>{{ track.artist }}</small></span>
                  </span>
                  <span class="local-album-track-album">{{ track.album || "未知专辑" }}</span>
                  <span class="local-album-track-duration"><strong>{{ formatLyricTime(track.duration) }}</strong><small>{{ localTrackAudioInfo(track) }}</small></span>
                </button>
              </div>
              <div v-else class="local-album-track-empty">没有找到匹配的歌曲。</div>
            </section>
          </section>
        </template>

        <template v-if="appMode === 'local' && activeView === 'folders' && !submittedKeyword">
          <section class="local-folders-page" aria-label="本地音乐文件夹">
            <header class="local-folders-header">
              <div v-if="!selectedLocalFolder" class="local-folders-title">
                <h1>文件夹</h1>
                <span>共 {{ filteredLocalFolders.length }} 个文件夹</span>
              </div>
              <div v-else class="local-folder-detail-heading">
                <button class="local-folder-back" type="button" @click="closeLocalFolderDetail">← 返回文件夹</button>
                <div>
                  <h1>{{ selectedLocalFolder.name }}</h1>
                  <span>{{ selectedLocalFolder.tracks.length }} 首歌曲</span>
                </div>
                <p :title="selectedLocalFolder.path">{{ selectedLocalFolder.path }}</p>
              </div>
              <label v-if="!selectedLocalFolder" class="local-folder-search">
                <span aria-hidden="true">⌕</span>
                <input v-model="localFolderSearchKeyword" type="search" placeholder="搜索歌曲、歌手、专辑或文件夹" />
              </label>
            </header>

            <div v-if="!selectedLocalFolder">
              <div v-if="filteredLocalFolders.length" class="local-folder-grid">
                <button
                  v-for="folder in filteredLocalFolders"
                  :key="folder.id"
                  class="local-folder-card"
                  type="button"
                  @click="openLocalFolder(folder)"
                >
                  <span class="local-folder-cover" :style="{ background: `linear-gradient(135deg, ${folder.primary}, ${folder.secondary})` }">
                    <img
                      v-if="folder.coverUrl && !failedCoverIds.has(trackCoverKey(folder.coverTrack))"
                      :src="resolveBackendUrl(folder.coverUrl)"
                      :alt="`${folder.name}文件夹封面`"
                      @error="handleTrackCoverError($event, folder.coverTrack)"
                    />
                    <span v-else class="local-folder-placeholder" aria-hidden="true">{{ folder.mark }}</span>
                  </span>
                  <span class="local-folder-card-copy">
                    <strong>{{ folder.name }}</strong>
                    <small>{{ folder.tracks.length }} 首</small>
                  </span>
                </button>
              </div>
              <div v-else class="local-folder-empty">
                <strong>{{ localFolderSearchKeyword ? "没有找到匹配的文件夹" : "还没有本地音乐文件夹" }}</strong>
                <span>{{ localFolderSearchKeyword ? "可以尝试搜索文件夹内的歌曲、歌手或专辑。" : "添加并扫描音乐文件夹后会显示在这里。" }}</span>
                <button v-if="!localFolderSearchKeyword" type="button" @click="chooseMusicFolderAndScan">添加文件夹</button>
              </div>
            </div>

            <div v-else class="local-folder-detail">
              <div class="local-folder-track-header" aria-hidden="true">
                <span>#</span><span>标题</span><span>专辑</span><span>时长</span>
              </div>
              <div class="local-folder-track-list">
                <button
                  v-for="(track, index) in selectedLocalFolder.tracks"
                  :key="track.id"
                  type="button"
                  :class="{ active: track.id === currentTrack.id }"
                  @click="playLocalFolderTrack(track)"
                  @contextmenu.prevent="openTrackContextMenu(track, $event, selectedLocalFolder.tracks)"
                >
                  <span class="local-folder-track-index">{{ (index + 1).toString().padStart(2, "0") }}</span>
                  <span class="local-folder-track-title">
                    <span class="local-folder-track-cover" :style="{ background: `linear-gradient(135deg, ${track.primary}, ${track.secondary})` }">
                      <img v-if="track.coverUrl && !failedCoverIds.has(trackCoverKey(track))" :src="resolveBackendUrl(track.coverUrl)" :alt="`${track.title}封面`" @error="handleTrackCoverError($event, track)" />
                      <span v-else aria-hidden="true">{{ track.mark }}</span>
                    </span>
                    <span><strong>{{ track.title }}</strong><small>{{ track.artist }}</small></span>
                  </span>
                  <span class="local-folder-track-album">{{ track.album || "未知专辑" }}</span>
                  <span class="local-folder-track-duration">{{ formatLyricTime(track.duration) }}</span>
                </button>
              </div>
            </div>
          </section>
        </template>

        <template v-if="activeView === 'history' && appMode !== 'streaming' && !submittedKeyword">
          <section class="recent-history-page" aria-label="最近播放">
            <header class="recent-history-header">
              <div class="recent-history-heading">
                <div class="recent-history-title-row">
                  <h1>最近播放</h1>
                  <span>{{ historyTrackSummary }}</span>
                </div>
                <div class="recent-history-actions">
                  <button type="button" :disabled="filteredHistoryTracks.length === 0" @click="playAllHistoryTracks">
                    <span aria-hidden="true">▷</span>
                    播放全部
                  </button>
                  <button type="button" :disabled="filteredHistoryTracks.length === 0" @click="playRandomHistoryTracks">
                    <span aria-hidden="true">⤨</span>
                    随机播放
                  </button>
                </div>
              </div>

              <div class="recent-history-tools" aria-label="最近播放工具区">
                <label class="recent-history-source">
                  <span aria-hidden="true">ϟ</span>
                  <select v-model="historySourceFilter" aria-label="选择音源">
                    <option value="all">全部</option>
                    <option value="local">本地音乐</option>
                    <option value="netease">网易云</option>
                    <option value="qq">QQ 音乐</option>
                  </select>
                </label>
                <details class="recent-history-filter">
                  <summary><span aria-hidden="true">▽</span> 筛选器 <span aria-hidden="true">⌄</span></summary>
                  <div class="recent-history-filter-panel">
                    <label>
                      <span>排序方式</span>
                      <select v-model="historySortMode">
                        <option value="recent">最新播放</option>
                        <option value="oldest">最早播放</option>
                        <option value="title">歌曲名称</option>
                      </select>
                    </label>
                    <button type="button" @click="resetHistoryFilters">重置筛选</button>
                  </div>
                </details>
                <label class="recent-history-search">
                  <span aria-hidden="true">⌕</span>
                  <input v-model="historySearchKeyword" type="search" placeholder="搜索歌曲、歌手、专辑或文件夹" />
                </label>
              </div>
            </header>

            <section class="recent-history-table" aria-label="最近播放歌曲列表">
              <div class="recent-history-table-head" aria-hidden="true">
                <span>#</span>
                <span>标题</span>
                <span>专辑</span>
                <span>时长</span>
              </div>
              <div v-if="filteredHistoryTracks.length" class="recent-history-list">
                <button
                  v-for="(track, index) in filteredHistoryTracks"
                  :key="track.id"
                  class="recent-history-row"
                  :class="{ active: track.id === currentTrack.id }"
                  type="button"
                  @click="playHistoryTrack(track)"
                  @contextmenu.prevent="openTrackContextMenu(track, $event, filteredHistoryTracks)"
                >
                  <span class="recent-history-index">{{ index + 1 }}</span>
                  <span class="recent-history-track">
                    <span class="recent-history-cover" :style="{ background: `linear-gradient(135deg, ${track.primary}, ${track.secondary})` }">
                      <img v-if="track.coverUrl && !failedCoverIds.has(trackCoverKey(track))" :src="resolveBackendUrl(track.coverUrl)" :alt="`${track.title}封面`" @error="handleTrackCoverError($event, track)" />
                      <span v-else aria-hidden="true">{{ track.mark }}</span>
                    </span>
                    <span class="recent-history-track-copy">
                      <strong>{{ track.title }}</strong>
                      <small>{{ track.artist }}</small>
                    </span>
                  </span>
                  <span class="recent-history-album">{{ track.album || "未知专辑" }}</span>
                  <span class="recent-history-duration">
                    <strong>{{ formatLyricTime(track.duration) }}</strong>
                    <small>{{ localTrackAudioInfo(track) }}</small>
                  </span>
                </button>
              </div>
              <div v-else class="recent-history-empty">
                <strong>{{ historyTracks.length ? "没有符合筛选条件的播放记录" : "还没有播放记录" }}</strong>
                <span>{{ historyTracks.length ? "可以切换音源或重置筛选后再试。" : "播放过的歌曲会按最近时间显示在这里。" }}</span>
              </div>
            </section>
          </section>
        </template>

        <template v-if="appMode === 'streaming' && activeView === 'home' && !submittedKeyword">
          <StreamingQqLoginPage
            v-if="!selectedStreamingAccount && streamingSource === 'qq'"
            @login="openProviderAuthPanel('qq')"
          />
          <section
            v-else-if="!selectedStreamingAccount"
            class="streaming-home-page streaming-home-login-card"
          >
            <span class="streaming-login-icon" aria-hidden="true"><Headphones :size="29" :stroke-width="1.8" /></span>
            <span class="streaming-login-kicker">{{ streamingProviderName }} · 在线漫游</span>
            <h2>听见为你而来的音乐</h2>
            <p>登录【{{ streamingProviderName }}】后，这里会加载此音源提供的个性化推荐与精选歌单。</p>
            <button type="button" @click="openProviderAuthPanel(streamingSource)">
              <UserRound :size="17" :stroke-width="1.8" aria-hidden="true" />
              登录 {{ streamingProviderName }}
            </button>
          </section>

          <div v-else-if="streamingHomeState === 'loading'" class="streaming-home-page homepage-state">
            正在加载{{ streamingProviderName }}个性化推荐...
          </div>
          <div v-else-if="streamingHomeState === 'error'" class="streaming-home-page homepage-state error">
            <span>{{ streamingHomeError }}</span>
            <button type="button" @click="loadStreamingHomeData()">重新加载</button>
          </div>

          <section v-else :key="streamingSource" class="streaming-home-page streaming-home-content">
            <article class="streaming-daily-mix" :class="{ 'is-qq': streamingSource === 'qq' }">
              <div class="streaming-daily-copy">
                <div v-if="streamingSource === 'qq'" class="streaming-daily-qq-meta">
                  <span>DAILY DISCOVERY</span>
                  <span>01 / 03</span>
                </div>
                <div v-else class="streaming-daily-date">
                  <strong>{{ streamingDailyDate.day }}</strong>
                  <span><b>{{ streamingDailyDate.label }}</b><small>每日 06:00 焕新</small></span>
                </div>
                <h2>每日推荐</h2>
                <span v-if="streamingSource !== 'qq'" class="streaming-daily-kicker">DAILY MIX</span>
                <p v-if="streamingSource === 'qq' && streamingHomeTracks.length">来自 QQ 音乐的每日推荐，把适合你的旋律放进今天。</p>
                <p v-else-if="streamingHomeTracks.length">来自{{ streamingProviderName }}的个性化内容，随你的收听偏好持续更新。</p>
                <p v-else>当前音源暂时没有返回新的推荐内容。</p>
                <div class="streaming-daily-actions">
                  <button class="primary" type="button" :disabled="!streamingHomeTracks.length" @click="playStreamingDailyMix">
                    <Play :size="15" :stroke-width="1.9" fill="currentColor" aria-hidden="true" />
                    播放全部
                  </button>
                  <button type="button" :disabled="!streamingHomeTracks.length" @click="openStreamingDailyMix">
                    {{ streamingSource === 'qq' ? '查看歌曲' : '查看全部' }}
                    <ArrowRight :size="15" :stroke-width="1.8" aria-hidden="true" />
                  </button>
                </div>
                <small v-if="streamingSource === 'qq'" class="streaming-daily-qq-count">
                  {{ streamingHomeTracks.length || 30 }} 首 · QQ 音乐
                </small>
              </div>

              <div class="streaming-daily-cover-stack" aria-label="每日推荐封面">
                <span
                  v-for="index in 3"
                  :key="streamingDailyCoverTracks[index - 1]?.id || `daily-cover-${index}`"
                  class="streaming-daily-stack-cover"
                  :style="streamingDailyCoverTracks[index - 1] ? { background: `linear-gradient(135deg, ${streamingDailyCoverTracks[index - 1].primary}, ${streamingDailyCoverTracks[index - 1].secondary})` } : undefined"
                >
                  <img
                    v-if="streamingDailyCoverTracks[index - 1]?.coverUrl"
                    :src="resolveBackendUrl(streamingDailyCoverTracks[index - 1].coverUrl!)"
                    :alt="`${streamingDailyCoverTracks[index - 1].title}封面`"
                  />
                  <span v-else aria-hidden="true">{{ streamingDailyCoverTracks[index - 1]?.mark || streamingDailyDate.day }}</span>
                </span>
              </div>
            </article>

            <div v-if="streamingSource === 'netease'" class="streaming-personal-grid">
              <button class="streaming-personal-card is-radar" type="button" @click="openPrivateRadar">
                <span class="streaming-radar-covers" aria-hidden="true">
                  <span v-for="index in 3" :key="streamingRadarCoverUrls[index - 1] || `radar-cover-${index}`">
                    <img v-if="streamingRadarCoverUrls[index - 1]" :src="resolveBackendUrl(streamingRadarCoverUrls[index - 1])" alt="" />
                    <Headphones v-else :size="16" :stroke-width="1.6" />
                  </span>
                </span>
                <span class="streaming-personal-copy">
                  <strong>私人雷达</strong>
                  <small>{{ streamingProviderName }} · 发现更多好音乐</small>
                </span>
                <span class="streaming-personal-arrow" aria-hidden="true"><ArrowRight :size="18" :stroke-width="1.8" /></span>
              </button>

              <button class="streaming-personal-card is-roaming" type="button" @click="openPrivateRoaming">
                <span class="streaming-radar-covers" aria-hidden="true">
                  <span v-for="index in 3" :key="streamingRoamingCoverUrls[index - 1] || `roaming-cover-${index}`">
                    <img v-if="streamingRoamingCoverUrls[index - 1]" :src="resolveBackendUrl(streamingRoamingCoverUrls[index - 1])" alt="" />
                    <Compass v-else :size="16" :stroke-width="1.6" />
                  </span>
                </span>
                <span class="streaming-personal-copy">
                  <strong>私人漫游</strong>
                  <small>{{ streamingProviderName }} · 为你持续推荐</small>
                </span>
                <span class="streaming-personal-arrow" aria-hidden="true"><ArrowRight :size="18" :stroke-width="1.8" /></span>
              </button>
            </div>

            <section v-if="streamingDailyPreviewTracks.length" class="streaming-daily-preview" aria-label="每日推荐歌曲预览">
              <header class="streaming-daily-preview-header">
                <div>
                  <h3>{{ streamingProviderName }} 为你精选</h3>
                  <p>点一首就开始·队列自动接上整份推荐</p>
                </div>
                <button class="streaming-daily-preview-all" type="button" @click="openStreamingDailyMix">
                  完整歌单
                  <ArrowRight :size="15" :stroke-width="1.8" aria-hidden="true" />
                </button>
              </header>

              <div class="streaming-daily-preview-grid">
                <button
                  v-for="(track, index) in streamingDailyPreviewTracks"
                  :key="track.id"
                  class="streaming-daily-preview-track"
                  :class="{ active: track.id === currentTrack.id }"
                  type="button"
                  @click="playStreamingDailyPreview(track.id)"
                  @contextmenu.prevent="openTrackContextMenu(track, $event, streamingHomeTracks)"
                >
                  <span class="streaming-daily-preview-index">{{ String(index + 1).padStart(2, "0") }}</span>
                  <span
                    class="streaming-daily-preview-cover"
                    :style="{ background: `linear-gradient(135deg, ${track.primary}, ${track.secondary})` }"
                  >
                    <img v-if="track.coverUrl" :src="resolveBackendUrl(track.coverUrl)" :alt="`${track.title}封面`" />
                    <span v-else aria-hidden="true">{{ track.mark }}</span>
                    <span
                      v-if="track.id === currentTrack.id && (isPlaying || isPlaybackStarting)"
                      class="streaming-daily-preview-bars"
                      aria-label="正在播放"
                    ><i></i><i></i><i></i></span>
                  </span>
                  <span class="streaming-daily-preview-copy">
                    <strong>{{ track.title }}</strong>
                    <small>{{ track.artist }}</small>
                  </span>
                  <span class="streaming-daily-preview-duration">{{ formatLyricTime(track.duration) }}</span>
                </button>
              </div>
            </section>

            <StreamingQqRankingCards
              v-if="streamingSource === 'qq'"
              :rankings="qqHomeRankings"
              @play="playQqHomeRankingTrack"
              @context-menu="openQqHomeRankingTrackContextMenu"
              @open="openQqHomeRanking"
              @retry="loadQqHomeRankings"
            />

            <StreamingQqCuratedPlaylists
              v-if="streamingSource === 'qq'"
              :playlists="streamingHomePlaylists"
              :refreshing="qqHomePlaylistsRefreshing"
              :error="qqHomePlaylistsError"
              @select="selectPlaylist"
              @discover="selectView('discover')"
              @refresh="refreshQqHomePlaylists"
            />

            <section v-if="streamingSource === 'netease' && streamingHomePlaylists.length" class="streaming-featured-playlists" aria-label="网易云音乐精选歌单">
              <header class="streaming-featured-playlists-header">
                <h3>网易云音乐 精选歌单</h3>
                <p>为你挑选 {{ streamingHomePlaylists.length }} 份歌单</p>
              </header>
              <div class="streaming-featured-playlists-grid">
                <button
                  v-for="playlist in streamingHomePlaylists.slice(0, 8)"
                  :key="playlist.id"
                  class="streaming-featured-playlist-card"
                  type="button"
                  @click="selectPlaylist(playlist)"
                >
                  <span class="streaming-featured-playlist-cover" :style="{ background: `linear-gradient(135deg, ${playlist.primary}, ${playlist.secondary})` }">
                    <img v-if="playlist.imageUrl" :src="resolveBackendUrl(playlist.imageUrl)" :alt="`${playlist.title}封面`" />
                    <span v-else class="streaming-featured-playlist-mark" aria-hidden="true">{{ playlist.mark }}</span>
                    <span v-if="playlist.count > 0" class="streaming-featured-playlist-count">{{ playlist.count }} 首</span>
                    <span class="streaming-featured-playlist-play" aria-hidden="true"><Play :size="16" :stroke-width="1.8" fill="currentColor" /></span>
                  </span>
                  <strong>{{ playlist.title }}</strong>
                </button>
              </div>
            </section>
          </section>
        </template>

        <StreamingPlaylistDiscoveryPage
          v-if="activeView === 'discover' && !submittedKeyword && !selectedPlaylist"
          :provider="streamingSource"
          :mode="playlistDiscoveryMode"
          :order="playlistDiscoveryOrder"
          :category="playlistDiscoveryCategory"
          :playlists="playlistDiscoveryPlaylists"
          :hot-tags="playlistDiscoveryHotTags"
          :high-quality-tags="playlistDiscoveryQualityTags"
          :category-groups="playlistDiscoveryCategoryGroups"
          :total="playlistDiscoveryTotal"
          :page="playlistDiscoveryPage"
          :has-more="playlistDiscoveryHasMore"
          :loading="playlistDiscoveryState === 'loading'"
          :error="playlistDiscoveryError"
          @select="openDiscoveredPlaylist"
          @change-mode="changePlaylistDiscoveryMode"
          @change-order="changePlaylistDiscoveryOrder"
          @change-category="changePlaylistDiscoveryCategory"
          @change-page="changePlaylistDiscoveryPage"
          @retry="loadPlaylistDiscovery(playlistDiscoveryPage)"
        />

        <template v-if="activeView === 'playlists' && !selectedPlaylist">
          <section class="playlist-overview-page" aria-label="歌单">
            <header class="playlist-overview-header">
              <div>
                <h1 class="playlist-overview-title">歌单 <span>共 {{ playlistOverviewPlaylists.length }} 份歌单</span></h1>
                <p>长按歌单拖动排序，顺序保存在当前设备。</p>
              </div>
              <label class="playlist-overview-search">
                <span aria-hidden="true">⌕</span>
                <input v-model="playlistOverviewKeyword" type="search" placeholder="搜索歌曲、歌手、专辑或文件夹" />
              </label>
            </header>

            <div class="playlist-overview-grid">
              <button class="create-playlist-card" type="button" @click="openPlaylistCreateDialog">
                <span class="create-playlist-plus" aria-hidden="true">+</span>
                <strong>创建歌单</strong>
                <small>点击创建新歌单</small>
              </button>
              <div
                v-for="playlist in playlistOverviewPlaylists"
                :key="playlist.id"
                class="playlist-overview-card-shell"
                :class="{ 'is-dragging': playlistOverviewDraggedId === playlist.id }"
                draggable="true"
                @dragstart="startPlaylistOverviewDrag(playlist.id)"
                @dragover.prevent
                @drop="dropPlaylistOverviewCard(playlist.id)"
                @dragend="finishPlaylistOverviewDrag"
              >
                <PlaylistCard :playlist="playlist" :show-play="false" @select="selectPlaylist" @play="playPlaylist" />
              </div>
            </div>
            <p v-if="playlistOverviewPlaylists.length === 0 && playlistOverviewKeyword" class="playlist-overview-empty">没有找到匹配的歌单。</p>
          </section>
        </template>

        <StreamingDailyMixPage
          v-if="activeView === 'playlist' && selectedPlaylist && isStreamingTemplatePlaylist"
          :key="`${streamingSource}:${selectedStreamingAccount?.userId}:${selectedPlaylist.id}`"
          :class="{ 'is-library-detail-page': selectedPlaylist.id.startsWith('account-favorites-detail-') }"
          :tracks="selectedPlaylistTracks"
          :provider-name="selectedPlaylist.source === 'qq' ? 'QQ 音乐' : '网易云音乐'"
          :current-track-id="currentTrack.id"
          :is-playing="isPlaying || isPlaybackStarting"
          :title="selectedPlaylist.title"
          :label="isStreamingDailyPlaylist ? '推荐' : '精选歌单'"
          :cover-url="selectedPlaylist.imageUrl"
          :collectable="selectedPlaylistCollectable"
          :collected="selectedPlaylistCollected"
          :collection-pending="playlistCollectionPending"
          :batch-mode="selectedPlaylistBatchMode"
          :run-batch="runStreamingTrackBatch"
          :mutation-pending="playlistMutationPending"
          :reorderable="Boolean(selectedPlaylistBatchMode)"
          :reorder-pending="playlistOrderCooling"
          :order-message="playlistOrderMessage"
          :refreshing="isStreamingDailyPlaylist ? streamingHomeState === 'loading' : playlistState === 'loading'"
          @back="navigateBack"
          @play="playStreamingDailyTrack"
          @context-menu="openTrackContextMenu($event.track, $event.event, selectedPlaylistTracks)"
          @play-all="playStreamingDailyTrackList"
          @play-random="playStreamingDailyTrackListRandom"
          @toggle-favorite="toggleStreamingDailyFavorite"
          @toggle-collection="toggleSelectedPlaylistCollection"
          @reorder="reorderStreamingPlaylistTrack"
          @refresh="refreshStreamingPlaylist"
          @search-global="searchFromStreamingDailyMix"
        />

        <template v-if="activeView === 'playlist' && selectedPlaylist && !isStreamingTemplatePlaylist">
          <section class="playlist-detail-page" aria-label="歌单详情">
            <header class="playlist-detail-header">
              <button class="playlist-detail-back" type="button" @click="navigateBack">← 返回</button>
              <div class="playlist-detail-title-row">
                <h1 class="playlist-detail-title">{{ selectedPlaylist.title }}</h1>
                <span class="playlist-detail-meta">{{ selectedPlaylistTrackSummary }}</span>
              </div>
            </header>

            <div class="playlist-detail-actions-row">
              <div class="playlist-quick-actions">
                <button type="button" :disabled="filteredPlaylistTracks.length === 0" @click="playSelectedPlaylistAll"><span aria-hidden="true">▷</span> 播放全部</button>
                <button type="button" :disabled="filteredPlaylistTracks.length === 0" @click="playSelectedPlaylistRandom"><span aria-hidden="true">⤨</span> 随机播放</button>
              </div>
              <div class="playlist-detail-controls">
                <div class="playlist-detail-toolbar" aria-label="歌单工具">
                  <button class="playlist-tool-rename" type="button" title="重命名歌单" aria-label="重命名歌单" @click="openPlaylistRenameDialog"><span aria-hidden="true">✎</span></button>
                  <button class="playlist-tool-copy" type="button" title="复制歌单" aria-label="复制歌单" @click="duplicateSelectedPlaylist"><span aria-hidden="true">⧉</span></button>
                  <button class="playlist-tool-cover" type="button" title="设置歌单封面" aria-label="设置歌单封面" @click="choosePlaylistCover"><span aria-hidden="true">▧</span></button>
                </div>
                <details class="playlist-detail-filter" :open="playlistFilterOpen" @toggle="playlistFilterOpen = ($event.target as HTMLDetailsElement).open">
                  <summary>筛选器 <span aria-hidden="true">⌄</span></summary>
                  <div class="playlist-filter-panel">
                    <label>
                      <span>文件夹</span>
                      <select v-model="playlistFilter.folder">
                        <option v-for="folder in playlistFolderOptions" :key="folder">{{ folder }}</option>
                      </select>
                    </label>
                    <label>
                      <span>来源</span>
                      <select v-model="playlistFilter.source">
                        <option v-for="source in playlistSourceOptions" :key="source">{{ source }}</option>
                      </select>
                    </label>
                  </div>
                </details>
                <label class="playlist-detail-search">
                  <span aria-hidden="true">⌕</span>
                  <input v-model="keyword" type="search" placeholder="搜索歌曲、歌手、专辑或文件夹" />
                </label>
              </div>
            </div>

            <article class="playlist-track-container">
              <div v-if="playlistState === 'loading'" class="playlist-loading-state">正在加载歌单歌曲...</div>
              <div v-else-if="playlistState === 'error'" class="playlist-loading-state error">
                {{ playlistError }}
                <button type="button" @click="selectPlaylist(selectedPlaylist)">重新加载</button>
              </div>
              <div v-else-if="filteredPlaylistTracks.length > 0" class="playlist-track-list">
                <div class="playlist-track-table-head" aria-hidden="true">
                  <span>#</span>
                  <span>标题</span>
                  <span>专辑</span>
                  <span>时长</span>
                </div>
                <button
                  v-for="(track, index) in filteredPlaylistTracks"
                  :key="`${track.id}-${index}`"
                  class="playlist-track-card"
                  :class="{ active: track.id === currentTrack.id, 'is-dragging': playlistTrackDraggedKey === trackOrderKey(track) }"
                  type="button"
                  draggable="true"
                  @dragstart="startPlaylistTrackDrag(track)"
                  @dragover.prevent
                  @drop.prevent.stop="dropPlaylistTrack(track)"
                  @dragend="finishPlaylistTrackDrag"
                  @click="playTrack(track)"
                  @contextmenu.prevent="openTrackContextMenu(track, $event, filteredPlaylistTracks)"
                >
                  <span class="playlist-track-index">{{ (index + 1).toString().padStart(2, "0") }}</span>
                  <span class="playlist-track-cover" :style="{ background: `linear-gradient(135deg, ${track.primary}, ${track.secondary})` }">
                    <img v-if="track.coverUrl && !failedCoverIds.has(trackCoverKey(track))" :src="resolveBackendUrl(track.coverUrl)" :alt="`${track.title}封面`" @error="handleTrackCoverError($event, track)" />
                    <span v-else aria-hidden="true">{{ track.mark }}</span>
                  </span>
                  <span class="playlist-track-main"><strong>{{ track.title }}</strong><small>{{ track.artist }}</small></span>
                  <span class="playlist-track-album">{{ track.album }}</span>
                  <span class="playlist-track-duration">{{ Math.floor(track.duration / 60) }}:{{ (track.duration % 60).toString().padStart(2, "0") }}</span>
                </button>
              </div>
              <div v-else class="playlist-empty-state">
                <span class="playlist-empty-wave" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
                <strong>暂无内容</strong>
                <p>通过左侧菜单「歌单 → 添加文件夹」导入音乐</p>
              </div>
            </article>
          </section>
        </template>

        <section v-if="!submittedKeyword && activeView !== 'settings' && activeView !== 'playlists' && activeView !== 'aggregate' && activeView !== 'folders' && activeView !== 'history' && activeView !== 'discover' && !['streaming-library', 'cloud', 'account-following', 'account-followers', 'account-user-profile', 'streaming-recent', 'listening-ranking'].includes(activeView) && !(appMode === 'local' && (activeView === 'albums' || activeView === 'library' || activeView === 'artists')) && !selectedPlaylist && activeView !== 'home' && activeView !== 'daily'" class="section-block">
          <div class="section-heading">
            <div>
              <h2>歌单精选</h2>
              <span>{{ visiblePlaylists.length }} 个歌单</span>
            </div>
            <div class="section-heading-actions">
              <button class="text-button" type="button" @click="selectView('discover')">{{ selectedPlaylist ? "返回歌单" : "查看全部" }} <span aria-hidden="true">›</span></button>
            </div>
          </div>
          <div v-if="activeView === 'streaming-library' && accountContentState === 'loading'" class="online-search-state">
            正在加载网易云歌单...
          </div>
          <div v-else-if="activeView === 'streaming-library' && !account" class="online-search-state account-login-state">
            <strong>登录网易云后查看你的歌单</strong>
            <button type="button" @click="openAuthPanel">登录网易云</button>
          </div>
          <div v-else-if="activeView === 'streaming-library' && accountContentState === 'error' && accountPlaylists.length === 0" class="online-search-state error">
            {{ accountContentError }}
            <button type="button" @click="loadDailyRecommendationData">重新加载</button>
          </div>
          <div v-else-if="visiblePlaylists.length > 0" class="playlist-grid">
            <PlaylistCard v-for="playlist in visiblePlaylists" :key="playlist.id" :playlist="playlist" show-play @select="selectPlaylist" @play="playPlaylist" />
          </div>
          <div v-else class="empty-state">没有找到匹配的歌单，换个关键词试试。</div>
        </section>

        <section v-if="!submittedKeyword && activeView !== 'settings' && activeView !== 'albums' && activeView !== 'playlists' && activeView !== 'aggregate' && activeView !== 'folders' && activeView !== 'history' && activeView !== 'discover' && !['streaming-library', 'cloud', 'account-following', 'account-followers', 'account-user-profile', 'streaming-recent', 'listening-ranking'].includes(activeView) && !selectedPlaylist && !selectedLocalAlbum && !(appMode === 'local' && activeView === 'library') && !(appMode === 'local' && activeView === 'artists') && activeView !== 'home'" class="section-block track-section">
          <div class="section-heading">
            <div>
              <h2>{{ activeView === "daily" ? "每日推荐歌曲" : "继续聆听" }}</h2>
              <span>{{ visibleTracks.length }} 首歌曲</span>
            </div>
            <button class="text-button" type="button" @click="selectedLocalAlbum ? selectView('albums') : selectView('library')">{{ selectedLocalAlbum ? "全部专辑" : "打开音乐库" }} <span aria-hidden="true">›</span></button>
          </div>

          <div v-if="submittedKeyword && searchState === 'loading'" class="online-search-state">正在从网易云音乐获取歌曲...</div>
          <div v-else-if="submittedKeyword && searchState === 'error'" class="online-search-state error">{{ searchError }}</div>
          <div v-else-if="selectedPlaylist && playlistState === 'loading'" class="online-search-state">正在加载歌单歌曲...</div>
          <div v-else-if="selectedPlaylist && playlistState === 'error'" class="online-search-state error">
            {{ playlistError }}
            <button type="button" @click="selectPlaylist(selectedPlaylist)">重新加载</button>
          </div>
          <div v-else-if="activeView === 'daily' && dailyRecommendationState === 'error'" class="online-search-state error">
            {{ dailyRecommendationError }}，请先登录网易云账号后再试。
          </div>
          <div v-else-if="activeView === 'streaming-library' && accountContentState === 'loading'" class="online-search-state">
            正在加载网易云账号内容...
          </div>
          <div v-else-if="activeView === 'streaming-library' && !account" class="online-search-state account-login-state">
            <strong>登录网易云后查看喜欢歌曲和歌单</strong>
            <button type="button" @click="openAuthPanel">登录网易云</button>
          </div>
          <div v-else-if="activeView === 'streaming-library' && accountContentState === 'error' && accountFavoriteTracks.length === 0" class="online-search-state error">
            {{ accountContentError }}
            <button type="button" @click="loadDailyRecommendationData">重新加载</button>
          </div>
          <div v-else-if="visibleTracks.length > 0" class="track-list">
            <button v-for="(track, index) in visibleTracks" :key="track.id" class="track-row" :class="{ active: track.id === currentTrack.id }" type="button" @click="playTrack(track)" @contextmenu.prevent="openTrackContextMenu(track, $event, visibleTracks)">
              <span class="track-index">{{ (index + 1).toString().padStart(2, "0") }}</span>
              <span class="track-cover" :style="{ background: `linear-gradient(135deg, ${track.primary}, ${track.secondary})` }">
                <img v-if="track.coverUrl && !failedCoverIds.has(trackCoverKey(track))" :src="resolveBackendUrl(track.coverUrl)" :alt="`${track.title}封面`" @error="handleTrackCoverError($event, track)" />
                <span v-else aria-hidden="true">{{ track.mark }}</span>
              </span>
              <span class="track-details"><strong>{{ track.title }}</strong><span>{{ track.artist }}</span></span>
              <span class="track-album">{{ track.album }}</span>
              <span class="track-duration">{{ Math.floor(track.duration / 60) }}:{{ (track.duration % 60).toString().padStart(2, "0") }}</span>
              <span class="track-state" aria-hidden="true">{{ track.id === currentTrack.id && isPlaying ? "♫" : "•••" }}</span>
            </button>
          </div>
          <div v-else class="empty-state">{{ submittedKeyword ? "没有找到网易云歌曲，换个关键词试试。" : "还没有符合条件的歌曲。" }}</div>
        </section>

          </div>
        </Transition>
      </main>

      <Transition name="artist-index">
        <aside
          v-if="appMode === 'local' && activeView === 'artists' && !submittedKeyword && !selectedLocalArtist"
          class="local-artist-index"
          aria-label="艺术家字母索引"
        >
          <button
            v-for="(item, index) in artistAlphabetIndex"
            :key="item.letter"
            type="button"
            :disabled="!item.enabled"
            :class="{ active: selectedLocalArtistLetter === item.letter }"
            :aria-current="selectedLocalArtistLetter === item.letter ? 'true' : undefined"
            :style="{ '--artist-letter-index': index }"
            @click="scrollToArtistLetter(item.letter)"
          >
            {{ item.letter }}
          </button>
        </aside>
      </Transition>

      <Transition name="search-toast">
        <p v-if="searchToast" class="search-toast" role="status">{{ searchToast }}</p>
      </Transition>

      <div v-if="playlistNameDialogVisible" class="playlist-name-dialog" role="dialog" aria-modal="true" :aria-label="playlistNameDialogMode === 'rename' ? '重命名歌单' : '创建歌单'">
        <form class="playlist-name-modal" @submit.prevent="confirmPlaylistNameDialog">
          <h2>{{ playlistNameDialogMode === "rename" ? "重命名歌单" : "创建歌单" }}</h2>
          <label>
            <span>歌单名称</span>
            <input v-model="playlistNameInput" type="text" maxlength="40" placeholder="请输入歌单名称" autofocus :disabled="playlistNameSubmitting" />
          </label>
          <p v-if="playlistNameError" class="playlist-name-error">{{ playlistNameError }}</p>
          <div class="playlist-name-actions">
            <button type="button" :disabled="playlistNameSubmitting" @click="closePlaylistNameDialog">取消</button>
            <button class="primary" type="submit" :disabled="playlistNameSubmitting">{{ playlistNameSubmitting ? "创建中..." : "确认" }}</button>
          </div>
        </form>
      </div>

      <div
        v-if="trackPlaylistPicker"
        class="track-playlist-picker-dialog"
        role="dialog"
        aria-modal="true"
        :aria-label="trackPlaylistPicker.mode === 'aggregate' ? '加入聚合歌单' : '加入歌单'"
        @click.self="closeTrackPlaylistPicker"
      >
        <section class="track-playlist-picker-panel">
          <header>
            <div>
              <h2>{{ trackPlaylistPicker.mode === "aggregate" ? "加入聚合歌单" : "加入歌单" }}</h2>
              <p>选择要加入的目标：{{ trackPlaylistPicker.tracks.length === 1 ? trackPlaylistPicker.tracks[0]?.title : `已选择 ${trackPlaylistPicker.tracks.length} 首` }}</p>
            </div>
            <button class="track-playlist-picker-close" type="button" title="关闭" aria-label="关闭" @click="closeTrackPlaylistPicker">×</button>
          </header>

          <div v-if="trackPlaylistPicker.mode === 'regular'" class="track-playlist-target-list">
            <button
              v-for="playlist in playlistOverviewSource"
              :key="playlist.id"
              type="button"
              @click="addTrackToRegularPlaylist(playlist)"
            >
              <span class="track-playlist-target-art" :style="{ background: `linear-gradient(135deg, ${playlist.primary}, ${playlist.secondary})` }" aria-hidden="true">{{ playlist.mark }}</span>
              <span>
                <strong>{{ playlist.title }}</strong>
                <small>{{ playlist.count }} 首</small>
              </span>
              <i aria-hidden="true">＋</i>
            </button>
          </div>

          <div v-else-if="trackPlaylistPicker.mode === 'streaming' && streamingPlaylistTargets.length" class="track-playlist-target-list">
            <button
              v-for="playlist in streamingPlaylistTargets"
              :key="playlist.id"
              type="button"
              :disabled="playlistMutationPending"
              @click="addTracksToStreamingPlaylist(playlist)"
            >
              <span class="track-playlist-target-art" :style="{ background: `linear-gradient(135deg, ${playlist.primary}, ${playlist.secondary})` }" aria-hidden="true">{{ playlist.mark }}</span>
              <span><strong>{{ playlist.title }}</strong><small>{{ playlist.count }} 首</small></span>
              <i aria-hidden="true">＋</i>
            </button>
          </div>

          <div v-else-if="trackPlaylistPicker.mode === 'streaming'" class="track-playlist-picker-empty">
            <strong>还没有可编辑的自建歌单</strong>
            <span>请先在音乐库创建一个普通歌单。</span>
          </div>

          <div v-else-if="trackPlaylistPicker.mode === 'aggregate' && aggregatePlaylists.length" class="track-playlist-target-list">
            <button
              v-for="playlist in aggregatePlaylists"
              :key="playlist.id"
              type="button"
              @click="addTrackToSelectedAggregatePlaylist(playlist)"
            >
              <span class="track-playlist-target-art aggregate" aria-hidden="true">⌘</span>
              <span>
                <strong>{{ playlist.name }}</strong>
                <small>{{ mergeAggregateTracks(playlist.tracks).length }} 首 · {{ playlist.identifier }}</small>
              </span>
              <i aria-hidden="true">＋</i>
            </button>
          </div>

          <div v-else class="track-playlist-picker-empty">
            <strong>还没有聚合歌单</strong>
            <span>先创建一个聚合歌单，再把这首歌加进去。</span>
            <button type="button" @click="openAggregatePageFromPicker">前往新建</button>
          </div>
        </section>
      </div>

    <audio
      ref="audioElement"
      crossorigin="anonymous"
      preload="metadata"
      @play="handleAudioPlay"
      @pause="handleAudioPause"
      @seeking="handleAudioSeeking"
      @ratechange="resetPlaybackClock"
      @loadedmetadata="updateMediaDuration"
      @durationchange="updateMediaDuration"
      @timeupdate="updateProgressFromAudio"
      @ended="handleAudioEnded"
      @error="handleAudioError"
    ></audio>

      <Transition name="player-bar-visibility">
      <PlayerBar
        v-if="!shouldHidePlayerBar && !miniPlayerVisible"
        :class="{ 'song-detail-player-bar': showSongDetail }"
        :style="songDetailThemeStyle"
        :track="currentTrack"
        :duration="playbackDuration"
        :preview-progress-limit="previewProgressLimit"
        :cover-url="currentCoverUrl"
        :is-playing="isPlaying"
        :progress="progress"
        :desktop-lyrics-visible="desktopLyricsVisible"
        :volume="volume"
        :backend-connected="isBackendConnected"
        :sidebar-collapsed="sidebarCollapsed"
        :presentation="appearancePreferences.playerControls.presentation"
        :play-mode="playMode"
        :quality-source="currentPlaybackQualitySource"
        :quality-value="currentPlaybackQualityValue"
        :quality-label="currentPlaybackQualityLabel"
        :quality-options="currentPlaybackQualityOptions"
        :local-sources="hasLocalAudioSources ? localAudioGroups : undefined"
        :local-selection="localAudioSelection"
        :source-busy="localSourceBusy"
        :source-session="localSourceSession"
        :source-notice="localSourceNotice"
        @quality-open="loadLocalAudioSources()"
        @source-retry="loadLocalAudioSources(true)"
        @source-change="switchLocalAudioSource"
        @toggle="togglePlayback"
        @previous="previousTrack"
        @next="nextTrack"
        @mode="cyclePlayerBarPlayMode"
        @seek-start="beginSeek"
        @seek="previewSeek"
        @seek-end="finishSeek"
        @volume="updateVolume"
        @like="toggleLiked"
        @queue="showQueue"
        @mini="openMiniPlayer"
        @quality-change="changePlaybackQuality"
        @expand="toggleSongDetail"
        @desktop-lyrics="toggleDesktopLyrics"
      />
      </Transition>
    </div>

    <AuthPanel
      v-if="!nativeMiniMode"
      :visible="authPanelVisible"
      :provider="selectedAuthProvider"
      :account="selectedAuthAccount"
      :accounts="accounts"
      @close="closeAuthPanel"
      @authenticated="handleAuthenticated"
      @logout="handleLogout"
      @select-provider="openProviderAuthPanel"
    />

    <Transition name="song-detail">
      <section v-if="showSongDetail" class="song-detail" :style="songDetailThemeStyle" aria-label="歌曲详情">
        <header class="song-detail-header">
          <button type="button" title="返回音乐库" aria-label="返回音乐库" @click="closeSongDetail"><span class="song-detail-back-icon" aria-hidden="true"></span></button>
        </header>

        <div class="song-detail-content">
          <div class="song-detail-cover" :style="{ background: `linear-gradient(135deg, ${currentTrack.primary}, ${currentTrack.secondary})` }">
            <img v-if="currentCoverUrl" :src="currentCoverUrl" :alt="`${currentTrack.title}封面`" @error="handleCurrentCoverError" />
            <span v-else aria-hidden="true">{{ currentTrack.mark }}</span>
          </div>

          <div class="song-detail-lyrics-pane">
            <div class="song-detail-song-header">
              <div class="song-detail-title-row">
                <h2 class="song-detail-title">{{ currentTrack.title }}</h2>
                <button
                  v-if="currentTrack.source === 'local' && currentTrack.id !== DEFAULT_TRACK_ID"
                  class="local-lyrics-match-button"
                  type="button"
                  :disabled="localLyricsMatchPending || !localLyricsOnlineMatchEnabled"
                  :title="!localLyricsOnlineMatchEnabled ? '请先开启网络搜索' : undefined"
                  @click="matchLocalLyrics(currentTrack)"
                >
                  <Search :size="15" aria-hidden="true" />
                  {{ localLyricsMatchPending ? "匹配中" : "重新匹配歌词" }}
                </button>
              </div>
              <div class="song-detail-track-meta">
                <span class="song-detail-artist" :aria-label="`歌手：${currentTrack.artist}`">
                  <span
                    v-for="(character, characterIndex) in songInfoCharacters(currentTrack.artist)"
                    :key="`artist-${characterIndex}`"
                    class="song-info-character"
                  >{{ character }}</span>
                </span>
                <span v-if="currentTrack.album" class="song-detail-album" :aria-label="`专辑：${currentTrack.album}`">
                  <span class="song-detail-meta-label">专辑：</span>
                  <span
                    v-for="(character, characterIndex) in songInfoCharacters(currentTrack.album)"
                    :key="`album-${characterIndex}`"
                    class="song-info-character"
                  >{{ character }}</span>
                </span>
              </div>
              <p v-if="currentTrack.source === 'local' && localLyricsMatchNotice" class="local-lyrics-match-notice">
                {{ localLyricsMatchNotice }}
              </p>
            </div>

            <section
            ref="detailLyricsRef"
            class="song-detail-lyrics"
            :class="{ 'is-dragging': lyricsDragging }"
            @scroll="handleLyricScroll"
            @wheel.stop="handleLyricsManualScroll"
            @touchmove.stop="handleLyricsManualScroll"
            @pointerdown="handleLyricPointerDown"
            @pointermove="handleLyricPointerMove"
            @pointerup="handleLyricPointerEnd"
            @pointercancel="handleLyricPointerEnd"
          >
            <div
              v-if="localLyricsMatchPending && currentTrack.source === 'local' && !currentTrack.lyrics?.trim()"
              class="song-detail-lyrics-loading"
              role="status"
            >
              正在准备歌词…
            </div>
            <template v-else>
            <div v-if="anchorPlaybackTime !== undefined && lyricAnchorVisible" class="lyric-anchor-controls">
              <button
                class="lyric-seek-button"
                type="button"
                :title="`从 ${formatLyricTime(anchorPlaybackTime)} 开始播放`"
                :aria-label="`从 ${formatLyricTime(anchorPlaybackTime)} 开始播放`"
                @pointerdown.stop
                @click.stop="playFromTime(anchorPlaybackTime)"
              >
                <span class="lyric-seek-play-icon" aria-hidden="true"></span>
              </button>
              <span class="lyric-timestamp">{{ formatLyricTime(anchorPlaybackTime) }}</span>
            </div>

            <div
              class="lyric-start-spacer"
              aria-hidden="true"
              :style="{ height: `${lyricStartSpacerHeight}px` }"
            ></div>
            <div class="song-detail-song-info" aria-label="前奏歌曲信息">
              <p class="song-detail-preface-track" data-song-info-line>
                <span
                  v-for="(character, characterIndex) in songInfoCharacters(preludeTrackText)"
                  :key="`preface-track-${characterIndex}`"
                  class="song-info-character"
                >{{ character }}</span>
              </p>
              <div v-if="currentLyricCredits.length > 0" class="song-detail-credits" aria-label="歌曲制作信息">
                <p v-for="credit in currentLyricCredits" :key="`${credit.label}-${credit.value}`" class="song-detail-credit" data-song-info-line>
                  <strong>
                    <span
                      v-for="(character, characterIndex) in songInfoCharacters(`${credit.label}：`)"
                      :key="`credit-label-${characterIndex}`"
                      class="song-info-character"
                    >{{ character }}</span>
                  </strong>
                  <span class="song-detail-credit-value">
                    <span
                      v-for="(character, characterIndex) in songInfoCharacters(credit.value)"
                      :key="`credit-value-${characterIndex}`"
                      class="song-info-character"
                    >{{ character }}</span>
                  </span>
                </p>
              </div>
            </div>

            <div v-if="lyricLines.length > 0" class="song-detail-lyrics-list">
              <p
                v-for="(line, index) in lyricLines"
                :key="`${line.time}-${index}`"
                :data-lyric-index="index"
                class="lyric-line"
                :class="{
                  'is-active': index === activeLyricIndex,
                  'is-word-timed': Boolean(line.characters?.length),
                  'has-translation': Boolean(line.translation?.trim()),
                  'is-outside-focus': isLyricLineOutsideFocus(index)
                }"
              >
                <span class="lyric-line-content">
                  <span class="lyric-original">
                    <span
                      v-for="(character, characterIndex) in lyricCharacters(line)"
                      :key="`${line.time}-${characterIndex}`"
                      class="lyric-character"
                      :class="{ 'is-leading-quote': characterIndex === 0 && Boolean(getLeadingLyricQuote(line.text)) }"
                      :data-character="character"
                    >{{ character }}</span>
                  </span>
                  <span v-if="line.translation" class="song-detail-translation"><span v-if="getLeadingLyricQuote(line.translation)" class="is-leading-quote">{{ getLeadingLyricQuote(line.translation) }}</span>{{ getLeadingLyricQuote(line.translation) ? line.translation.slice(1) : line.translation }}</span>
                </span>
              </p>
              <div
                class="lyric-end-spacer"
                aria-hidden="true"
                :style="{ height: `${lyricEndSpacerHeight}px` }"
              ></div>
            </div>
            <div v-else class="song-detail-lyrics-empty">暂无歌词</div>
            </template>
            </section>
          </div>
        </div>

      </section>
    </Transition>

    <Teleport to="body">
      <div
        v-if="duplicateFinderVisible"
        class="duplicate-finder-backdrop"
        @click.self="closeDuplicateFinder"
      >
        <section class="duplicate-finder-dialog" role="dialog" aria-modal="true" aria-labelledby="duplicate-finder-title">
          <header class="duplicate-finder-header">
            <div>
              <span>LOCAL LIBRARY</span>
              <h2 id="duplicate-finder-title">查找重复歌曲</h2>
              <p>按歌名和歌手列出疑似重复记录。所有操作只修改音乐库，不会删除磁盘文件。</p>
            </div>
            <button type="button" title="关闭" aria-label="关闭重复歌曲管理" :disabled="duplicateRemovalPending" @click="closeDuplicateFinder">
              <X :size="18" aria-hidden="true" />
            </button>
          </header>

          <div v-if="localDuplicateGroups.length > 0" class="duplicate-finder-groups">
            <article v-for="group in localDuplicateGroups" :key="group.key" class="duplicate-finder-group">
              <header>
                <div>
                  <h3>{{ group.title }}</h3>
                  <p>{{ group.artist }}</p>
                </div>
                <span>{{ group.tracks.length }} 条记录</span>
              </header>
              <div class="duplicate-finder-list">
                <div v-for="track in group.tracks" :key="track.id" class="duplicate-finder-track">
                  <label class="duplicate-finder-check">
                    <input
                      type="checkbox"
                      :checked="selectedDuplicateTrackIds.has(track.id)"
                      :aria-label="`选择 ${track.title}，${track.filePath || '未知路径'}`"
                      @change="toggleDuplicateTrackSelection(track.id)"
                    />
                    <span aria-hidden="true"></span>
                  </label>
                  <div class="duplicate-finder-track-copy">
                    <strong>{{ track.album || "未知专辑" }}</strong>
                    <span>{{ track.filePath || "未知文件路径" }}</span>
                    <small>{{ localTrackAudioInfo(track) }} · {{ formatLyricTime(track.duration) }}</small>
                  </div>
                  <button type="button" :disabled="duplicateRemovalPending" @click="keepOnlyDuplicateTrack(group, track.id)">保留本条</button>
                </div>
              </div>
            </article>
          </div>
          <div v-else class="duplicate-finder-empty">
            <strong>没有发现疑似重复歌曲</strong>
            <span>不同路径的歌曲会继续保留，只有你手动选择后才会从音乐库移除记录。</span>
          </div>

          <footer class="duplicate-finder-footer">
            <span>已忽略 {{ ignoredLocalFiles.length }} 条 · 已选择 {{ selectedDuplicateTrackIds.size }} 条</span>
            <div>
              <button type="button" :disabled="duplicateRemovalPending" @click="closeDuplicateFinder">全部保留</button>
              <button
                class="primary"
                type="button"
                :disabled="duplicateRemovalPending || selectedDuplicateTrackIds.size === 0"
                @click="removeSelectedDuplicateTracks"
              >
                从音乐库移除所选
              </button>
            </div>
          </footer>
        </section>
      </div>
    </Teleport>

    <Transition name="queue-panel">
      <aside v-if="queuePanelVisible" class="queue-panel" aria-label="播放列表">
        <header class="queue-panel-header">
          <div class="queue-panel-title">
            <div class="queue-title-row">
              <h2>播放列表</h2>
              <span class="queue-count-badge"><b>{{ playbackQueue.length }}</b>首</span>
            </div>
            <p>正在播放第{{ currentQueueDisplayIndex }}首·共{{ formatQueueTotalDuration(playbackQueue) }}</p>
          </div>
          <div class="queue-panel-actions">
            <button class="queue-locate-button" type="button" :disabled="playbackQueue.length === 0" @click="locateCurrentQueueTrack"><span class="queue-action-icon queue-locate-icon" aria-hidden="true"></span>定位</button>
            <button class="queue-clear-button" type="button" :disabled="playbackQueue.length === 0" @click="clearPlaybackQueue"><span class="queue-action-icon queue-trash-icon" aria-hidden="true"></span>清空</button>
          </div>
        </header>
        <div v-if="playbackQueue.length > 0" class="queue-list">
          <div
            v-for="(track, index) in playbackQueue"
            :key="queueTrackKey(track, index)"
            class="queue-track"
            :class="{ active: isCurrentQueueTrack(track), 'is-paused': isCurrentQueueTrack(track) && !isPlaying }"
            @dragover.prevent
            @drop.prevent="dropQueueTrack(track)"
          >
            <button class="queue-track-main" type="button" @click="playQueueTrack(track)">
              <span class="queue-row-leading">
                <span class="queue-drag-handle" draggable="true" aria-hidden="true" @click.stop @dragstart.stop="startQueueDrag(track)" @dragend.stop="finishQueueDrag"><i></i><i></i><i></i></span>
                <span v-if="isCurrentQueueTrack(track)" class="queue-wave-indicator" aria-label="正在播放">
                  <i></i><i></i><i></i>
                </span>
                <span v-else class="queue-index">{{ index + 1 }}</span>
              </span>
              <span class="queue-cover" :style="{ background: `linear-gradient(135deg, ${track.primary}, ${track.secondary})` }">
                <img v-if="track.coverUrl && !failedCoverIds.has(trackCoverKey(track))" :src="resolveBackendUrl(track.coverUrl)" :alt="`${track.title}封面`" @error="handleTrackCoverError($event, track)" />
                <span v-else aria-hidden="true">{{ track.mark }}</span>
              </span>
              <span class="queue-track-copy">
                <strong>{{ track.title }}</strong>
                <span>{{ track.artist }}</span>
              </span>
            </button>
            <div v-if="isCurrentQueueTrack(track)" class="queue-current-actions" aria-label="当前歌曲操作">
              <button class="queue-card-next" type="button" title="下一首" aria-label="下一首" @click.stop="nextTrack"><span class="queue-card-next-icon" aria-hidden="true"></span></button>
              <button class="queue-card-add" type="button" title="添加" aria-label="添加" @click.stop="appendQueueTrackToEnd(track)"><span aria-hidden="true">+</span></button>
              <button class="queue-card-more" type="button" title="更多" aria-label="更多" @click.stop="scanNotice = `后续会展开「${track.title}」的更多操作。`"><span aria-hidden="true">≡</span></button>
              <button class="queue-card-delete" type="button" title="删除" aria-label="删除" @click.stop="removeQueueTrack(queueTrackKey(track, index))"><span aria-hidden="true">×</span></button>
            </div>
          </div>
        </div>
        <div v-else class="queue-empty">队列是空的，播放一首歌后会显示在这里。</div>
      </aside>
    </Transition>
  </div>

  <MiniPlayer
    v-if="miniPlayerVisible && !nativeMiniMode"
    :track="currentTrack"
    :queue="playbackQueue"
    :queue-open="miniQueueVisible"
    :queue-shell-open="miniQueueShellOpen"
    :playlists="playlistOverviewSource"
    :cover-url="currentCoverUrl"
    :is-playing="isPlaying"
    :progress="progress"
    :lyric="currentLyricText"
    :lyric-lines="lyricLines"
    :source="currentTrack.source"
    :lyrics-format="currentTrack.lyricsFormat"
    :lyrics-source="currentTrack.lyricsSource"
    :theme-style="songDetailThemeStyle"
    :native-window="nativeMiniMode"
    :preferences="appearancePreferences.miniPlayer"
    :volume="volume"
    :play-mode="playMode"
    :current-time="currentTime"
    :duration="playbackDuration"
    @toggle="togglePlayback"
    @previous="previousTrack"
    @next="nextTrack"
    @like="toggleLiked"
    @volume="updateVolume"
    @mode="cyclePlayerBarPlayMode"
    @queue="toggleMiniQueue"
    @queue-dismiss="dismissMiniQueue"
    @queue-transition-end="handleMiniQueueTransitionEnd"
    @queue-track-play="playQueueTrack"
    @queue-track-like="toggleTrackLiked"
    @queue-track-remove="removeQueueTrack"
    @queue-track-add-playlist="addMiniQueueTrackToPlaylist"
    @queue-track-create-playlist="createMiniPlaylistWithTrack"
    @queue-track-copy="copyMiniQueueTrackInfo"
    @close="closeMiniPlayer"
  />

  <Teleport to="body">
    <div
      v-if="localTrackContextMenu"
      class="local-track-context-menu-layer"
      @pointerdown.self="closeLocalTrackContextMenu"
      @contextmenu.prevent.self="closeLocalTrackContextMenu"
    >
      <div
        class="local-track-context-menu"
        :style="{ left: `${localTrackContextMenu.x}px`, top: `${localTrackContextMenu.y}px` }"
        role="menu"
        @pointerdown.stop
      >
        <button type="button" role="menuitem" @click="playContextMenuTrack">
          <Play :size="17" aria-hidden="true" />
          <span>播放</span>
        </button>
        <button type="button" role="menuitem" @click="playContextMenuTrackNext">
          <ListEnd :size="17" aria-hidden="true" />
          <span>下一首播放</span>
        </button>
        <div class="local-track-context-menu-separator" aria-hidden="true"></div>
        <button
          type="button"
          role="menuitem"
          :class="{ 'is-active': localTrackContextMenu.track.liked }"
          @click="toggleContextMenuTrackFavorite"
        >
          <Heart :size="17" :fill="localTrackContextMenu.track.liked ? 'currentColor' : 'none'" aria-hidden="true" />
          <span>{{ localTrackContextMenu.track.liked ? "取消喜欢" : "喜欢" }}</span>
        </button>
        <button type="button" role="menuitem" @click="openTrackPlaylistPicker(localTrackContextMenu.track, 'regular')">
          <ListMusic :size="17" aria-hidden="true" />
          <span>添加到歌单</span>
          <ChevronRight class="local-track-context-menu-chevron" :size="15" aria-hidden="true" />
        </button>
        <button type="button" role="menuitem" @click="openTrackPlaylistPicker(localTrackContextMenu.track, 'aggregate')">
          <Network :size="17" aria-hidden="true" />
          <span>添加到聚合歌单</span>
          <ChevronRight class="local-track-context-menu-chevron" :size="15" aria-hidden="true" />
        </button>
        <template v-if="localTrackContextMenu.track.filePath">
          <div class="local-track-context-menu-separator" aria-hidden="true"></div>
          <button type="button" role="menuitem" @click="showLocalTrackFileHint(localTrackContextMenu.track)">
            <FolderOpen :size="17" aria-hidden="true" />
            <span>查看文件位置</span>
          </button>
        </template>
      </div>
    </div>
  </Teleport>
</template>

<!--suppress CssUnusedSymbol -->
<style>
:root {
  --app-page-background: #f4f4f6;
  --app-card-background: #fff;
  --app-card-shadow: 0 16px 38px rgba(31, 37, 47, .07);
  --app-playing-background: #f7f3ea;
  --app-page-transition-duration: 250ms;
  --app-page-transition-easing: ease-out;
  color-scheme: light;
  font-family: Inter, "SF Pro Display", "Microsoft YaHei", "PingFang SC", sans-serif;
  font-synthesis: none;
  text-rendering: optimizeLegibility;
}

* { box-sizing: border-box; }
html, body, #app { width: 100%; height: 100%; min-width: 320px; min-height: 0; margin: 0; }
body { overflow: hidden; background: var(--app-page-background); }
button, input { font: inherit; }
button:focus-visible, input:focus-visible { outline: 2px solid #20d57a; outline-offset: 2px; }

.onboarding-shell-enter-active,
.onboarding-shell-leave-active { transition: opacity 440ms cubic-bezier(.22,.72,.28,1), transform 440ms cubic-bezier(.22,.72,.28,1), filter 440ms cubic-bezier(.22,.72,.28,1); }
.onboarding-shell-enter-from { opacity: 0; transform: scale(1.012); filter: blur(6px); }
.onboarding-shell-leave-to { opacity: 0; transform: scale(.992); filter: blur(7px); }
.onboarding-shell-immediate-leave-active { transition: none !important; }
.onboarding-shell-immediate-leave-to { opacity: 0; }

.app-shell { display: grid; width: 100%; max-width: 100%; height: 100vh; min-height: 0; grid-template-columns: 224px minmax(0, 1fr); overflow: hidden; background: var(--app-page-background); color: #24292a; transition: grid-template-columns 250ms ease-out; }
.app-shell.is-onboarding-active { pointer-events: none; user-select: none; }
.app-shell.is-sidebar-collapsed { grid-template-columns: 0 minmax(0, 1fr); }
.sidebar-slot { min-width: 0; min-height: 0; overflow: hidden; opacity: 1; transition: opacity 250ms ease-out; }
.app-shell.is-sidebar-collapsed .sidebar-slot { opacity: 0; }
.shell-controls { position: fixed; top: 22px; left: 16px; z-index: 80; display: flex; align-items: center; gap: 8px; }
.shell-control-button { display: grid; width: 32px; height: 32px; flex: 0 0 auto; place-items: center; border: 0; border-radius: 9px; background: transparent; color: #8c9698; cursor: pointer; font-size: 17px; line-height: 1; transition: background 160ms ease,color 160ms ease; }
.shell-control-button:hover { background: #e6eaea; color: #202628; }
.shell-control-button.active { background: #e1e7e7; color: #202628; }
.shell-control-button span { display: block; line-height: 1; }
.account-menu-anchor { position: relative; display: grid; width: 32px; height: 32px; }
.shell-control-button.is-settings-back { background: #eaf1ff; color: #0f3f92; }
.shell-control-button.is-settings-back:hover { background: #dce9ff; color: #0b3478; }
.settings-back-icon { position: relative; width: 18px; height: 18px; }
.settings-back-icon::before { position: absolute; top: 50%; left: 3px; width: 12px; height: 12px; border-bottom: 2px solid currentColor; border-left: 2px solid currentColor; content: ""; transform: translateY(-50%) rotate(45deg); }
.settings-back-icon::after { position: absolute; top: 50%; left: 4px; width: 14px; height: 2px; border-radius: 999px; background: currentColor; content: ""; transform: translateY(-50%); }
.workspace { position: relative; display: grid; width: 100%; max-width: 100%; min-width: 0; height: 100vh; min-height: 0; grid-template-rows: minmax(0, 1fr); overflow: hidden; background: var(--app-page-background); }
.workspace.is-settings-workspace { grid-template-rows: minmax(0, 1fr); }
.page-transition-frame { min-width: 0; min-height: 100%; }
.app-page-enter-active,
.app-page-leave-active,
.app-page-slide-forward-enter-active,
.app-page-slide-forward-leave-active,
.app-page-slide-backward-enter-active,
.app-page-slide-backward-leave-active {
  transition:
    opacity var(--app-page-transition-duration) var(--app-page-transition-easing),
    transform var(--app-page-transition-duration) var(--app-page-transition-easing);
  will-change: opacity, transform;
}
.app-page-leave-active,
.app-page-slide-forward-leave-active,
.app-page-slide-backward-leave-active { pointer-events: none; }
.app-page-enter-from { opacity: 0; transform: translate3d(0, 8px, 0); }
.app-page-leave-to { opacity: 0; transform: translate3d(0, -4px, 0); }
.app-page-slide-forward-enter-from { opacity: 0; transform: translate3d(30px, 0, 0); }
.app-page-slide-forward-leave-to { opacity: 0; transform: translate3d(-30px, 0, 0); }
.app-page-slide-backward-enter-from { opacity: 0; transform: translate3d(-30px, 0, 0); }
.app-page-slide-backward-leave-to { opacity: 0; transform: translate3d(30px, 0, 0); }
.settings-sidebar {
  display: grid;
  height: 100%;
  align-content: start;
  gap: 18px;
  padding: 80px 14px 18px;
  background: #f0f2f6;
}
.settings-sidebar-search {
  display: grid;
  min-height: 40px;
  grid-template-columns: 18px minmax(0, 1fr);
  align-items: center;
  gap: 8px;
  border: 1px solid #dde4ec;
  border-radius: 18px;
  padding: 0 12px;
  background: #eef2f7;
  color: #8b96a5;
}
.settings-sidebar-search input {
  width: 100%;
  min-width: 0;
  border: 0;
  outline: 0;
  background: transparent;
  color: #11192b;
  font-size: 13px;
}
.settings-sidebar-search input::placeholder { color: #9aa5b4; }
.settings-sidebar-nav {
  display: grid;
  gap: 7px;
}
.settings-sidebar-nav button {
  position: relative;
  display: grid;
  min-height: 46px;
  grid-template-columns: 22px minmax(0, 1fr);
  align-items: center;
  gap: 10px;
  border: 0;
  border-radius: 12px;
  padding: 0 14px;
  background: transparent;
  color: #687485;
  cursor: pointer;
  text-align: left;
  transition: background 180ms ease, color 180ms ease, box-shadow 180ms ease;
}
.settings-sidebar-nav button:hover {
  background: rgba(255,255,255,.62);
  color: #10182b;
}
.settings-sidebar-nav button.active {
  background: #fff;
  color: #10182b;
  box-shadow: 0 12px 24px rgba(24,31,45,.06);
}
.settings-sidebar-nav button.active::before {
  position: absolute;
  top: 13px;
  left: 0;
  width: 3px;
  height: 20px;
  border-radius: 999px;
  background: #1769ff;
  content: "";
}
.settings-sidebar-nav span {
  display: grid;
  place-items: center;
  color: #8a94a3;
  font-size: 15px;
}
.settings-sidebar-nav strong {
  overflow: hidden;
  font-size: 14px;
  font-weight: 800;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.page-heading.streaming-home-heading,
.streaming-home-page { width: min(1420px, 100%); margin-inline: auto; }
.page-heading.streaming-home-heading { margin-top: 88px; }
.page-heading.is-library-heading,
.page-heading.is-cloud-heading {
  width: min(1420px, calc(100% - 112px));
  align-items: center;
  margin: 88px auto 16px;
  padding-bottom: 18px;
  border-bottom: 1px solid rgba(190, 195, 204, .34);
}
.page-heading.is-library-heading .eyebrow,
.page-heading.is-library-heading .page-subtitle,
.page-heading.is-cloud-heading .eyebrow,
.page-heading.is-cloud-heading .page-subtitle { display: none; }
.page-heading.is-library-heading h1,
.page-heading.is-cloud-heading h1 {
  margin: 0;
  color: #25272b;
  font-size: 27px;
  font-weight: 700;
  letter-spacing: 0;
}
.page-heading.is-library-heading .streaming-home-tools,
.page-heading.is-cloud-heading .streaming-home-tools {
  width: min(360px, 42vw);
  align-self: center;
}
.page-heading.is-library-heading .streaming-home-search,
.page-heading.is-cloud-heading .streaming-home-search {
  height: 38px;
  border-color: rgba(208, 212, 219, .72);
  border-radius: 19px;
  background: rgba(255, 255, 255, .72);
  box-shadow: none;
}
.page-heading.is-library-heading .streaming-home-search.is-focused,
.page-heading.is-cloud-heading .streaming-home-search.is-focused {
  background: rgba(255, 255, 255, .92);
  box-shadow: 0 0 0 2px rgba(232, 107, 63, .07);
}
.page-heading.is-library-subpage-heading {
  width: min(1420px, calc(100% - 112px));
  margin: 88px auto 24px;
}
.daily-detail-page.is-library-detail-page {
  padding-top: 88px;
}
@media (max-width: 980px) {
  .page-heading.is-library-heading,
  .page-heading.is-cloud-heading,
  .page-heading.is-library-subpage-heading { width: calc(100% - 40px); }
}
@media (max-width: 620px) {
  .page-heading.is-library-heading,
  .page-heading.is-cloud-heading,
  .page-heading.is-library-subpage-heading { width: 100%; }
}
.page-heading.is-discovery-heading {
  width: min(1420px, 100%);
  align-items: center;
  margin: 4px auto 14px;
  padding-bottom: 16px;
  border-bottom: 1px solid rgba(183, 190, 200, .42);
  transition: margin-top 250ms ease-out;
}
.page-heading.is-discovery-heading .eyebrow,
.page-heading.is-discovery-heading .page-subtitle { display: none; }
.page-heading.is-discovery-heading.is-qq-discovery-heading .page-subtitle { display: block; margin-top: 4px; }
.page-heading.is-discovery-heading h1 { margin: 0; font-size: 28px; letter-spacing: 0; }
.page-heading.is-discovery-heading .streaming-home-tools { align-self: center; }
.app-shell.is-sidebar-collapsed .page-heading.is-discovery-heading { margin-top: 72px; }
.page-heading.is-search-heading { width: min(1420px,100%); align-items: center; margin: 72px auto 14px; padding: 0 0 14px; border-bottom: 1px solid #dde2e7; }
.page-heading.is-search-heading h1 { margin: 0; color: #171c25; font-size: 23px; letter-spacing: 0; }
.page-heading.is-search-heading .streaming-home-tools { width: min(360px, 44vw); align-self: center; }
.main-scroll { --surface-gutter: 42px; width: 100%; min-width: 0; min-height: 0; overflow: auto; overflow-x: hidden; padding: 14px var(--surface-gutter) 125px; background: var(--app-page-background); }.page-heading,.section-heading { display: flex; align-items: flex-end; justify-content: space-between; gap: 20px; }.page-heading { margin: 8px 0 24px; }.eyebrow { margin: 0 0 9px; color: #b1b6b7; font-size: 9px; font-weight: 800; letter-spacing: 2px; } h1,h2,p { margin-top: 0; }.page-heading h1 { margin-bottom: 7px; color: #222a2b; font-size: clamp(24px,3vw,34px); letter-spacing: -.6px; }.page-subtitle { margin-bottom: 0; color: #9da4a6; font-size: 12px; }
.page-heading .search-eyebrow { display: flex; align-items: center; gap: 7px; margin: 0 0 5px; color: #d9472f; font-size: 10px; letter-spacing: 0; }
.page-heading .search-eyebrow::before { width: 15px; height: 2px; flex: 0 0 15px; background: currentColor; content: ""; }
.main-scroll { scrollbar-width: thin; scrollbar-color: rgba(112, 122, 132, .24) transparent; }
.main-scroll::-webkit-scrollbar { width: 7px; height: 7px; }
.main-scroll::-webkit-scrollbar-track { background: transparent; }
.main-scroll::-webkit-scrollbar-thumb {
  border: 2px solid transparent;
  border-radius: 999px;
  background: rgba(112, 122, 132, .24);
  background-clip: content-box;
}
.main-scroll:hover::-webkit-scrollbar-thumb { background-color: rgba(112, 122, 132, .36); }
.main-scroll::-webkit-scrollbar-button { display: none; width: 0; height: 0; }
.workspace.is-settings-workspace .main-scroll { padding: 0; }
.page-actions { display: flex; align-items: center; gap: 10px; }.report-link,.text-button { display: inline-flex; align-items: center; gap: 8px; border: 0; background: transparent; color: #8e9899; cursor: pointer; font-size: 11px; }.report-link { padding: 8px 11px; border: 1px solid #dfe5e2; border-radius: 8px; }.report-link.primary { border-color: #20d57a; background: #20d57a; color: #fff; }.report-link:hover,.text-button:hover { color: #1e2728; }.report-link.primary:hover { color: #fff; background: #16c76d; }
.library-toolbar { display: flex; align-items: center; gap: 12px; margin: -7px 0 25px; }.folder-input { display: flex; min-width: min(520px, 62vw); align-items: center; gap: 8px; padding: 9px 12px; border: 1px solid #e3e8e5; border-radius: 9px; background: #fff; color: #9ba4a1; }.folder-input input { width: 100%; min-width: 0; border: 0; outline: 0; background: transparent; color: #56615d; font-size: 11px; }.scan-message { color: #659277; font-size: 11px; }.scan-message.error { color: #c46b6b; }.online-search-state { display: flex; align-items: center; justify-content: center; gap: 12px; padding: 28px 10px; border-top: 1px solid #e6e9e9; color: #73958a; font-size: 12px; text-align: center; }.online-search-state.error { color: #bd7272; }.online-search-state button { border: 1px solid #d8e5df; border-radius: 7px; padding: 6px 10px; background: #fff; color: #54846c; cursor: pointer; font-size: 11px; }.online-search-state button:hover { border-color: #20d57a; color: #168b5c; }
.local-library-page { display: grid; gap: 32px; color: #11192b; }
.local-library-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 28px; padding: 20px 14px 0; }
.local-library-title { display: grid; gap: 23px; }
.local-library-title h1 { margin: 0; color: #10182b; font-size: 36px; font-weight: 900; letter-spacing: -.7px; }
.local-library-primary-actions { display: flex; align-items: center; gap: 10px; }
.local-library-primary-actions button,.local-tool-trigger,.local-tool-popover button { display: inline-flex; align-items: center; gap: 8px; border: 1px solid #d8dee4; border-radius: 999px; background: rgba(255,255,255,.72); color: #223044; cursor: pointer; font-size: 12px; font-weight: 700; }
.local-library-primary-actions button { height: 36px; padding: 0 17px; }
.local-library-primary-actions button:hover,.local-tool-trigger:hover,.local-tool-trigger[aria-expanded="true"] { border-color: #cbd4df; background: #fff; color: #8f3032; }
.local-library-tools { display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-end; gap: 14px; padding-top: 16px; }
.local-tool-menu { position: relative; }
.local-tool-trigger { height: 36px; padding: 0 15px; box-shadow: 0 12px 28px rgba(35,45,58,.06); }
.local-tool-trigger span { transition: transform 160ms ease; }
.local-tool-trigger span.open { transform: rotate(180deg); }
.local-tool-popover { position: absolute; top: calc(100% + 8px); left: 0; z-index: 30; display: grid; gap: 3px; padding: 8px; border: 1px solid #e4e8ec; border-radius: 12px; background: rgba(255,255,255,.98); box-shadow: 0 18px 40px rgba(28,39,55,.14); }
.local-tool-menu-library .local-tool-popover { width: 230px; }
.local-tool-menu-filter .local-tool-popover { right: auto; left: 0; width: 230px; }
.local-tool-popover button { width: 100%; min-height: 36px; justify-content: flex-start; border: 0; border-radius: 8px; padding: 8px 11px; background: transparent; box-shadow: none; line-height: 1.35; white-space: nowrap; }
.local-tool-popover button:hover:not(:disabled) { background: #f4f6f8; color: #8f3032; }
.local-tool-popover button:disabled { cursor: default; opacity: .45; }
.local-network-toggle { display: inline-flex; align-items: center; gap: 8px; color: #1d2636; font-size: 12px; font-weight: 800; }
.local-network-toggle input { position: absolute; opacity: 0; pointer-events: none; }
.local-network-toggle i { position: relative; width: 30px; height: 16px; border-radius: 999px; background: #c9ced4; box-shadow: inset 0 0 0 1px rgba(0,0,0,.08); transition: background 160ms ease; }
.local-network-toggle i::after { position: absolute; top: 2px; left: 2px; width: 12px; height: 12px; border-radius: 50%; background: #fff; box-shadow: 0 1px 4px rgba(21,30,44,.16); content: ""; transition: transform 160ms ease; }
.local-network-toggle input:checked + i { background: #8f3032; }
.local-network-toggle input:checked + i::after { transform: translateX(14px); }
.local-library-search { display: flex; width: min(370px, 30vw); height: 38px; align-items: center; gap: 10px; padding: 0 15px; border: 1px solid #e8ebef; border-radius: 999px; background: rgba(255,255,255,.78); color: #a8b0ba; box-shadow: 0 18px 40px rgba(36,47,64,.07); }
.local-library-search input { width: 100%; min-width: 0; border: 0; outline: 0; background: transparent; color: #253044; font-size: 12px; }
.local-library-search input::placeholder { color: #b0b7c0; }
.local-library-notice { margin: -12px 14px 0; color: #6b8792; font-size: 12px; }
.local-library-notice.error { color: #b45f62; }
.local-library-table { display: grid; gap: 0; overflow: hidden; border: 1px solid #e6e7ea; border-radius: 14px; padding: 0 0 18px; background: var(--app-card-background); box-shadow: var(--app-card-shadow); }
.local-library-table-header,.local-library-row { display: grid; grid-template-columns: 50px minmax(320px, 1.65fr) minmax(190px, .9fr) 110px; align-items: center; gap: 18px; }
.local-library-table-header { padding: 10px 40px 14px 14px; border-bottom: 1px solid rgba(166,174,186,.24); color: #7e8a9b; font-size: 11px; font-weight: 800; }
.local-library-table-header span:nth-child(1) { text-align: center; }
.local-library-table-header span:nth-child(2) { padding-left: 58px; }
.local-library-table-header span:nth-child(3),.local-library-table-header span:nth-child(4) { text-align: left; }
.local-library-table-body { display: grid; gap: 8px; padding-top: 8px; }
.local-library-row { min-height: 64px; border: 1px solid transparent; border-radius: 9px; padding: 9px 40px 9px 14px; background: var(--app-card-background); cursor: pointer; transition: background 160ms ease, border-color 160ms ease, box-shadow 160ms ease; }
.local-library-row:hover { background: rgba(255,255,255,.64); border-color: rgba(214,220,227,.8); }
.local-library-row.active { border-color: rgba(153,126,76,.16); background: var(--app-playing-background); box-shadow: 0 10px 24px rgba(96,79,48,.07); }
.local-library-row.selected { border-color: rgba(143,48,50,.32); }
.local-library-index { display: flex; align-items: center; justify-content: center; }
.track-playback-indicator { display: grid; width: 36px; height: 36px; place-items: center; border-radius: 50%; background: #148f80; color: #fff; box-shadow: 0 7px 16px rgba(20,143,128,.2); }
.track-playback-bars { display: flex; height: 15px; align-items: center; justify-content: center; gap: 3px; }
.track-playback-bars i { width: 2px; height: 11px; border-radius: 999px; background: currentColor; animation: track-playback-pulse 720ms ease-in-out infinite alternate; transform-origin: center; }
.track-playback-bars i:nth-child(2) { height: 7px; animation-delay: -480ms; }
.track-playback-bars i:nth-child(3) { height: 13px; animation-delay: -240ms; }
@keyframes track-playback-pulse { from { transform: scaleY(.42); } to { transform: scaleY(1); } }
.local-library-select { display: grid; width: 24px; height: 24px; place-items: center; border: 0; border-radius: 50%; background: transparent; color: #8b96a6; cursor: pointer; font-size: 12px; }
.local-library-row.active .local-library-select { color: #1f6cff; }
.local-library-select:hover { background: rgba(31,108,255,.08); color: #1f6cff; }
.local-library-track-title { display: flex; min-width: 0; align-items: center; gap: 16px; }
.local-library-cover { display: grid; width: 42px; height: 42px; flex: 0 0 auto; place-items: center; overflow: hidden; border-radius: 8px; color: rgba(255,255,255,.92); font-size: 15px; font-weight: 900; box-shadow: 0 12px 25px rgba(28,38,52,.08); }
.local-library-cover img { width: 100%; height: 100%; object-fit: cover; }
.local-library-track-copy { display: grid; min-width: 0; gap: 5px; }
.local-library-track-copy strong,.local-library-track-copy small,.local-library-album,.local-library-duration small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.local-library-track-copy strong { color: #10182b; font-size: 13px; font-weight: 900; }
.local-library-track-copy small { color: #7f8aa0; font-size: 12px; font-weight: 600; }
.local-library-track-name { display: flex; min-width: 0; align-items: center; gap: 8px; }
.local-library-track-name strong { min-width: 0; }
.local-library-track-name .local-duplicate-badge { flex: 0 0 auto; overflow: visible; border: 1px solid rgba(174, 91, 75, .2); border-radius: 999px; padding: 2px 6px; background: rgba(174, 91, 75, .08); color: #9d4e43; font-size: 9px; font-weight: 800; line-height: 1.2; }
.local-library-album { color: #293449; font-size: 12px; text-align: left; }
.local-library-duration { display: grid; gap: 5px; justify-items: start; color: #24304a; }
.local-library-duration strong { font-size: 13px; font-weight: 800; }
.local-library-duration small { max-width: 120px; color: #9aa4b5; font-size: 10px; }
.local-library-empty { margin: 28px 14px 0; padding: 42px 20px; border: 1px dashed #d9dfe6; border-radius: 18px; color: #8f9aa8; font-size: 13px; text-align: center; }
.recent-history-page { display: grid; gap: 36px; padding: 20px 14px 40px; color: #10182b; }
.recent-history-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 32px; }
.recent-history-heading { display: grid; flex: 0 0 auto; gap: 24px; }
.recent-history-title-row { display: flex; align-items: baseline; gap: 14px; }
.recent-history-title-row h1 { margin: 0; color: #10182b; font-size: 36px; font-weight: 900; letter-spacing: -.7px; }
.recent-history-title-row span { color: #68758b; font-size: 12px; font-weight: 700; }
.recent-history-actions { display: flex; align-items: center; gap: 10px; }
.recent-history-actions button { display: inline-flex; height: 36px; align-items: center; gap: 8px; border: 1px solid #d8dee4; border-radius: 999px; padding: 0 17px; background: rgba(255,255,255,.72); color: #223044; cursor: pointer; font-size: 12px; font-weight: 700; transition: border-color 160ms ease, background 160ms ease, color 160ms ease; }
.recent-history-actions button:hover:not(:disabled) { border-color: #cbd4df; background: #fff; color: #8f3032; }
.recent-history-actions button:disabled { cursor: default; opacity: .45; }
.recent-history-tools { display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-end; gap: 12px; padding-top: 4px; }
.recent-history-source,.recent-history-filter summary { display: inline-flex; height: 40px; align-items: center; gap: 8px; border: 1px solid #e4e8ed; border-radius: 999px; padding: 0 14px; background: rgba(255,255,255,.82); color: #223044; box-shadow: 0 14px 32px rgba(36,47,64,.06); font-size: 12px; font-weight: 800; }
.recent-history-source select { border: 0; outline: 0; background: transparent; color: inherit; cursor: pointer; font: inherit; }
.recent-history-filter { position: relative; }
.recent-history-filter summary { cursor: pointer; list-style: none; }
.recent-history-filter summary::-webkit-details-marker { display: none; }
.recent-history-filter summary:hover,.recent-history-source:hover { border-color: #cbd4df; background: #fff; }
.recent-history-filter-panel { position: absolute; top: calc(100% + 8px); right: 0; z-index: 12; display: grid; min-width: 184px; gap: 12px; padding: 13px; border: 1px solid #e4e8ec; border-radius: 10px; background: rgba(255,255,255,.98); box-shadow: 0 18px 40px rgba(28,39,55,.13); }
.recent-history-filter-panel label { display: grid; gap: 7px; color: #7c8798; font-size: 10px; font-weight: 800; }
.recent-history-filter-panel select { width: 100%; height: 34px; border: 1px solid #dce2e8; border-radius: 7px; padding: 0 9px; outline: 0; background: #fff; color: #263247; font-size: 12px; }
.recent-history-filter-panel button { height: 34px; border: 0; border-radius: 7px; background: #f2f4f7; color: #526075; cursor: pointer; font-size: 11px; font-weight: 800; }
.recent-history-filter-panel button:hover { background: #e9edf2; color: #8f3032; }
.recent-history-search { display: flex; width: min(390px,32vw); height: 40px; align-items: center; gap: 10px; padding: 0 16px; border: 1px solid #eceef1; border-radius: 999px; background: rgba(255,255,255,.82); color: #a8b0ba; box-shadow: 0 18px 40px rgba(36,47,64,.07); }
.recent-history-search input { width: 100%; min-width: 0; border: 0; outline: 0; background: transparent; color: #253044; font-size: 12px; }
.recent-history-search input::placeholder { color: #b0b7c0; }
.recent-history-table { display: grid; overflow: hidden; border: 1px solid #e6e7ea; border-radius: 14px; background: var(--app-card-background); box-shadow: var(--app-card-shadow); }
.recent-history-table-head,.recent-history-row { display: grid; grid-template-columns: 50px minmax(320px,1.65fr) minmax(190px,.9fr) 130px; align-items: center; gap: 18px; }
.recent-history-table-head { padding: 0 56px 14px 14px; border-bottom: 1px solid rgba(166,174,186,.24); color: #7e8a9b; font-size: 11px; font-weight: 800; }
.recent-history-table-head span:nth-child(3) { text-align: left; }
.recent-history-table-head span:nth-child(4) { text-align: right; }
.recent-history-table-head span:nth-child(3),
.recent-history-table-head span:nth-child(4) { color: #66635f; }
.recent-history-list { display: grid; gap: 5px; padding-top: 7px; }
.recent-history-row { min-height: 64px; border: 1px solid transparent; border-radius: 8px; padding: 8px 56px 8px 14px; background: var(--app-card-background); color: inherit; cursor: pointer; text-align: left; transition: background 160ms ease, border-color 160ms ease, box-shadow 160ms ease; }
.recent-history-row:hover { border-color: rgba(214,220,227,.78); background: rgba(255,255,255,.68); box-shadow: 0 10px 24px rgba(42,53,69,.05); }
.recent-history-row.active { border-color: rgba(153,126,76,.15); background: var(--app-playing-background); }
.recent-history-index { color: #8b96a6; font-size: 12px; }
.recent-history-track { display: flex; min-width: 0; align-items: center; gap: 16px; }
.recent-history-cover { display: grid; width: 42px; height: 42px; flex: 0 0 auto; place-items: center; overflow: hidden; border-radius: 8px; color: rgba(255,255,255,.94); font-size: 15px; font-weight: 900; box-shadow: 0 11px 24px rgba(28,38,52,.09); }
.recent-history-cover img { width: 100%; height: 100%; object-fit: cover; }
.recent-history-track-copy { display: grid; min-width: 0; gap: 5px; }
.recent-history-track-copy strong,.recent-history-track-copy small,.recent-history-album,.recent-history-duration small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.recent-history-track-copy strong { color: #10182b; font-size: 13px; font-weight: 900; }
.recent-history-track-copy small { color: #7f8aa0; font-size: 12px; font-weight: 600; }
.recent-history-album { min-height: 36px; color: #5f5d59; font-size: 13px; font-weight: 500; text-align: left; }
.recent-history-duration { display: grid; gap: 5px; justify-items: end; color: #24304a; }
.recent-history-duration strong { color: #5f5d59; font-size: 13px; font-weight: 500; }
.recent-history-duration small { max-width: 130px; color: #9aa4b5; font-size: 10px; }
.recent-history-empty { display: grid; min-height: 210px; place-content: center; justify-items: center; gap: 8px; color: #929cab; text-align: center; }
.recent-history-empty strong { color: #667286; font-size: 14px; }
.recent-history-empty span { font-size: 12px; }
.local-track-context-menu-layer { position: fixed; inset: 0; z-index: 180; }
.local-track-context-menu { position: absolute; display: grid; width: 184px; gap: 2px; padding: 6px; border: 1px solid #e5e7eb; border-radius: 8px; background: rgba(255,255,255,.98); box-shadow: 0 18px 40px rgba(28,39,55,.16); backdrop-filter: blur(16px); }
.local-track-context-menu button { display: grid; grid-template-columns: 20px minmax(0,1fr) auto; min-height: 38px; align-items: center; gap: 8px; border: 0; border-radius: 7px; padding: 8px 9px; background: transparent; color: #344054; cursor: pointer; font-size: 13px; font-weight: 650; text-align: left; }
.local-track-context-menu button:hover,.local-track-context-menu button:focus-visible { outline: 0; background: #f1edff; color: #263653; }
.local-track-context-menu button.is-active { color: #e25163; }
.local-track-context-menu button span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.local-track-context-menu-separator { height: 1px; margin: 4px 7px; background: #eceff3; }
.local-track-context-menu-chevron { color: #99a3b2; }
.local-artists-page,.local-artist-detail { position: relative; display: grid; gap: 30px; padding: 20px 46px 40px 14px; color: #10182b; }
.local-artists-header { display: flex; align-items: center; justify-content: space-between; gap: 26px; }
.local-artists-title { display: flex; align-items: baseline; gap: 14px; }
.local-artists-title h1,.local-artist-detail-copy h1 { margin: 0; color: #10182b; font-size: 36px; font-weight: 900; letter-spacing: -.7px; }
.local-artists-title span { color: #68758b; font-size: 13px; font-weight: 700; }
.local-artists-tools { display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-end; gap: 10px; }
.local-artists-tools select { height: 36px; min-width: 112px; border: 1px solid #d9e0e8; border-radius: 9px; padding: 0 12px; background: rgba(255,255,255,.78); color: #1b2638; font-size: 12px; font-weight: 800; box-shadow: 0 14px 32px rgba(36,47,64,.06); }
.local-artist-search { display: flex; width: min(370px, 30vw); height: 38px; align-items: center; gap: 10px; padding: 0 15px; border: 1px solid #e8ebef; border-radius: 999px; background: rgba(255,255,255,.78); color: #a8b0ba; box-shadow: 0 18px 40px rgba(36,47,64,.07); }
.local-artist-search input { width: 100%; min-width: 0; border: 0; outline: 0; background: transparent; color: #253044; font-size: 12px; }
.local-artist-search input::placeholder { color: #b0b7c0; }
.local-artist-groups { display: grid; gap: 28px; }
.local-artist-group { scroll-margin-top: 24px; }
.local-artist-group h2 { margin: 0 0 12px; color: #9aa5b5; font-size: 12px; font-weight: 900; letter-spacing: 1.6px; }
.local-artist-grid { display: grid; grid-template-columns: repeat(auto-fill, min(188px, 100%)); gap: 22px; }
.local-artist-card { display: grid; gap: 10px; min-width: 0; border: 0; border-radius: 18px; padding: 16px; background: rgba(255,255,255,.58); color: inherit; cursor: pointer; text-align: left; box-shadow: 0 18px 40px rgba(28,39,55,.08); transition: transform 180ms ease, box-shadow 180ms ease, background 180ms ease; }
.local-artist-card:hover { background: rgba(255,255,255,.86); box-shadow: 0 24px 48px rgba(28,39,55,.12); transform: translateY(-2px); }
.local-artist-cover { display: grid; width: 100%; aspect-ratio: 1; place-items: center; overflow: hidden; border-radius: 11px; color: rgba(255,255,255,.92); font-size: 46px; font-weight: 900; box-shadow: 0 18px 34px rgba(34,45,61,.1); transition: transform 180ms ease; }
.local-artist-card:hover .local-artist-cover { transform: translateY(-4px); }
.local-artist-cover img { width: 100%; height: 100%; object-fit: cover; }
.local-artist-card strong,.local-artist-card small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.local-artist-card strong { color: #10182b; font-size: 14px; font-weight: 900; }
.local-artist-card small { color: #6f7d92; font-size: 12px; font-weight: 700; }
.local-artist-index { position: fixed; top: 152px; right: 26px; z-index: 6; display: grid; gap: 0; padding: 9px 7px; border: 1px solid #dce3ea; border-radius: 999px; background: rgba(255,255,255,.88); box-shadow: 0 18px 40px rgba(28,39,55,.1); }
.artist-index-enter-active { transition: opacity 320ms ease; }
.artist-index-leave-active { transition: opacity 160ms ease; }
.artist-index-enter-from,.artist-index-leave-to { opacity: 0; }
.local-artist-index button { --artist-letter-index: 0; position: relative; z-index: 0; display: grid; width: 22px; height: 19px; place-items: center; border: 0; border-radius: 999px; background: transparent; color: #778598; cursor: pointer; font-size: 11px; font-weight: 850; line-height: 1; opacity: 0; transform: scale(1); transform-origin: center; animation: artist-index-letter-enter 360ms ease-out both; animation-delay: calc(80ms + var(--artist-letter-index) * 16ms); transition: color 160ms ease, background 160ms ease, box-shadow 160ms ease, transform 160ms cubic-bezier(.2,.8,.2,1); }
.local-artist-index button:not(:disabled):hover,
.local-artist-index button:not(:disabled):focus-visible { z-index: 2; background: #e6f7f2; color: #087d6d; box-shadow: 0 5px 12px rgba(8,125,109,.18); transform: scale(1.45); }
.local-artist-index button.active { z-index: 1; background: #14b899; color: #fff; box-shadow: 0 5px 12px rgba(20,184,153,.24); transform: scale(1.35); }
.local-artist-index button:not(:disabled):active { transform: scale(1.25); }
.local-artist-index button:disabled { color: #b5beca; cursor: default; opacity: 1; }
@keyframes artist-index-letter-enter {
  from { opacity: 0; }
  to { opacity: 1; }
}
.app-shell.animations-reduced .local-artist-index button { animation-delay: 0ms !important; }
.local-artist-empty { margin: 24px 0 0; padding: 42px 20px; border: 1px dashed #d9dfe6; border-radius: 18px; color: #8f9aa8; font-size: 13px; text-align: center; }
.local-artist-detail-hero { display: grid; gap: 20px; padding: 10px 0 4px; }
.local-artist-detail-hero > button { width: fit-content; border: 0; border-radius: 999px; padding: 9px 13px; background: rgba(255,255,255,.7); color: #6b778b; cursor: pointer; font-size: 12px; font-weight: 800; }
.local-artist-detail-hero > button:hover { color: #8f3032; background: #fff; }
.local-artist-detail-copy { display: grid; gap: 8px; }
.local-artist-detail-copy span { color: #7d899d; font-size: 10px; font-weight: 900; letter-spacing: 2px; }
.local-artist-detail-copy p { margin: 0; color: #6f7d92; font-size: 13px; font-weight: 700; }
.local-artist-detail-section { display: grid; gap: 16px; }
.local-artist-track-list { display: grid; gap: 8px; }
.local-artist-track-list button { display: grid; grid-template-columns: 46px minmax(180px, 1.2fr) minmax(130px, .8fr) 70px; align-items: center; gap: 14px; min-height: 50px; border: 1px solid transparent; border-radius: 10px; padding: 8px 12px; background: transparent; color: #253044; cursor: pointer; text-align: left; }
.local-artist-track-list button:hover,.local-artist-track-list button.active { border-color: rgba(143,48,50,.16); background: rgba(255,255,255,.7); }
.local-artist-track-list span { color: #8d98a9; font-size: 12px; font-weight: 800; }
.local-artist-track-list strong,.local-artist-track-list small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.local-artist-track-list strong { color: #10182b; font-size: 13px; font-weight: 900; }
.local-artist-track-list small { color: #7b879a; font-size: 12px; }
.local-artist-track-list em { color: #8f9aaa; font-size: 12px; font-style: normal; font-weight: 800; text-align: right; }
.hero-section { display: grid; grid-template-columns: minmax(360px,1.3fr) minmax(300px,1fr); gap: 18px; margin-bottom: 38px; }.hero-card { position: relative; display: flex; height: 253px; min-height: 253px; max-height: 253px; overflow: hidden; border-radius: 16px; background: #dce8ee; }.hero-copy { position: relative; z-index: 1; display: flex; max-width: 58%; flex-direction: column; justify-content: center; padding: 30px 34px; background: linear-gradient(90deg,rgba(220,232,238,.98) 0%,rgba(220,232,238,.82) 72%,rgba(220,232,238,0) 100%); }.hero-kicker,.quick-label { color: rgba(43,56,59,.56); font-size: 10px; font-weight: 800; letter-spacing: 1px; }.hero-copy h2 { display: -webkit-box; height: 90px; max-height: 90px; max-width: 330px; margin: 11px 0 9px; overflow: hidden; color: #263335; font-size: clamp(27px,3.3vw,43px); line-height: 1.05; -webkit-box-orient: vertical; -webkit-line-clamp: 2; line-clamp: 2; }.hero-copy p { max-width: 210px; margin-bottom: 18px; color: rgba(38,51,53,.65); font-size: 11px; line-height: 1.7; }.hero-action { display: inline-flex; width: fit-content; align-items: center; gap: 7px; border: 0; border-radius: 999px; padding: 10px 15px 10px 12px; background: #1fd77a; color: #fff; cursor: pointer; font-size: 11px; font-weight: 700; box-shadow: 0 9px 17px rgba(24,178,102,.2); }.hero-action:hover { background: #16c76d; }.hero-action span { display: grid; width: 19px; height: 19px; place-items: center; border-radius: 50%; background: rgba(255,255,255,.95); color: #1dbd6d; font-size: 8px; }
.hero-visual { position: absolute; inset: 0; overflow: hidden; }.hero-visual img { width: 100%; height: 100%; object-fit: cover; opacity: .92; }.hero-disc,.hero-cover,.hero-orbit { display: none; }
.homepage-fallback .hero-card { background: #dce8ee; }.homepage-fallback .fallback-visual { left: 42%; }.homepage-fallback .fallback-visual::after { position: absolute; inset: 0; background: linear-gradient(90deg,rgba(220,232,238,.98),rgba(220,232,238,.18) 64%,rgba(220,232,238,0)); content: ""; }.discovery-intro { display: flex; align-items: flex-end; justify-content: space-between; gap: 22px; margin-bottom: 32px; padding: 28px 30px; border-radius: 16px; background: #dce8ee; }.discovery-intro h2 { margin: 10px 0 7px; color: #263335; font-size: 30px; }.discovery-intro p { max-width: 480px; margin: 0; color: rgba(38,51,53,.65); font-size: 12px; line-height: 1.7; }.discovery-intro button { flex: 0 0 auto; border: 1px solid rgba(38,51,53,.18); border-radius: 999px; padding: 9px 15px; background: rgba(255,255,255,.56); color: #415456; cursor: pointer; font-size: 11px; }.discovery-intro button:hover { background: #fff; color: #168ec6; }
.quick-recommendations { display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); gap: 12px; }.quick-card { position: relative; display: flex; min-height: 218px; flex-direction: column; overflow: hidden; border-radius: 14px; padding: 22px 18px; }.quick-card strong { position: relative; z-index: 1; margin-top: 17px; color: #313b3d; font-size: 15px; line-height: 1.45; }.quick-card.peach { background: #f2d8c5; }.quick-card.mint { background: #cfe5d8; }.quick-card.ink { background: #d9e1e8; }.quick-art { position: absolute; right: 5px; bottom: -12px; color: rgba(255,255,255,.58); font-family: Georgia,"Times New Roman",serif; font-size: 112px; line-height: 1; }.quick-card button { position: relative; z-index: 1; display: grid; width: 29px; height: 29px; margin-top: auto; place-items: center; border: 0; border-radius: 50%; background: rgba(255,255,255,.72); color: #364244; cursor: pointer; font-size: 10px; }.quick-hint { position: relative; z-index: 1; margin-top: auto; color: rgba(54,66,68,.62); font-size: 10px; }
.section-block { margin-bottom: 38px; }.section-heading { margin-bottom: 16px; }.section-heading h2 { display: inline; margin: 0 12px 0 0; color: #2b3335; font-size: 18px; letter-spacing: -.2px; }.section-heading span { color: #b0b5b6; font-size: 10px; }.section-heading .text-button { padding: 0 2px 2px; }
.playlist-overview-page { display: grid; width: min(1288px,calc(100vw - var(--surface-gutter) * 2)); gap: 30px; margin: 8px auto 0; padding-bottom: 36px; }.playlist-overview-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 28px; }.playlist-overview-title { display: flex; align-items: baseline; gap: 13px; margin: 0; color: #0c1426; font-size: clamp(28px,3vw,36px); font-weight: 950; letter-spacing: 0; }.playlist-overview-title span { color: #7a8799; font-size: 13px; font-weight: 700; }.playlist-overview-header p { margin: 18px 0 0; color: #718096; font-size: 13px; }.playlist-overview-search { display: flex; align-items: center; width: min(390px,34vw); min-width: 260px; height: 44px; gap: 10px; padding: 0 18px; border: 1px solid transparent; border-radius: 999px; background: rgba(255,255,255,.96); box-shadow: 0 16px 40px rgba(40,56,76,.08); color: #a2acba; }.playlist-overview-search input { width: 100%; border: 0; background: transparent; color: #1d2739; font: inherit; outline: none; }.playlist-overview-grid { display: grid; grid-template-columns: repeat(auto-fill,minmax(188px,188px)); align-items: start; gap: 30px; }.playlist-overview-card-shell { min-width: 0; border-radius: 16px; cursor: grab; transition: opacity 160ms ease,transform 160ms ease; }.playlist-overview-card-shell:active { cursor: grabbing; }.playlist-overview-card-shell.is-dragging { opacity: .55; transform: scale(.98); }.playlist-overview-card-shell .playlist-card { display: block; }.playlist-overview-empty { margin: -10px 0 0; color: #8b96a8; font-size: 13px; }
.playlist-detail-controls { margin-right: 32px; }
.create-playlist-card {
  display: grid;
  min-width: 0;
  aspect-ratio: 1 / 1.23;
  align-content: end;
  gap: 8px;
  border: 1px dashed #dce3ec;
  border-radius: 14px;
  background: rgba(255, 255, 255, .68);
  color: #6b7890;
  cursor: pointer;
  padding: 16px;
  text-align: left;
  box-shadow: 0 15px 32px rgba(39, 52, 73, .05);
  transition: background 160ms ease, border-color 160ms ease, transform 160ms ease, box-shadow 160ms ease;
}
.create-playlist-card:hover {
  border-color: #b7c7dc;
  background: #fff;
  transform: translateY(-3px);
  box-shadow: 0 18px 34px rgba(39, 52, 73, .1);
}
.create-playlist-plus {
  display: grid;
  width: 100%;
  min-height: 62%;
  place-items: center;
  border-radius: 10px;
  background: rgba(255, 255, 255, .82);
  color: #6b7890;
  font-size: 34px;
  font-weight: 300;
}
.create-playlist-card strong { color: #111827; font-size: 13px; font-weight: 900; }
.create-playlist-card small { color: #7d8aa0; font-size: 11px; }

.playlist-detail-page {
  display: grid;
  width: min(1364px, 100%);
  min-width: 0;
  gap: 28px;
  margin: 10px auto 0;
}
.playlist-detail-header {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 16px;
}
.playlist-detail-back {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  height: 36px;
  padding: 0 15px;
  border: 1px solid #e4e9f1;
  border-radius: 999px;
  background: #fff;
  color: #1f6cff;
  cursor: pointer;
  font-size: 13px;
  font-weight: 750;
  box-shadow: 0 8px 22px rgba(37, 52, 73, .06);
  transition: background 150ms ease, border-color 150ms ease, transform 150ms ease;
}
.playlist-detail-back:hover { border-color: #cfd9e8; background: #f7fbff; transform: translateY(-1px); }
.playlist-detail-title-row {
  display: flex;
  min-width: 0;
  align-items: baseline;
  gap: 12px;
}
.playlist-detail-title {
  margin: 0;
  overflow: hidden;
  color: #0c1426;
  font-size: clamp(28px,3vw,36px);
  font-weight: 950;
  letter-spacing: 0;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.playlist-detail-meta { color: #6f7c92; font-size: 14px; font-weight: 700; white-space: nowrap; }
.playlist-detail-toolbar { display: flex; align-items: center; gap: 7px; }
.playlist-detail-toolbar button {
  display: grid;
  width: 34px;
  height: 34px;
  place-items: center;
  border: 1px solid #dbe4ee;
  border-radius: 7px;
  background: #fff;
  color: #243146;
  cursor: pointer;
  font-size: 17px;
  line-height: 1;
  transition: background 150ms ease, border-color 150ms ease, color 150ms ease, transform 150ms ease;
}
.playlist-detail-toolbar button:hover {
  border-color: #bfd0e6;
  background: #f5f8fc;
  color: #1f6cff;
  transform: translateY(-1px);
}
.playlist-detail-actions-row {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  margin-top: -10px;
}
.playlist-quick-actions { display: flex; align-items: center; gap: 10px; }
.playlist-quick-actions button,
.playlist-detail-filter summary {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  height: 36px;
  padding: 0 15px;
  border: 1px solid #dfe6ef;
  border-radius: 999px;
  background: #fff;
  color: #43516a;
  cursor: pointer;
  font-size: 13px;
  font-weight: 760;
  list-style: none;
  transition: background 150ms ease, border-color 150ms ease, color 150ms ease;
}
.playlist-quick-actions button:hover,
.playlist-detail-filter summary:hover { border-color: #c7d5e6; background: #f8fbff; color: #1f6cff; }
.playlist-quick-actions button:disabled { color: #b7c0ce; cursor: default; }
.playlist-detail-controls {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 12px;
  margin-right: 32px;
}
.playlist-detail-filter { position: relative; }
.playlist-detail-filter summary::-webkit-details-marker { display: none; }
.playlist-filter-panel {
  position: absolute;
  top: calc(100% + 10px);
  right: 0;
  z-index: 20;
  display: grid;
  width: 360px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
  padding: 18px;
  border: 1px solid #e4eaf2;
  border-radius: 18px;
  background: rgba(255, 255, 255, .98);
  box-shadow: 0 20px 42px rgba(35, 45, 60, .14);
  backdrop-filter: blur(12px);
}
.playlist-filter-panel label { display: grid; min-width: 0; gap: 7px; color: #718098; font-size: 12px; font-weight: 760; }
.playlist-filter-panel select {
  width: 100%;
  height: 38px;
  border: 1px solid #dfe6ef;
  border-radius: 10px;
  background: #fff;
  color: #182235;
  padding: 0 11px;
  font-size: 13px;
  outline: none;
}
.playlist-detail-search {
  display: flex;
  min-width: 220px;
  flex: 0 1 390px;
  align-items: center;
  width: min(390px, 34vw);
  height: 40px;
  gap: 10px;
  padding: 0 16px;
  border: 1px solid transparent;
  border-radius: 999px;
  background: rgba(255, 255, 255, .96);
  box-shadow: 0 14px 32px rgba(40, 56, 76, .07);
  color: #a1aabb;
}
.playlist-detail-search input { width: 100%; border: 0; background: transparent; color: #1d2739; font: inherit; outline: none; }
.playlist-track-container {
  min-height: 420px;
  overflow: hidden;
  border: 1px solid #e6e7ea;
  border-radius: 14px;
  background: var(--app-card-background);
  box-shadow: var(--app-card-shadow);
}
.playlist-track-list { display: grid; gap: 8px; padding: 0; }
.playlist-track-table-head {
  display: grid;
  grid-template-columns: 48px 46px minmax(180px, 1.4fr) minmax(120px, .8fr) 72px;
  align-items: center;
  gap: 14px;
  min-height: 34px;
  padding: 0 14px;
  border-bottom: 1px solid #e1e6ef;
  color: #7a879a;
  font-size: 12px;
  font-weight: 800;
}
.playlist-track-table-head span:nth-child(2) { grid-column: 2 / 4; }
.playlist-track-table-head span:nth-child(3) { grid-column: 4; }
.playlist-track-table-head span:nth-child(4) { grid-column: 5; text-align: right; }
.playlist-track-table-head span:nth-child(3),
.playlist-track-table-head span:nth-child(4) { color: #66635f; }
.playlist-track-card {
  display: grid;
  width: 100%;
  grid-template-columns: 48px 46px minmax(180px, 1.4fr) minmax(120px, .8fr) 72px;
  align-items: center;
  gap: 14px;
  border: 1px solid transparent;
  border-radius: 10px;
  padding: 10px 14px;
  background: var(--app-card-background);
  color: #1a2435;
  cursor: pointer;
  text-align: left;
  transition: background 150ms ease, border-color 150ms ease;
}
.playlist-track-card:hover { background: #f7f9fc; }
.playlist-track-card.active { border-color: rgba(153,126,76,.16); background: var(--app-playing-background); }
.playlist-track-card.is-dragging { opacity: .45; }
.playlist-track-index {
  overflow: hidden;
  color: #7d8aa1;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.playlist-track-album,
.playlist-track-duration {
  overflow: hidden;
  color: #5f5d59;
  font-size: 13px;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.playlist-track-duration { text-align: right; }
.playlist-track-cover {
  display: grid;
  width: 40px;
  height: 40px;
  place-items: center;
  overflow: hidden;
  border-radius: 8px;
  color: #fff;
  font-weight: 800;
  box-shadow: 0 8px 18px rgba(35, 45, 64, .12);
}
.playlist-track-cover img { width: 100%; height: 100%; object-fit: cover; }
.playlist-track-main { display: grid; min-width: 0; gap: 5px; }
.playlist-track-main strong,
.playlist-track-main small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.playlist-track-main strong { color: #10192b; font-size: 14px; font-weight: 850; }
.playlist-track-main small { color: #7d879b; font-size: 12px; }
.playlist-loading-state,
.playlist-empty-state {
  display: grid;
  min-height: 420px;
  place-items: center;
  align-content: center;
  gap: 12px;
  color: #72819a;
  text-align: center;
}
.playlist-loading-state.error { color: #b7525a; }
.playlist-loading-state button { height: 32px; border: 1px solid #dfe6ef; border-radius: 999px; background: #fff; color: #1f6cff; cursor: pointer; padding: 0 14px; }
.playlist-empty-state strong { color: #26334a; font-size: 20px; }
.playlist-empty-state p { margin: 0; font-size: 13px; }
.playlist-empty-wave { display: flex; height: 46px; align-items: center; gap: 5px; color: #6f83a1; }
.playlist-empty-wave i { display: block; width: 3px; border-radius: 999px; background: currentColor; }
.playlist-empty-wave i:nth-child(1) { height: 16px; }
.playlist-empty-wave i:nth-child(2) { height: 34px; }
.playlist-empty-wave i:nth-child(3) { height: 26px; }
.playlist-empty-wave i:nth-child(4) { height: 38px; }
.playlist-name-dialog {
  position: fixed;
  inset: 0;
  z-index: 90;
  display: grid;
  place-items: center;
  background: rgba(15, 19, 24, .48);
  backdrop-filter: blur(2px);
}
.playlist-name-modal {
  display: grid;
  width: min(380px, calc(100vw - 42px));
  gap: 18px;
  border-radius: 16px;
  background: #fff;
  padding: 28px 30px;
  box-shadow: 0 28px 70px rgba(0, 0, 0, .24);
}
.playlist-name-modal h2 { margin: 0; color: #202735; font-size: 20px; font-weight: 900; }
.playlist-name-modal label { display: grid; gap: 8px; color: #7a8493; font-size: 12px; }
.playlist-name-modal input { height: 46px; border: 1px solid #d9dde4; border-radius: 9px; padding: 0 15px; color: #121826; font: inherit; outline: none; }
.playlist-name-error { margin: -6px 0 0; color: #c7545c; font-size: 12px; }
.playlist-name-actions { display: flex; justify-content: flex-end; gap: 10px; }
.playlist-name-actions button { height: 40px; min-width: 72px; border: 0; border-radius: 8px; background: #f3f4f6; color: #333842; cursor: pointer; font-weight: 800; }
.playlist-name-actions button.primary { background: #df9bd2; color: #fff; }
.track-playlist-picker-dialog {
  position: fixed;
  inset: 0;
  z-index: 95;
  display: grid;
  place-items: center;
  padding: 24px;
  background: rgba(15, 19, 24, .46);
  backdrop-filter: blur(2px);
}
.track-playlist-picker-panel {
  display: grid;
  width: min(430px, calc(100vw - 42px));
  max-height: min(570px, calc(100vh - 48px));
  gap: 18px;
  overflow: hidden;
  padding: 24px;
  border: 1px solid rgba(255,255,255,.72);
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 28px 70px rgba(0,0,0,.24);
}
.track-playlist-picker-panel > header { display: flex; align-items: flex-start; justify-content: space-between; gap: 18px; }
.track-playlist-picker-panel h2 { margin: 0; color: #182235; font-size: 19px; }
.track-playlist-picker-panel header p { max-width: 330px; margin: 7px 0 0; overflow: hidden; color: #7b8798; font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }
.track-playlist-picker-close { display: grid; width: 30px; height: 30px; flex: 0 0 auto; place-items: center; border: 0; border-radius: 7px; background: #f1f3f6; color: #758094; cursor: pointer; font-size: 20px; }
.track-playlist-picker-close:hover { background: #e6eaf0; color: #273348; }
.track-playlist-target-list { display: grid; gap: 7px; overflow: auto; padding-right: 3px; }
.track-playlist-target-list > button { display: grid; min-width: 0; grid-template-columns: 44px minmax(0,1fr) 28px; align-items: center; gap: 12px; border: 0; border-radius: 8px; padding: 9px; background: transparent; color: #1f2a3e; cursor: pointer; font: inherit; text-align: left; }
.track-playlist-target-list > button:hover { background: #f2f5f8; }
.track-playlist-target-art { display: grid; width: 44px; height: 44px; place-items: center; overflow: hidden; border-radius: 7px; color: rgba(255,255,255,.92); font-size: 16px; font-weight: 900; }
.track-playlist-target-art.aggregate { background: #dfe8f8; color: #60708b; }
.track-playlist-target-list > button > span:nth-child(2) { display: grid; min-width: 0; gap: 5px; }
.track-playlist-target-list strong,.track-playlist-target-list small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.track-playlist-target-list strong { font-size: 12px; }
.track-playlist-target-list small { color: #8490a1; font-size: 10px; }
.track-playlist-target-list i { display: grid; width: 26px; height: 26px; place-items: center; border-radius: 50%; background: #edf1f5; color: #6f7c90; font-size: 15px; font-style: normal; }
.track-playlist-target-list > button:hover i { background: #dfe8f8; color: #315fbd; }
.track-playlist-picker-empty { display: grid; min-height: 190px; place-items: center; align-content: center; gap: 8px; color: #8792a3; text-align: center; }
.track-playlist-picker-empty strong { color: #2d394d; font-size: 14px; }
.track-playlist-picker-empty span { font-size: 11px; }
.track-playlist-picker-empty button { height: 34px; margin-top: 8px; border: 1px solid #d9e0e9; border-radius: 8px; padding: 0 13px; background: #fff; color: #315fbd; cursor: pointer; font-weight: 700; }
.track-playlist-picker-empty button:hover { background: #f2f5f8; }
.playlist-grid { display: grid; grid-template-columns: repeat(6, minmax(100px, 1fr)); gap: 18px; }
.track-section { width: min(1288px, 100%); margin-right: auto; margin-left: auto; }
.track-list { display: grid; overflow: hidden; border: 1px solid #e4e7eb; border-radius: 14px; background: var(--app-card-background); box-shadow: var(--app-card-shadow); }
.track-row { display: grid; width: 100%; min-height: 64px; grid-template-columns: 48px 42px minmax(180px,1.4fr) minmax(120px,.8fr) 72px 34px; align-items: center; gap: 14px; border: 0; border-bottom: 1px solid #edf0f2; padding: 8px 14px; background: var(--app-card-background); color: inherit; cursor: pointer; text-align: left; transition: background 150ms ease,box-shadow 150ms ease; }
.track-row:last-child { border-bottom: 0; }
.track-row:hover { background: rgba(247,249,252,.9); }
.track-row.active { background: var(--app-playing-background); box-shadow: inset 3px 0 rgba(32,171,126,.7); }
.track-index { color: #8b96a6; font-size: 12px; text-align: center; }
.track-cover { display: grid; width: 42px; height: 42px; place-items: center; overflow: hidden; border-radius: 7px; color: #fff; font-size: 14px; font-weight: 800; box-shadow: 0 7px 16px rgba(28,38,52,.12); }
.track-cover img { width: 100%; height: 100%; object-fit: cover; }
.track-details { display: grid; min-width: 0; gap: 4px; }
.track-details strong,.track-details > span,.track-album { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.track-details strong { color: #161d2c; font-size: 13px; font-weight: 850; }
.track-details > span { color: #7f8a9d; font-size: 11px; font-weight: 600; }
.track-album,.track-duration { color: #5f5d59; font-size: 13px; font-weight: 500; }
.track-duration { text-align: right; white-space: nowrap; }
.track-state { color: #8b96a6; font-size: 11px; text-align: center; }
.now-playing-section { display: grid; grid-template-columns: 190px minmax(0, 1fr); gap: 26px; margin: 14px 0 30px; padding: 20px; border: 1px solid #e4e9e7; border-radius: 14px; background: rgba(255,255,255,.72); }.now-playing-cover { display: grid; width: 190px; aspect-ratio: 1; place-items: center; overflow: hidden; border-radius: 11px; color: rgba(255,255,255,.9); font-family: Georgia,"Times New Roman",serif; font-size: 54px; font-weight: 700; }.now-playing-info { min-width: 0; }.now-playing-info .section-heading { align-items: center; margin-bottom: 15px; }.now-playing-info .section-heading h2 { margin-right: 0; }.lyrics-list { display: grid; max-height: 235px; gap: 9px; overflow: auto; padding: 4px 9px 4px 0; }.lyrics-list p { margin: 0; color: #9da6a2; font-size: 12px; line-height: 1.55; transition: color 160ms ease,font-size 160ms ease; }.lyrics-list p.active { color: #1bbd6b; font-size: 14px; font-weight: 700; }.lyrics-empty { display: grid; min-height: 150px; place-items: center; color: #a4adaa; font-size: 12px; } audio { display: none; }
.lyrics-panel { position: fixed; right: 26px; bottom: 101px; z-index: 19; display: flex; width: min(430px,calc(100vw - 32px)); max-height: min(590px,calc(100vh - 150px)); flex-direction: column; overflow: hidden; border: 1px solid #e1e8e4; border-radius: 14px; background: rgba(255,255,255,.98); box-shadow: 0 16px 40px rgba(35,50,44,.16); backdrop-filter: blur(16px); }.lyrics-panel-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; padding: 20px 21px 15px; border-bottom: 1px solid #edf0ef; }.lyrics-panel-header h2 { margin: 5px 0 4px; color: #273130; font-size: 17px; }.lyrics-panel-header p { margin: 0; color: #9ba5a1; font-size: 11px; }.lyrics-panel-header button { border: 0; background: transparent; color: #929c98; cursor: pointer; font-size: 25px; line-height: .8; }.lyrics-panel-kicker { color: #1cbd6a; font-size: 9px; font-weight: 800; letter-spacing: 1.2px; }.lyrics-panel-list { min-height: 180px; overflow: auto; padding: 20px 22px 25px; }.lyrics-panel-list p { margin: 0; padding: 7px 0; color: #9ba5a1; font-size: 13px; line-height: 1.55; transition: color 180ms ease,transform 180ms ease,font-size 180ms ease; }.lyrics-panel-list p.is-active { color: #1dbb69; font-size: 15px; font-weight: 700; transform: translateX(2px); }.lyrics-panel-empty { display: grid; min-height: 180px; place-items: center; color: #a4adaa; font-size: 12px; }.lyrics-panel-enter-active,.lyrics-panel-leave-active { transition: opacity 180ms ease,transform 180ms ease; }.lyrics-panel-enter-from,.lyrics-panel-leave-to { opacity: 0; transform: translateY(12px); }
.song-detail { position: fixed; inset: 0; z-index: 60; display: grid; min-height: 0; grid-template-rows: 68px minmax(0,1fr) 126px; overflow: hidden; background: linear-gradient(125deg,var(--detail-ambient-start,#eef8f9) 0%,rgba(255,255,255,.9) 52%,var(--detail-ambient-end,#edf7f8) 100%); color: #27484e; }.song-detail-header { display: grid; grid-template-columns: 44px 1fr 44px; align-items: center; padding: 0 27px; color: #6a878d; }.song-detail-header span { justify-self: center; color: #7d9ba0; font-size: 11px; font-weight: 700; letter-spacing: 1.4px; }.song-detail-header button { display: grid; width: 36px; height: 36px; place-items: center; border: 0; border-radius: 7px; background: transparent; color: #527278; cursor: pointer; font-size: 23px; line-height: 1; }.song-detail-header button:first-child { font-size: 28px; transform: none; }.song-detail-back-icon { display: block; width: 18px; height: 18px; background: currentColor; -webkit-mask: url("./assets/icons/back.svg") center / contain no-repeat; mask: url("./assets/icons/back.svg") center / contain no-repeat; }.song-detail-header button:last-child { justify-self: end; }.song-detail-header button:hover { background: rgba(126,211,221,.22); color: #168ec6; }.song-detail-content { display: grid; min-height: 0; grid-template-columns: minmax(230px,360px) minmax(330px,560px); align-items: center; justify-content: center; gap: clamp(40px,8vw,132px); padding: 12px 8vw 36px; }.song-detail-cover { display: grid; width: min(31vw,350px); min-width: 230px; aspect-ratio: 1; place-items: center; overflow: hidden; border-radius: 10px; color: rgba(255,255,255,.92); font-family: Georgia,"Times New Roman",serif; font-size: 92px; font-weight: 700; box-shadow: 0 24px 50px rgba(52,125,134,.18); }.song-detail-cover img { width: 100%; height: 100%; object-fit: cover; }.song-detail-lyrics { display: grid; min-width: 0; min-height: 0; align-content: center; }.song-detail-kicker { margin: 0 0 9px; color: #70a6af; font-size: 10px; font-weight: 800; letter-spacing: 1.6px; }.song-detail-lyrics h2 { margin: 0 0 7px; color: #233f45; font-size: clamp(24px,2.6vw,36px); line-height: 1.15; }.song-detail-lyrics>span { color: #77959b; font-size: 12px; }.song-detail-lyrics-list { height: min(48vh,420px); margin-top: 28px; overflow: auto; overscroll-behavior: contain; padding: 34px 12px; text-align: center; scrollbar-width: none; scroll-behavior: auto; touch-action: pan-y; }.song-detail-lyrics-list::-webkit-scrollbar { width: 0; height: 0; }.song-detail-lyrics-list p { margin: 0; padding: 8px 0; color: #8faeb4; font-size: 15px; line-height: 1.55; transition: font-size 180ms ease,transform 180ms ease; }.song-detail-lyrics-list p.is-active { font-size: 20px; font-weight: 800; transform: scale(1.04); }.lyric-character { color: #8faeb4; transition: color 100ms linear; }.lyric-character.is-sung { color: #168ec6; }.song-detail-lyrics-empty { display: grid; height: min(48vh,420px); margin-top: 28px; place-items: center; color: #91afb5; font-size: 13px; }.song-detail-player { display: grid; grid-template-rows: 22px 1fr; align-items: center; padding: 15px max(40px,10vw) 18px; border-top: 1px solid rgba(106,171,181,.22); background: rgba(239,253,254,.86); }.song-detail-progress { display: grid; grid-template-columns: 43px minmax(120px,1fr) 43px; align-items: center; gap: 10px; color: #7c9ca2; font-size: 10px; text-align: center; }.song-detail-progress input { width: 100%; height: 4px; accent-color: #24c985; cursor: pointer; }.song-detail-controls { display: flex; align-items: center; justify-content: center; gap: 28px; }.song-detail-controls button { border: 0; background: transparent; color: #385d63; cursor: pointer; font-size: 15px; transition: color 150ms ease; }.song-detail-controls button:hover { color: #168ec6; }.song-detail-controls .song-detail-play { display: grid; width: 42px; height: 42px; place-items: center; border-radius: 50%; background: #22ce80; color: #fff; box-shadow: 0 7px 16px rgba(31,180,119,.26); }.song-detail-controls .song-detail-play:hover { background: #168ec6; color: #fff; }.song-detail-volume { display: flex; align-items: center; gap: 8px; }.song-detail-volume input { width: 76px; height: 4px; accent-color: #168ec6; cursor: pointer; }.song-detail-play .play-icon { width: 0; height: 0; margin-left: 3px; border-top: 7px solid transparent; border-bottom: 7px solid transparent; border-left: 10px solid currentColor; }.song-detail-play .pause-icon { width: 10px; height: 14px; border-right: 3px solid currentColor; border-left: 3px solid currentColor; }.song-detail-enter-active,.song-detail-leave-active { transition: opacity 210ms ease; }.song-detail-enter-from,.song-detail-leave-to { opacity: 0; }
.song-detail-lyrics-list .lyric-original { display: block; color: #405d63; }
.song-detail-lyrics-list .song-detail-translation { display: block; margin-top: 2px; color: #6f9296; font-size: 13px; font-weight: 400; line-height: 1.5; transition: color 180ms ease,font-size 180ms ease; }
 .song-detail-lyrics-list .is-active .song-detail-translation { font-size: 22px; font-weight: 400; }
.song-detail-lyrics-list .lyric-character { color: #405d63; transition: color 55ms linear; }
.song-detail-lyrics-list .lyric-character.is-sung { color: #168ec6; }
.song-info-character {
  transition: color 55ms linear;
}

.song-detail-artist .song-info-character {
  color: #77959b;
}

.song-detail-credit > strong .song-info-character {
  color: #496a72;
}

.song-detail-credit-value .song-info-character {
  color: #78969c;
}

.song-detail-song-info .song-info-character.is-sung {
  color: #2f9fc8;
}

.song-detail-mode-wrap { position: relative; }
.song-detail-controls .song-detail-mode { display: grid; width: 30px; height: 30px; place-items: center; }
.play-mode-icon,.play-mode-option-icon,.transport-icon,.volume-icon { display: block; width: 18px; height: 18px; background: currentColor; -webkit-mask-position: center; mask-position: center; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-size: contain; mask-size: contain; }
.play-mode-icon-shuffle { -webkit-mask-image: url("./assets/icons/shuffle-line.svg"); mask-image: url("./assets/icons/shuffle-line.svg"); }
.play-mode-icon-sequence { -webkit-mask-image: url("./assets/icons/list-order.svg"); mask-image: url("./assets/icons/list-order.svg"); }
.play-mode-icon-single { -webkit-mask-image: url("./assets/icons/repeat-one-line.svg"); mask-image: url("./assets/icons/repeat-one-line.svg"); }
.play-mode-icon-loop { -webkit-mask-image: url("./assets/icons/repeat.svg"); mask-image: url("./assets/icons/repeat.svg"); }
.transport-icon-previous { -webkit-mask-image: url("./assets/icons/previous.svg"); mask-image: url("./assets/icons/previous.svg"); }
.transport-icon-next { -webkit-mask-image: url("./assets/icons/next.svg"); mask-image: url("./assets/icons/next.svg"); }
.volume-icon { -webkit-mask-image: url("./assets/icons/volume-down-line.svg"); mask-image: url("./assets/icons/volume-down-line.svg"); }
.volume-icon.muted { -webkit-mask-image: url("./assets/icons/volume-mute-line.svg"); mask-image: url("./assets/icons/volume-mute-line.svg"); }
.play-mode-menu { position: absolute; bottom: calc(100% + 10px); left: 50%; z-index: 3; display: grid; min-width: 168px; width: max-content; padding: 5px; border: 1px solid rgba(89,147,158,.22); border-radius: 8px; background: rgba(255,255,255,.98); box-shadow: 0 12px 28px rgba(42,86,94,.18); transform: translateX(-50%); }
.play-mode-menu button { display: grid; grid-template-columns: 18px max-content; align-items: center; gap: 9px; width: 100%; padding: 8px 9px; border-radius: 5px; color: #527278; font-size: 12px; text-align: left; white-space: nowrap; }
.play-mode-menu button:hover,.play-mode-menu button.selected { background: #e7f8fb; color: #168ec6; }
.play-mode-option-icon { width: 15px; height: 15px; }
.queue-panel { position: fixed; right: 18px; bottom: 92px; z-index: 55; display: grid; width: min(472px,calc(100vw - 36px)); max-height: min(560px,calc(100vh - 122px)); grid-template-rows: auto minmax(0,1fr); overflow: hidden; border: 1px solid #e7edf4; border-radius: 18px; background: rgba(255,255,255,.98); box-shadow: 0 20px 48px rgba(28,39,36,.16); color: #10192b; }.queue-panel-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 18px; padding: 17px 18px 12px; }.queue-panel-title { display: grid; min-width: 0; gap: 7px; }.queue-title-row { display: flex; align-items: center; gap: 9px; }.queue-panel-header h2 { margin: 0; color: #0c1426; font-size: 18px; font-weight: 900; letter-spacing: 0; }.queue-count-badge { display: inline-flex; align-items: baseline; gap: 2px; padding: 4px 9px; border-radius: 999px; background: #eaf3ff; color: #1f6cff; font-size: 11px; font-weight: 800; }.queue-count-badge b { font-size: 13px; }.queue-panel-title p { margin: 0; color: #718096; font-size: 12px; }.queue-panel-actions { display: flex; flex: 0 0 auto; align-items: center; gap: 8px; }.queue-panel-actions button { display: inline-flex; align-items: center; gap: 5px; height: 30px; padding: 0 12px; border: 1px solid #dce3ec; border-radius: 999px; background: #fff; color: #2f3b4f; cursor: pointer; font-size: 12px; font-weight: 700; box-shadow: 0 4px 12px rgba(24,35,52,.05); transition: border-color 150ms ease,color 150ms ease,background 150ms ease,transform 150ms ease; }.queue-panel-actions button:hover { border-color: #b9c9de; background: #f8fbff; color: #1f6cff; transform: translateY(-1px); }.queue-panel-actions button:disabled { color: #c3c9d2; cursor: default; transform: none; }.queue-action-icon { position: relative; display: inline-block; width: 13px; height: 13px; color: currentColor; }.queue-locate-icon { border: 1.7px solid currentColor; border-radius: 50%; }.queue-locate-icon::after { position: absolute; top: 50%; left: 50%; width: 3px; height: 3px; border-radius: 50%; background: currentColor; content: ""; transform: translate(-50%,-50%); }.queue-trash-icon::before { position: absolute; top: 3px; left: 3px; width: 7px; height: 8px; border: 1.6px solid currentColor; border-top: 0; border-radius: 0 0 2px 2px; content: ""; }.queue-trash-icon::after { position: absolute; top: 1px; left: 2px; width: 9px; height: 2px; border-radius: 999px; background: currentColor; box-shadow: 3px -2px 0 -1px currentColor; content: ""; }.queue-list { display: grid; min-height: 0; gap: 8px; overflow: auto; padding: 8px 8px 14px; }.queue-track { display: grid; grid-template-columns: minmax(0,1fr) auto; align-items: center; border: 1px solid transparent; border-radius: 14px; background: #fff; transition: background 150ms ease,border-color 150ms ease,box-shadow 150ms ease,transform 150ms ease; }.queue-track:hover { background: #f8fbff; transform: translateY(-1px); }.queue-track:hover .queue-drag-handle,.queue-track:hover .queue-current-actions,.queue-track:focus-within .queue-drag-handle,.queue-track:focus-within .queue-current-actions { opacity: 1; pointer-events: auto; }.queue-track.active { border-color: #bdd4ff; background: #eef5ff; box-shadow: 0 9px 24px rgba(31,108,255,.12); }.queue-track-main { display: grid; width: 100%; min-width: 0; grid-template-columns: 58px 38px minmax(0,1fr); align-items: center; gap: 12px; border: 0; padding: 8px 8px 8px 12px; background: transparent; color: inherit; cursor: pointer; text-align: left; }.queue-row-leading { display: flex; min-width: 0; align-items: center; justify-content: center; gap: 8px; }.queue-drag-handle { display: grid; gap: 3px; width: 14px; color: #8a99ad; cursor: grab; }.queue-drag-handle:active { cursor: grabbing; }.queue-drag-handle,.queue-current-actions { opacity: 0; pointer-events: none; transition: opacity 150ms ease,transform 150ms ease; }.queue-drag-handle i { display: block; width: 13px; height: 2px; border-radius: 999px; background: currentColor; }.queue-index { color: #6d7890; font-size: 12px; font-weight: 800; text-align: center; }.queue-wave-indicator { display: flex; width: 20px; align-items: center; justify-content: center; gap: 3px; }.queue-wave-indicator i { width: 3px; height: 5px; border-radius: 999px; background: #1f6cff; animation: queue-wave 780ms ease-in-out infinite; }.queue-wave-indicator i:nth-child(2) { animation-delay: 120ms; }.queue-wave-indicator i:nth-child(3) { animation-delay: 240ms; }.queue-track.is-paused .queue-wave-indicator i { animation-play-state: paused; opacity: .75; }.queue-track.is-paused .queue-wave-indicator i:nth-child(1) { height: 4px; }.queue-track.is-paused .queue-wave-indicator i:nth-child(2) { height: 6px; }.queue-track.is-paused .queue-wave-indicator i:nth-child(3) { height: 4px; }.queue-cover { display: grid; width: 38px; height: 38px; place-items: center; overflow: hidden; border-radius: 7px; color: #fff; font-size: 13px; font-weight: 700; box-shadow: 0 5px 14px rgba(28,39,64,.12); }.queue-cover img { width: 100%; height: 100%; object-fit: cover; }.queue-track-copy { display: grid; min-width: 0; gap: 4px; }.queue-track-copy strong,.queue-track-copy span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }.queue-track-copy strong { color: #111827; font-size: 13px; font-weight: 850; }.queue-track-copy span { color: #7d8799; font-size: 11px; }.queue-track.active .queue-track-copy strong { color: #1f6cff; }.queue-current-actions { display: flex; align-items: center; gap: 6px; padding-right: 10px; }.queue-current-actions button { display: grid; width: 25px; height: 25px; place-items: center; border: 0; border-radius: 50%; background: rgba(226,232,240,.78); color: #7d8799; cursor: pointer; font-size: 14px; line-height: 1; transition: background 150ms ease,color 150ms ease,transform 150ms ease; }.queue-current-actions button:hover { background: #d7e1ee; color: #334155; transform: translateY(-1px); }.queue-card-next-icon { display: block; width: 13px; height: 13px; background: currentColor; -webkit-mask: url("./assets/icons/next.svg") center / contain no-repeat; mask: url("./assets/icons/next.svg") center / contain no-repeat; }.queue-empty { padding: 34px 20px; color: #9ca4a2; font-size: 11px; text-align: center; }.queue-panel-enter-active,.queue-panel-leave-active { transition: opacity 180ms ease,transform 180ms ease; }.queue-panel-enter-from,.queue-panel-leave-to { opacity: 0; transform: translateY(8px); }
.song-detail { --detail-ambient-start: #eef8f9; --detail-ambient-end: #edf7f8; background-color: #fff; contain: paint; will-change: opacity; }
.player-bar.song-detail-player-bar { z-index: 70; }
.player-bar-visibility-enter-active,.player-bar-visibility-leave-active { transition: opacity 240ms ease,transform 240ms ease; }
.player-bar-visibility-enter-from,.player-bar-visibility-leave-to { opacity: 0; transform: translate(-50%,12px); }
.song-detail-header > button:only-child { justify-self: start; }
.song-detail ~ .queue-panel { z-index: 85; }
@keyframes queue-wave { 0%,100% { height: 4px; opacity: .55; } 50% { height: 10px; opacity: 1; } }
@media (max-width: 1240px) { .main-scroll { --surface-gutter: 28px; }.hero-section { grid-template-columns: minmax(320px,1.1fr) minmax(280px,1fr); }.playlist-grid { grid-template-columns: repeat(5,minmax(100px,1fr)); } }
@media (max-width: 980px) { .app-shell { grid-template-columns: 72px minmax(0,1fr); }.app-shell.is-sidebar-collapsed { grid-template-columns: 0 minmax(0,1fr); }.main-scroll { --surface-gutter: 22px; }.hero-section { grid-template-columns: 1fr; }.hero-card { min-height: 230px; }.quick-card { min-height: 145px; }.playlist-grid { grid-template-columns: repeat(4,minmax(100px,1fr)); } }
@media (max-width: 700px) { body { overflow: auto; }.app-shell { display: block; }.workspace { min-height: 100vh; }.main-scroll { --surface-gutter: 16px; padding-top: 20px; padding-bottom: 135px; }.local-home-page { width: 100%; }.page-heading { align-items: flex-start; flex-direction: column; }.page-actions { width: 100%; }.page-actions .report-link { flex: 1; justify-content: center; }.library-toolbar { align-items: stretch; flex-direction: column; }.folder-input { min-width: 0; }.hero-copy { max-width: 65%; padding: 26px 23px; }.hero-visual { left: 52%; }.hero-cover { right: 5%; }.quick-recommendations { grid-template-columns: 1fr; }.quick-card { min-height: 110px; }.quick-card strong { margin-top: 9px; }.quick-art { right: 12%; bottom: -25px; font-size: 92px; }.playlist-grid { grid-template-columns: repeat(2,minmax(100px,1fr)); gap: 15px; }.track-row { grid-template-columns: 25px 42px minmax(0,1fr) 30px; gap: 8px; }.track-album,.track-duration { display: none; }.now-playing-section { grid-template-columns: 1fr; gap: 18px; }.now-playing-cover { width: min(190px, 60vw); }.lyrics-panel { right: 16px; bottom: 96px; width: calc(100vw - 32px); max-height: calc(100vh - 135px); }.song-detail { grid-template-rows: 58px minmax(0,1fr) 118px; }.song-detail-header { padding-inline: 12px; }.song-detail-content { grid-template-columns: 1fr; align-content: center; justify-items: center; gap: 24px; padding: 8px 24px 18px; }.song-detail-cover { width: min(52vw,260px); min-width: 0; }.song-detail-lyrics { width: min(100%,430px); text-align: center; }.song-detail-lyrics-list { height: min(33vh,260px); margin-top: 13px; padding-block: 22px; }.song-detail-lyrics-empty { height: min(33vh,260px); margin-top: 13px; }.song-detail-player { padding-inline: 20px; }.desktop-lyrics-preview { top: 76px; right: 16px; width: calc(100vw - 32px); } }

.song-detail-player { grid-template-rows: 1fr 35px; padding: 10px max(40px,10vw) 15px; }
.song-detail-progress-wrap { width: min(100%,540px); margin: 0 auto; }
.song-detail-progress { grid-template-rows: 4px 16px; gap: 6px 10px; }
.song-detail-progress .progress-slider-wrap { grid-column: 1 / -1; grid-row: 1; }
.song-detail-progress input { grid-column: 1 / -1; grid-row: 1; }
.song-detail-progress span:first-child { grid-column: 1; grid-row: 2; }
.song-detail-progress span:last-child { grid-column: 3; grid-row: 2; }
.song-detail-controls { gap: 32px; }
.song-detail-controls button { display: grid; width: 36px; height: 36px; place-items: center; }
.song-detail-controls .song-detail-mode { width: 36px; height: 36px; }
.song-detail-controls .song-detail-play { width: 46px; height: 46px; }
.song-detail-controls .transport-icon { width: 24px; height: 24px; }
.song-detail-volume { position: relative; display: grid; place-items: center; }
.song-detail-volume-button { width: 36px!important; height: 36px!important; }
.song-detail-volume-panel { position: absolute; bottom: calc(100% + 12px); left: 50%; z-index: 4; display: grid; min-width: 68px; justify-items: center; gap: 9px; padding: 12px 11px 10px; border: 1px solid #d8e8eb; border-radius: 10px; background: rgba(255,255,255,.98); box-shadow: 0 12px 26px rgba(42,86,94,.2); transform: translateX(-50%); }
.song-detail-volume-panel::after { position: absolute; bottom: -7px; left: calc(50% - 6px); width: 12px; height: 12px; border-right: 1px solid #d8e8eb; border-bottom: 1px solid #d8e8eb; background: #fff; content: ""; transform: rotate(45deg); }
.volume-slider-rail { display: grid; width: 22px; height: 112px; place-items: center; }
.song-detail-volume-slider { width: 112px; height: 22px; accent-color: #168ec6; cursor: pointer; transform: rotate(-90deg); }
.volume-panel-icon { display: block; width: 18px; height: 18px; background: #527278; -webkit-mask: url("./assets/icons/volume-down-line.svg") center / contain no-repeat; mask: url("./assets/icons/volume-down-line.svg") center / contain no-repeat; }
.song-detail-play .play-icon { border-top-width: 8px; border-bottom-width: 8px; border-left-width: 12px; }
.song-detail-play .pause-icon { width: 11px; height: 16px; }
@media (max-width: 700px) {
  .song-detail-player { padding-inline: 20px; }
  .song-detail-controls { gap: 18px; }
  .song-detail-controls button { width: 32px; height: 32px; }
  .song-detail-controls .song-detail-mode,.song-detail-volume-button { width: 32px!important; height: 32px!important; }
  .song-detail-controls .song-detail-play { width: 42px; height: 42px; }
}

.song-detail-volume .volume-slider-rail {
  position: relative;
  display: block;
  width: 22px;
  height: 112px;
  margin-inline: auto;
}

.song-detail-volume .song-detail-volume-slider {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 112px!important;
  height: 22px!important;
  margin: 0;
  transform: translate(-50%,-50%) rotate(-90deg);
  transform-origin: center;
}

.mode-badge {
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  padding: 0 9px;
  border: 1px solid #dce8e5;
  border-radius: 999px;
  color: #6f817c;
  font-size: 10px;
  white-space: nowrap;
}

.settings-page {
  display: grid;
  width: min(1180px, calc(100% - 64px));
  gap: 22px;
  align-content: start;
  margin-inline: auto;
  padding: 80px 0 90px;
}

.settings-page-header {
  display: grid;
  gap: 8px;
}

.settings-page-header h1 {
  margin: 0;
  color: #10182b;
  font-size: 34px;
  line-height: 1.15;
}

.settings-page-header p:last-child {
  margin: 0;
  color: #6b7890;
  font-size: 13px;
}

.settings-card {
  display: grid;
  gap: 24px;
  border: 1px solid #e5eaf1;
  border-radius: 16px;
  padding: 28px;
  background: rgba(255, 255, 255, .86);
  box-shadow: 0 18px 45px rgba(31, 39, 56, .08);
}

.settings-compact-card {
  padding-block: 20px;
}

.settings-placeholder {
  min-height: 150px;
}

.settings-card-heading {
  display: flex;
  align-items: center;
  gap: 16px;
}

.settings-icon {
  display: grid;
  width: 46px;
  height: 46px;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 14px;
  background: #edf4ff;
  color: #1769ff;
  font-size: 22px;
}

.settings-card-heading h2 {
  margin: 0 0 5px;
  color: #10182b;
  font-size: 21px;
  font-weight: 800;
}

.settings-card-heading p {
  margin: 0;
  color: #6b7890;
  font-size: 13px;
}

.settings-field {
  display: grid;
  gap: 8px;
  border-top: 1px solid #edf0f5;
  padding-top: 20px;
}

.settings-library-field {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 16px 24px;
}

.settings-library-path {
  display: grid;
  min-width: min(240px, 100%);
  flex: 1 1 240px;
  gap: 8px;
}

.settings-library-path > span {
  color: #7b8799;
  font-size: 12px;
  font-weight: 700;
}

.settings-library-path > strong {
  min-width: 0;
  color: #11192b;
  font-size: 14px;
  font-weight: 700;
  overflow-wrap: anywhere;
}

.settings-library-root {
  color: #7b8799;
  font-size: 11px;
  line-height: 1.45;
  overflow-wrap: anywhere;
}

.settings-toggle-field {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  border-top: 1px solid #edf0f5;
  padding-top: 20px;
}

.settings-toggle-field > div {
  display: grid;
  gap: 5px;
}

.settings-toggle-field strong {
  color: #11192b;
  font-size: 14px;
  font-weight: 800;
}

.settings-toggle-field > div > span {
  color: #7b8799;
  font-size: 12px;
  line-height: 1.5;
}

.settings-startup-field {
  border-top: 0;
  padding-top: 0;
}

.settings-onboarding-field > div { min-width: 0; }
.settings-onboarding-button {
  display: inline-flex;
  height: 40px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  gap: 7px;
  border: 0;
  border-radius: 999px;
  padding: 0 17px;
  background: #f0f2f5;
  color: #273244;
  cursor: pointer;
  font-size: 12px;
  font-weight: 750;
  transition: background 180ms ease, color 180ms ease, transform 180ms ease;
}
.settings-onboarding-button:hover { background: #e8f7f2; color: #158368; transform: translateY(-1px); }

.settings-fade-field {
  gap: 28px;
  border-top: 1px solid #edf0f5;
  padding-top: 20px;
}

.settings-fade-copy {
  min-width: 220px;
  flex: 1 1 auto;
}

.settings-fade-controls {
  display: flex !important;
  flex: 0 0 auto;
  align-items: center;
  gap: 18px !important;
}

.settings-fade-duration {
  display: grid;
  grid-template-columns: auto 150px 68px;
  align-items: center;
  gap: 10px;
  color: #687386;
  font-size: 11px;
  font-weight: 800;
  white-space: nowrap;
}

.settings-fade-slider {
  width: 150px;
  accent-color: #1769ff;
  cursor: pointer;
}

.settings-fade-slider:disabled {
  opacity: .38;
  cursor: not-allowed;
}

.settings-fade-duration output {
  min-width: 68px;
  border: 1px solid #e0e5ec;
  border-radius: 8px;
  padding: 8px 7px;
  background: #fff;
  color: #263247;
  font-variant-numeric: tabular-nums;
  text-align: center;
}

.settings-segmented-control {
  display: inline-flex;
  flex: 0 0 auto;
  grid-auto-flow: column;
  gap: 2px;
  border: 1px solid #e0e5ec;
  border-radius: 10px;
  padding: 4px;
  background: #f3f5f8;
}

.settings-segmented-control button {
  display: inline-flex;
  min-height: 36px;
  align-items: center;
  justify-content: center;
  gap: 7px;
  border: 0;
  border-radius: 7px;
  padding: 0 14px;
  background: transparent;
  color: #6c7789;
  cursor: pointer;
  font-size: 12px;
  font-weight: 800;
  white-space: nowrap;
}

.settings-segmented-control button:hover,
.settings-segmented-control button:focus-visible {
  color: #172033;
}

.settings-segmented-control button:focus-visible {
  outline: 2px solid rgba(31, 108, 255, .35);
  outline-offset: 1px;
}

.settings-segmented-control button.active {
  background: #fff;
  color: #172033;
  box-shadow: 0 2px 8px rgba(30, 39, 56, .1);
}

.settings-player-segments {
  width: min(440px, 100%);
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.settings-player-segments button {
  min-width: 0;
  padding-inline: 10px;
}

.settings-platform-note {
  margin: 0;
  border-top: 1px solid #edf0f5;
  padding-top: 20px;
  color: #7b8799;
  font-size: 12px;
}

.settings-shortcut-field {
  display: flex;
  align-items: center;
  gap: 7px;
  border-top: 1px solid #edf0f5;
  padding-top: 20px;
}

.settings-shortcut-field > div {
  display: grid;
  min-width: 0;
  flex: 1;
  gap: 5px;
}

.settings-shortcut-field strong { color: #11192b; font-size: 14px; font-weight: 800; }
.settings-shortcut-field span { color: #7b8799; font-size: 12px; line-height: 1.5; }
.settings-shortcut-field kbd {
  min-width: 34px;
  border: 1px solid #d8dee8;
  border-bottom-width: 2px;
  border-radius: 6px;
  padding: 6px 8px;
  background: #fff;
  color: #253148;
  box-shadow: 0 2px 5px rgba(30, 39, 56, .06);
  font: 700 11px/1 sans-serif;
  text-align: center;
}
.settings-shortcut-field b { color: #a1a9b5; font-size: 11px; }

.settings-select-control {
  width: 210px;
  height: 38px;
  flex: 0 0 auto;
  border: 1px solid #d9e0e9;
  border-radius: 8px;
  padding: 0 34px 0 12px;
  outline: none;
  background: #fff;
  color: #273349;
  font-size: 12px;
  font-weight: 750;
}

.settings-select-control:focus-visible {
  border-color: #8fb1f5;
  box-shadow: 0 0 0 3px rgba(31, 108, 255, .1);
}

.settings-output-mode-badge {
  display: inline-flex;
  min-height: 34px;
  flex: 0 0 auto;
  align-items: center;
  border-radius: 999px;
  padding: 0 14px;
  background: color-mix(in srgb, var(--app-accent) 11%, #f3f5f8);
  color: var(--app-accent);
  font-size: 12px;
  font-weight: 800;
}

.settings-cache-usage {
  display: grid;
  grid-template-columns: 1.25fr repeat(4, minmax(0, 1fr));
  border-block: 1px solid #e7ebf1;
  background: #f6f8fb;
}

.settings-cache-usage > div {
  display: grid;
  min-width: 0;
  gap: 5px;
  padding: 18px 20px;
}

.settings-cache-usage > div + div {
  border-left: 1px solid #e2e7ee;
}

.settings-cache-usage span,
.settings-cache-usage small {
  color: #7d8899;
  font-size: 11px;
}

.settings-cache-usage strong {
  overflow: hidden;
  color: #182237;
  font-size: 18px;
  font-variant-numeric: tabular-nums;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.settings-cache-total strong {
  color: #1769ff;
  font-size: 23px;
}
.background-cache-path { overflow-wrap: anywhere; }

.settings-cache-directory,
.settings-cache-clear {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  border-top: 1px solid #edf0f5;
  padding-top: 20px;
}

.settings-cache-copy,
.settings-cache-clear > div {
  display: grid;
  min-width: 180px;
  gap: 5px;
}

.settings-cache-copy strong,
.settings-cache-clear strong {
  color: #11192b;
  font-size: 14px;
  font-weight: 800;
}

.settings-cache-copy span,
.settings-cache-clear span {
  color: #7b8799;
  font-size: 12px;
  line-height: 1.5;
}

.settings-cache-directory-controls {
  display: flex;
  min-width: 0;
  flex: 1 1 540px;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
}

.settings-cache-directory-controls input {
  width: min(360px, 100%);
  min-width: 0;
  height: 42px;
  border: 1px solid #dfe5ed;
  border-radius: 8px;
  padding: 0 12px;
  outline: none;
  background: #f7f8fa;
  color: #667286;
  font-size: 12px;
  text-overflow: ellipsis;
}

.settings-cache-directory-controls .settings-action,
.settings-cache-clear .settings-action {
  flex: 0 0 auto;
  border-radius: 8px;
}

.settings-cache-status {
  margin: 0;
  border-top: 1px solid #edf0f5;
  padding-top: 18px;
  color: #29704e;
  font-size: 12px;
  font-weight: 700;
}

.settings-cache-status.error {
  color: #bf404a;
}

.settings-listening-summary {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  border-block: 1px solid #e7ebf1;
  background: #f6f8fb;
}

.settings-listening-summary > div {
  display: grid;
  min-width: 0;
  gap: 5px;
  padding: 18px 20px;
}

.settings-listening-summary > div + div {
  border-left: 1px solid #e2e7ee;
}

.settings-listening-summary span,
.settings-listening-summary small {
  color: #7d8899;
  font-size: 11px;
}

.settings-listening-summary strong {
  overflow: hidden;
  color: #182237;
  font-size: 20px;
  font-variant-numeric: tabular-nums;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.settings-qq-listening-body {
  display: grid;
  gap: 20px;
}
.settings-qq-account-picker {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  color: #4d5a70;
  font-size: 12px;
  font-weight: 750;
}
.settings-qq-date-range { font-size: 13px !important; }
.settings-qq-date-selectors input {
  box-sizing: border-box;
  width: 170px;
  height: 38px;
  border: 1px solid #d9e0e9;
  border-radius: 8px;
  padding: 0 11px;
  background: #fff;
  color: #273349;
  font: inherit;
  font-size: 12px;
}
.settings-qq-listening-empty {
  margin: 0;
  border-block: 1px solid #e7ebf1;
  padding: 24px 20px;
  background: #f6f8fb;
  color: #7d8899;
  font-size: 12px;
}

.settings-listening-retention {
  display: grid;
  gap: 18px;
}

.settings-listening-retention-heading,
.settings-listening-range-row,
.settings-listening-delete-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
}

.settings-listening-retention-heading > div:first-child {
  display: grid;
  gap: 5px;
}

.settings-listening-retention-heading strong {
  color: #11192b;
  font-size: 14px;
  font-weight: 800;
}

.settings-listening-retention-heading span,
.settings-listening-delete-row p,
.settings-listening-all-note {
  margin: 0;
  color: #7b8799;
  font-size: 12px;
  line-height: 1.5;
}

.settings-listening-mode {
  display: inline-grid;
  flex: 0 0 auto;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  border: 1px solid #dde4ed;
  border-radius: 8px;
  padding: 3px;
  background: #f2f4f7;
}

.settings-listening-mode button {
  min-width: 82px;
  height: 34px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: #6f7b8e;
  cursor: pointer;
  font-size: 12px;
  font-weight: 750;
}

.settings-listening-mode button:hover {
  color: #1769ff;
}

.settings-listening-mode button.active {
  background: #fff;
  color: #1769ff;
  box-shadow: 0 2px 8px rgba(28, 42, 66, .1);
}

.settings-listening-range-row {
  align-items: stretch;
  border-block: 1px solid #e8ecf2;
  padding-block: 18px;
}

.settings-listening-selectors {
  display: flex;
  align-items: flex-end;
  gap: 10px;
}

.settings-listening-selectors label {
  display: grid;
  gap: 6px;
}

.settings-listening-selectors label > span {
  color: #748196;
  font-size: 11px;
  font-weight: 700;
}

.settings-listening-selectors .settings-select-control {
  width: 128px;
}

.settings-listening-all-note {
  align-self: center;
  max-width: 390px;
}

.settings-listening-preview {
  display: grid;
  min-width: 250px;
  align-content: center;
  justify-items: end;
  gap: 5px;
  text-align: right;
}

.settings-listening-preview span {
  color: #7b8799;
  font-size: 11px;
}

.settings-listening-preview strong {
  color: #172033;
  font-size: 14px;
  font-weight: 850;
  font-variant-numeric: tabular-nums;
}

.settings-listening-delete-row p {
  max-width: 590px;
}

.settings-listening-delete-row .settings-action {
  flex: 0 0 auto;
  border-radius: 8px;
}

.duplicate-finder-backdrop {
  position: fixed;
  inset: 0;
  z-index: 420;
  display: grid;
  place-items: center;
  padding: 28px;
  background: rgba(18, 25, 37, .34);
  backdrop-filter: blur(8px);
}

.duplicate-finder-dialog {
  display: grid;
  width: min(900px, 100%);
  max-height: min(760px, calc(100vh - 56px));
  grid-template-rows: auto minmax(0, 1fr) auto;
  overflow: hidden;
  border: 1px solid rgba(219, 225, 233, .96);
  border-radius: 10px;
  background: #fff;
  box-shadow: 0 28px 80px rgba(20, 28, 42, .24);
  color: #11192b;
}

.duplicate-finder-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24px;
  border-bottom: 1px solid #edf0f4;
  padding: 22px 24px 18px;
}

.duplicate-finder-header > div { display: grid; gap: 5px; }
.duplicate-finder-header span { color: #9ba6b6; font-size: 9px; font-weight: 900; letter-spacing: 1.6px; }
.duplicate-finder-header h2 { margin: 0; color: #11192b; font-size: 23px; font-weight: 900; letter-spacing: 0; }
.duplicate-finder-header p { margin: 0; color: #748196; font-size: 12px; line-height: 1.6; }
.duplicate-finder-header > button { display: grid; width: 34px; height: 34px; flex: 0 0 auto; place-items: center; border: 1px solid #e0e5ec; border-radius: 50%; background: #fff; color: #6d7889; cursor: pointer; }
.duplicate-finder-header > button:hover:not(:disabled) { border-color: #cbd4df; color: #8f3032; }
.duplicate-finder-header > button:disabled { cursor: default; opacity: .45; }

.duplicate-finder-groups {
  min-height: 0;
  overflow: auto;
  padding: 0 24px;
}

.duplicate-finder-group { border-bottom: 1px solid #edf0f4; padding: 20px 0; }
.duplicate-finder-group:last-child { border-bottom: 0; }
.duplicate-finder-group > header { display: flex; align-items: center; justify-content: space-between; gap: 18px; margin-bottom: 12px; }
.duplicate-finder-group > header > div { display: grid; min-width: 0; gap: 3px; }
.duplicate-finder-group h3 { margin: 0; overflow: hidden; color: #182135; font-size: 15px; font-weight: 900; text-overflow: ellipsis; white-space: nowrap; }
.duplicate-finder-group header p { margin: 0; color: #758197; font-size: 12px; }
.duplicate-finder-group > header > span { flex: 0 0 auto; color: #8f3032; font-size: 11px; font-weight: 800; }
.duplicate-finder-list { display: grid; overflow: hidden; border: 1px solid #e8ebf0; border-radius: 8px; }
.duplicate-finder-track { display: grid; grid-template-columns: 24px minmax(0, 1fr) auto; align-items: center; gap: 12px; min-height: 70px; border-bottom: 1px solid #edf0f4; padding: 10px 12px; }
.duplicate-finder-track:last-child { border-bottom: 0; }
.duplicate-finder-track:hover { background: #f8fafc; }
.duplicate-finder-check { display: grid; width: 22px; height: 22px; place-items: center; cursor: pointer; }
.duplicate-finder-check input { position: absolute; opacity: 0; pointer-events: none; }
.duplicate-finder-check span { display: grid; width: 16px; height: 16px; place-items: center; border: 1px solid #cbd3df; border-radius: 4px; background: #fff; }
.duplicate-finder-check input:checked + span { border-color: #8f3032; background: #8f3032; }
.duplicate-finder-check input:checked + span::after { color: #fff; content: "✓"; font-size: 11px; font-weight: 900; }
.duplicate-finder-track-copy { display: grid; min-width: 0; gap: 4px; }
.duplicate-finder-track-copy strong { overflow: hidden; color: #202a3d; font-size: 12px; font-weight: 850; text-overflow: ellipsis; white-space: nowrap; }
.duplicate-finder-track-copy span { overflow: hidden; color: #5f6c80; font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }
.duplicate-finder-track-copy small { color: #98a1af; font-size: 10px; }
.duplicate-finder-track > button,.duplicate-finder-footer button { min-height: 34px; border: 1px solid #dce2e9; border-radius: 8px; padding: 0 13px; background: #fff; color: #354156; cursor: pointer; font-size: 11px; font-weight: 800; }
.duplicate-finder-track > button:hover:not(:disabled),.duplicate-finder-footer button:hover:not(:disabled) { border-color: #c8d1dc; color: #8f3032; }
.duplicate-finder-track > button:disabled,.duplicate-finder-footer button:disabled { cursor: default; opacity: .45; }
.duplicate-finder-empty { display: grid; min-height: 280px; place-content: center; justify-items: center; gap: 8px; padding: 32px; color: #8c97a8; text-align: center; }
.duplicate-finder-empty strong { color: #526075; font-size: 15px; }
.duplicate-finder-empty span { max-width: 430px; font-size: 12px; line-height: 1.6; }
.duplicate-finder-footer { display: flex; align-items: center; justify-content: space-between; gap: 18px; border-top: 1px solid #edf0f4; padding: 14px 24px; }
.duplicate-finder-footer > span { color: #7d899c; font-size: 11px; font-weight: 700; }
.duplicate-finder-footer > div { display: flex; align-items: center; gap: 9px; }
.duplicate-finder-footer button.primary { border-color: #151f31; background: #151f31; color: #fff; }
.duplicate-finder-footer button.primary:hover:not(:disabled) { border-color: #8f3032; background: #8f3032; color: #fff; }

@media (max-width: 720px) {
  .duplicate-finder-backdrop { padding: 12px; }
  .duplicate-finder-dialog { max-height: calc(100vh - 24px); }
  .duplicate-finder-header,.duplicate-finder-groups,.duplicate-finder-footer { padding-inline: 16px; }
  .duplicate-finder-track { grid-template-columns: 22px minmax(0, 1fr); }
  .duplicate-finder-track > button { grid-column: 2; justify-self: start; }
  .duplicate-finder-footer { align-items: stretch; flex-direction: column; }
  .duplicate-finder-footer > div { justify-content: flex-end; }
  .settings-toggle-field { align-items: stretch; flex-direction: column; }
  .settings-fade-controls { align-items: stretch; flex-direction: column; }
  .settings-fade-duration { grid-template-columns: auto minmax(80px, 1fr) 68px; }
  .settings-fade-slider { width: 100%; }
  .settings-fade-controls .settings-switch { align-self: flex-end; }
  .settings-select-control { width: 100%; }
  .settings-onboarding-button { width: 100%; }
  .settings-shortcut-field { align-items: flex-start; flex-wrap: wrap; }
  .settings-shortcut-field > div { flex-basis: 100%; }
  .settings-segmented-control { display: grid; width: 100%; grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .settings-segmented-control button { min-width: 0; padding-inline: 8px; white-space: normal; }
  .settings-cache-usage { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .settings-cache-usage > div:nth-child(odd) { border-left: 0; }
  .settings-cache-usage > div:nth-child(n + 3) { border-top: 1px solid #e2e7ee; }
  .settings-cache-directory,
  .settings-cache-clear { align-items: stretch; flex-direction: column; }
  .settings-cache-copy,
  .settings-cache-clear > div { min-width: 0; }
  .settings-cache-directory-controls { flex: 0 1 auto; flex-wrap: wrap; justify-content: flex-start; }
  .settings-cache-directory-controls input { width: 100%; flex-basis: 100%; }
  .settings-cache-clear .settings-action { align-self: flex-start; }
  .settings-listening-retention-heading,
  .settings-listening-range-row,
  .settings-listening-delete-row { align-items: stretch; flex-direction: column; }
  .settings-listening-mode { width: 100%; }
  .settings-listening-mode button { min-width: 0; }
  .settings-listening-preview { min-width: 0; justify-items: start; text-align: left; }
  .settings-listening-delete-row .settings-action { align-self: flex-start; }
}

@media (max-width: 460px) {
  .settings-cache-usage { grid-template-columns: 1fr; }
  .settings-cache-usage > div + div { border-left: 0; border-top: 1px solid #e2e7ee; }
  .settings-listening-summary { grid-template-columns: 1fr; }
  .settings-listening-summary > div + div { border-left: 0; border-top: 1px solid #e2e7ee; }
  .settings-listening-selectors { align-items: stretch; flex-direction: column; }
  .settings-listening-selectors .settings-select-control { width: 100%; }
  .settings-qq-account-picker { align-items: stretch; flex-direction: column; }
  .settings-qq-account-picker .settings-select-control,
  .settings-qq-date-selectors input { width: 100%; }
}

.settings-switch {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 9px;
  color: #5f6d82;
  cursor: pointer;
  font-size: 12px;
  font-weight: 800;
}

.settings-switch input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.settings-switch i {
  position: relative;
  width: 36px;
  height: 20px;
  border-radius: 999px;
  background: #cbd2dc;
  transition: background 160ms ease;
}

.settings-switch i::after {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 2px 5px rgba(23, 32, 51, .18);
  content: "";
  transition: transform 160ms ease;
}

.settings-switch input:checked + i {
  background: #1769ff;
}

.settings-switch input:checked + i::after {
  transform: translateX(16px);
}

.settings-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 12px;
}

.settings-library-field .settings-actions {
  flex: 0 1 auto;
  margin-left: auto;
}

.settings-action {
  display: inline-flex;
  min-height: 42px;
  align-items: center;
  justify-content: center;
  gap: 9px;
  border: 1px solid #dfe6ef;
  border-radius: 999px;
  padding: 0 18px;
  background: #fff;
  color: #172033;
  cursor: pointer;
  font-size: 13px;
  font-weight: 800;
  transition: border-color 160ms ease, color 160ms ease, background 160ms ease, transform 160ms ease;
}

.settings-action:hover {
  border-color: #b8c9ea;
  color: #1769ff;
  transform: translateY(-1px);
}

.settings-action:disabled {
  cursor: not-allowed;
  opacity: .48;
  transform: none;
}

.settings-action.primary {
  border-color: #11192b;
  background: #11192b;
  color: #fff;
}

.settings-action.primary:hover {
  border-color: #1769ff;
  background: #1769ff;
  color: #fff;
}

.settings-action.danger:hover {
  border-color: #efb7b7;
  background: #fff6f6;
  color: #d43f3f;
}

.settings-scan-toast {
  position: fixed;
  top: 24px;
  right: 24px;
  z-index: 120;
  display: grid;
  width: min(390px, calc(100vw - 48px));
  min-height: 64px;
  grid-template-columns: 28px minmax(0, 1fr);
  align-items: center;
  gap: 12px;
  border: 1px solid #dce6f5;
  border-radius: 8px;
  padding: 12px 15px;
  background: rgba(255, 255, 255, .97);
  color: #1769ff;
  box-shadow: 0 18px 42px rgba(31, 45, 70, .16);
  backdrop-filter: blur(18px);
}

.settings-scan-toast.error {
  border-color: #f0cccc;
  color: #c43f48;
}

.settings-scan-toast > div {
  display: grid;
  min-width: 0;
  gap: 4px;
}

.settings-scan-toast strong {
  color: #11192b;
  font-size: 13px;
  font-weight: 850;
}

.settings-scan-toast span {
  overflow: hidden;
  color: #657289;
  font-size: 12px;
  line-height: 1.45;
  text-overflow: ellipsis;
}

.is-spinning {
  animation: settings-scan-spin 900ms linear infinite;
}

.settings-toast-enter-active,
.settings-toast-leave-active {
  transition: opacity 180ms ease, transform 180ms ease;
}

.settings-toast-enter-from,
.settings-toast-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

@keyframes settings-scan-spin {
  to { transform: rotate(360deg); }
}

.local-home-page {
  display: grid;
  width: min(1180px, calc(100vw - 224px - 36px));
  max-width: none;
  margin: 18px 0 0 calc((100% - min(1180px, calc(100vw - 224px - 36px))) / 2);
  gap: 42px;
  color: #11192b;
  transition: width 280ms ease, margin-left 280ms ease;
}

.app-shell.is-sidebar-collapsed .local-home-page {
  width: min(1180px, calc(100vw - 36px));
  margin-left: calc((100% - min(1180px, calc(100vw - 36px))) / 2);
}

.local-empty-room {
  position: relative;
  display: grid;
  width: min(1180px, calc(100vw - 224px - 36px));
  max-width: none;
  margin: 0 0 0 calc((100% - min(1180px, calc(100vw - 224px - 36px))) / 2);
  align-content: start;
  gap: 42px;
  color: #10182b;
  transition: width 280ms ease, margin-left 280ms ease;
}

.app-shell.is-sidebar-collapsed .local-empty-room {
  width: min(1180px, calc(100vw - 36px));
  margin-left: calc((100% - min(1180px, calc(100vw - 36px))) / 2);
}

.local-empty-header {
  min-height: 118px;
}

.local-empty-card {
  position: relative;
  display: grid;
  min-height: 520px;
  place-items: center;
  overflow: hidden;
  border: 1px solid rgba(226, 232, 240, .9);
  border-radius: 20px;
  background:
    linear-gradient(135deg, rgba(213, 226, 255, .7) 0%, rgba(255, 255, 255, .96) 27%),
    linear-gradient(315deg, rgba(210, 244, 239, .72) 0%, rgba(255, 255, 255, .96) 31%),
    #fff;
  box-shadow: 0 32px 65px rgba(31, 39, 56, .1);
}

.local-empty-content {
  position: relative;
  z-index: 1;
  display: grid;
  width: min(100%, 560px);
  justify-items: center;
  margin-top: 4px;
  text-align: center;
}

.local-empty-icon {
  display: grid;
  width: 74px;
  height: 74px;
  place-items: center;
  border: 1px solid #aecaef;
  border-radius: 22px;
  background: linear-gradient(135deg, #e7f0ff, #e0f6f2);
  color: #2872ff;
  font-size: 34px;
  box-shadow: 0 18px 40px rgba(42, 91, 150, .13);
}

.local-empty-kicker {
  margin: 30px 0 12px;
  color: #63708a;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 6px;
}

.local-empty-content h1 {
  margin: 0 0 18px;
  color: #10182b;
  font-size: clamp(34px, 4vw, 46px);
  font-weight: 800;
  line-height: 1.1;
}

.local-empty-description {
  max-width: 530px;
  margin: 0 0 34px;
  color: #54627b;
  font-size: 14px;
  line-height: 1.8;
}

.local-empty-action {
  display: inline-flex;
  min-height: 48px;
  align-items: center;
  justify-content: center;
  gap: 10px;
  border: 0;
  border-radius: 999px;
  padding: 0 30px;
  background: #11192b;
  color: #fff;
  box-shadow: 0 18px 40px rgba(17, 25, 43, .2);
  cursor: pointer;
  font-size: 14px;
  font-weight: 800;
  transition: transform 180ms ease, box-shadow 180ms ease, background 180ms ease;
}

.local-empty-action:hover {
  background: #1769ff;
  box-shadow: 0 20px 42px rgba(23, 105, 255, .22);
  transform: translateY(-1px);
}

.local-empty-message {
  min-height: 18px;
  margin: 16px 0 0;
  color: #64718b;
  font-size: 12px;
  font-weight: 700;
}

.local-empty-message.error {
  color: #bf4a4a;
}

.local-empty-features {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 10px;
  margin-top: 30px;
}

.local-empty-features span {
  display: inline-flex;
  min-height: 34px;
  align-items: center;
  justify-content: center;
  border: 1px solid #e4e9f0;
  border-radius: 999px;
  padding: 0 14px;
  background: rgba(255, 255, 255, .78);
  color: #6a768c;
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
}

.local-home-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 32px;
  min-height: 118px;
}

.local-home-header > div {
  min-width: 0;
  flex: 1 1 auto;
}

.local-home-date {
  margin: 0 0 10px;
  color: #64718b;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 1px;
}

.local-home-greeting {
  margin: 0 0 7px;
  color: #10182b;
  font-size: clamp(34px, 4vw, 52px);
  font-weight: 800;
  line-height: 1.08;
}

.local-home-subtitle {
  margin: 0;
  color: #6b7890;
  font-size: 13px;
}

.local-home-random {
  display: grid;
  flex: 0 0 218px;
  width: 218px;
  min-width: 218px;
  max-width: 218px;
  min-height: 68px;
  max-height: 68px;
  grid-template-columns: 46px minmax(0, 1fr) 18px;
  align-items: center;
  gap: 12px;
  border: 1px solid #e6e9ef;
  border-radius: 999px;
  padding: 10px 15px 10px 11px;
  background: #fff;
  color: #11192b;
  box-shadow: 0 12px 28px rgba(31, 39, 56, .09);
  cursor: pointer;
  text-align: left;
}

.local-home-random:hover {
  border-color: #cbd2df;
  box-shadow: 0 16px 34px rgba(31, 39, 56, .13);
}

.local-home-random-icon {
  display: grid;
  width: 46px;
  height: 46px;
  place-items: center;
  border-radius: 50%;
  background: #11192b;
  color: #fff;
  font-size: 22px;
}

.local-home-random > span:nth-child(2) {
  display: grid;
  min-width: 0;
  gap: 4px;
}

.local-home-random strong { font-size: 13px; }
.local-home-random small { color: #748097; font-size: 10px; white-space: nowrap; }
.local-home-random-arrow { color: #748097; font-size: 14px; }

.local-home-last-played {
  --home-accent-primary: #dfe7ef;
  --home-accent-secondary: #b8c7d8;
  --home-cover-image: none;
  position: relative;
  display: grid;
  min-height: 408px;
  grid-template-columns: minmax(0, 1.15fr) minmax(280px, .85fr);
  align-items: center;
  overflow: hidden;
  border: 1px solid #e5e7ec;
  border-radius: 20px;
  padding: 42px 52px;
  background: linear-gradient(112deg, #fff 0%, color-mix(in srgb, var(--home-accent-primary) 18%, #fff) 56%, color-mix(in srgb, var(--home-accent-secondary) 42%, #fff) 100%);
  box-shadow: 0 22px 48px rgba(43, 50, 67, .11);
  isolation: isolate;
  width: 100%;
}

.local-home-last-played::before {
  position: absolute;
  inset: -48px -52px -48px 48%;
  z-index: 0;
  background-image: var(--home-cover-image);
  background-position: center;
  background-size: cover;
  content: "";
  filter: blur(48px) saturate(1.16);
  opacity: .48;
  pointer-events: none;
  transform: scale(1.08);
}

.local-home-last-played::after {
  position: absolute;
  inset: 0;
  z-index: 0;
  background: linear-gradient(90deg, rgba(255,255,255,.98) 0%, rgba(255,255,255,.92) 38%, rgba(255,255,255,.54) 68%, rgba(255,255,255,.18) 100%);
  content: "";
  pointer-events: none;
}

.local-home-last-copy {
  position: relative;
  z-index: 2;
  min-width: 0;
  max-width: 610px;
}

.local-home-last-label {
  display: inline-flex;
  align-items: center;
  min-height: 34px;
  border: 1px solid #a9c5ff;
  border-radius: 999px;
  padding: 0 15px;
  background: #edf3ff;
  color: #3975e8;
  font-size: 11px;
  font-weight: 700;
}

.local-home-track-title {
  max-width: 640px;
  margin: 20px 0 8px;
  overflow: hidden;
  color: #10182b;
  font-size: clamp(30px, 4vw, 48px);
  font-weight: 800;
  line-height: 1.15;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.local-home-track-artist {
  max-width: 620px;
  margin: 0 0 14px;
  overflow: hidden;
  color: #3f485c;
  font-size: 15px;
  font-weight: 700;
  line-height: 1.45;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.local-home-track-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  color: #708099;
  font-size: 11px;
  white-space: nowrap;
}

.local-home-track-meta i { color: #b2b8c4; font-style: normal; }

.local-home-progress {
  width: min(100%, 460px);
  margin-top: 30px;
}

.local-home-progress-track {
  position: relative;
  height: 5px;
  border-radius: 999px;
  background: #daddE4;
}

.local-home-progress-track span { display: block; height: 100%; border-radius: inherit; background: linear-gradient(90deg, #2f6df6, #14a88d); }
.local-home-progress-input {
  position: absolute;
  inset: -8px 0;
  width: 100%;
  height: 21px;
  margin: 0;
  appearance: none;
  background: transparent;
  cursor: pointer;
  opacity: 0;
}
.local-home-progress-track:has(.local-home-progress-input:focus-visible) { box-shadow: 0 0 0 3px rgba(47,109,246,.18); }
.local-home-progress-times { display: flex; justify-content: space-between; margin-top: 8px; color: #66738a; font-size: 10px; }

.local-home-controls {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 28px;
}

.local-home-controls button {
  display: grid;
  width: 46px;
  height: 46px;
  place-items: center;
  border: 1px solid #d9dde5;
  border-radius: 50%;
  background: rgba(255, 255, 255, .84);
  color: #20283a;
  cursor: pointer;
}

.local-home-controls button:hover { border-color: #aeb8ca; color: #3975e8; }
.local-home-controls .local-home-play { width: 56px; height: 56px; border-color: #11192b; background: #11192b; color: #fff; box-shadow: 0 12px 24px rgba(17, 25, 43, .22); }
.local-home-controls .local-home-play:hover { border-color: #3975e8; background: #3975e8; color: #fff; }
.local-home-controls .local-home-shuffle { display: flex; width: auto; min-width: 118px; border-radius: 999px; padding: 0 18px; gap: 8px; font-size: 12px; white-space: nowrap; }
.local-home-play .play-icon { width: 0; height: 0; margin-left: 4px; border-top: 8px solid transparent; border-bottom: 8px solid transparent; border-left: 12px solid currentColor; }
.local-home-play .pause-icon { width: 12px; height: 17px; border-right: 4px solid currentColor; border-left: 4px solid currentColor; }

.local-home-cover-wrap {
  position: relative;
  z-index: 1;
  justify-self: center;
  width: min(25vw, 290px);
  min-width: 220px;
  transform: rotate(-2deg);
}

.local-home-cover-wrap::after {
  position: absolute;
  inset: 18px -18px -18px 18px;
  z-index: -1;
  border-radius: 16px;
  background: rgba(50, 59, 76, .12);
  content: "";
}

.local-home-cover {
  display: grid;
  width: 100%;
  aspect-ratio: 1;
  place-items: center;
  overflow: hidden;
  border: 5px solid #111;
  border-radius: 16px;
  color: #fff;
  font-size: 62px;
  font-weight: 800;
  box-shadow: 0 18px 35px rgba(35, 39, 49, .18);
}

.local-home-cover img { width: 100%; height: 100%; object-fit: cover; }
.local-home-format-badge { position: absolute; top: 12px; left: 12px; z-index: 2; border-radius: 6px; padding: 5px 8px; background: rgba(255,255,255,.94); color: #1b2334; font-size: 10px; font-weight: 800; }

.local-home-stats-panel {
  display: grid;
  width: 100%;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  overflow: hidden;
  border: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
}

.local-home-stat {
  display: grid;
  min-height: 116px;
  align-content: center;
  gap: 7px;
  padding: 0 42px;
}

.local-home-stat + .local-home-stat {
  border-left: 1px solid #edf0f4;
}

.local-home-stat strong {
  overflow: hidden;
  color: #10182b;
  font-size: clamp(28px, 3.3vw, 40px);
  font-weight: 900;
  line-height: 1;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.local-home-stat span {
  color: #62708a;
  font-size: 12px;
  font-weight: 800;
}

.local-home-recent-panel {
  display: grid;
  width: 100%;
  gap: 20px;
  background: transparent;
}

.local-home-section-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24px;
}

.local-home-section-heading h3 {
  margin: 0 0 8px;
  color: #10182b;
  font-size: 22px;
  font-weight: 900;
  line-height: 1.12;
}

.local-home-section-heading p {
  margin: 0;
  color: #6b7890;
  font-size: 12px;
  font-weight: 700;
}

.local-home-section-heading button {
  display: inline-flex;
  min-height: 34px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: 1px solid #e3e8ef;
  border-radius: 999px;
  padding: 0 15px;
  background: rgba(255, 255, 255, .86);
  color: #10182b;
  box-shadow: 0 10px 24px rgba(31, 39, 56, .07);
  cursor: pointer;
  font-size: 12px;
  font-weight: 800;
}

.local-home-section-heading button:hover {
  border-color: #cbd3df;
  color: #8f1d2e;
}

.local-home-recent-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(154px, 180px));
  gap: 22px;
}

.local-home-recent-card {
  display: grid;
  min-width: 0;
  gap: 9px;
  border: 0;
  padding: 0;
  background: transparent;
  color: #10182b;
  cursor: pointer;
  text-align: left;
}

.local-home-recent-card:hover .local-home-recent-cover {
  transform: translateY(-2px);
  box-shadow: 0 16px 28px rgba(25, 31, 45, .18);
}

.local-home-recent-cover {
  position: relative;
  display: grid;
  width: 100%;
  aspect-ratio: 1;
  place-items: center;
  overflow: hidden;
  border: 4px solid #111;
  border-radius: 8px;
  color: #fff;
  font-size: 42px;
  font-weight: 900;
  box-shadow: 0 10px 20px rgba(25, 31, 45, .14);
  transition: transform 180ms ease, box-shadow 180ms ease;
}

.local-home-recent-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.local-home-recent-cover i {
  position: absolute;
  top: 9px;
  left: 9px;
  border-radius: 999px;
  padding: 5px 9px;
  background: rgba(255, 255, 255, .94);
  color: #10182b;
  font-size: 10px;
  font-style: normal;
  font-weight: 900;
  line-height: 1;
}

.local-home-recent-card strong,
.local-home-recent-card small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.local-home-recent-card strong {
  color: #10182b;
  font-size: 13px;
  font-weight: 900;
}

.local-home-recent-card small {
  color: #6b7890;
  font-size: 11px;
  font-weight: 700;
}

.local-featured-albums {
  display: grid;
  width: 100%;
  gap: 20px;
  background: transparent;
}

.local-album-row,
.local-album-grid {
  display: grid;
  gap: 22px;
}

.local-album-row {
  grid-template-columns: repeat(2, minmax(180px, 220px));
}

.local-album-grid {
  grid-template-columns: repeat(auto-fill, minmax(170px, 220px));
}

.local-albums-page {
  display: grid;
  gap: 22px;
}

.local-album-detail-page {
  display: grid;
  width: min(1288px, calc(100vw - 224px - 36px));
  margin: 0 0 40px calc((100% - min(1288px, calc(100vw - 224px - 36px))) / 2);
  gap: 28px;
  color: #10182b;
  transition: width 280ms ease, margin-left 280ms ease;
}

.app-shell.is-sidebar-collapsed .local-album-detail-page {
  width: min(1288px, calc(100vw - 36px));
  margin-left: calc((100% - min(1288px, calc(100vw - 36px))) / 2);
}

.local-album-detail-header { display: flex; align-items: center; justify-content: space-between; gap: 28px; }
.local-album-detail-title-row { display: flex; min-width: 0; align-items: center; gap: 14px; }
.local-album-detail-back { display: inline-flex; height: 38px; flex: 0 0 auto; align-items: center; gap: 6px; border: 1px solid #dce2e9; border-radius: 999px; padding: 0 14px; background: rgba(255,255,255,.9); color: #2468d8; cursor: pointer; font-size: 12px; font-weight: 750; box-shadow: 0 8px 22px rgba(29,42,61,.06); }
.local-album-detail-back:hover { border-color: #b8cae6; background: #fff; }
.local-album-detail-title-row h1 { min-width: 0; margin: 0; overflow: hidden; color: #10182b; font-size: clamp(28px,3vw,36px); font-weight: 950; letter-spacing: 0; line-height: 1.1; text-overflow: ellipsis; white-space: nowrap; }
.local-album-detail-title-row > span { flex: 0 0 auto; color: #718096; font-size: 12px; font-weight: 700; }
.local-album-detail-tools { display: flex; min-width: min(500px,42vw); align-items: center; justify-content: flex-end; gap: 12px; }
.local-album-filter { position: relative; flex: 0 0 auto; }
.local-album-filter summary { display: inline-flex; height: 38px; align-items: center; gap: 7px; border: 1px solid transparent; border-radius: 999px; padding: 0 15px; background: rgba(255,255,255,.9); color: #263247; cursor: pointer; font-size: 11px; font-weight: 750; box-shadow: 0 12px 28px rgba(32,45,62,.07); list-style: none; }
.local-album-filter summary::-webkit-details-marker { display: none; }
.local-album-filter[open] summary { border-color: #dce2e9; background: #fff; }
.local-album-filter-panel { position: absolute; top: calc(100% + 8px); right: 0; z-index: 15; width: 190px; border: 1px solid #e1e6ec; border-radius: 8px; padding: 12px; background: rgba(255,255,255,.98); box-shadow: 0 16px 36px rgba(28,39,55,.15); }
.local-album-filter-panel label { display: grid; gap: 7px; color: #748095; font-size: 10px; font-weight: 750; }
.local-album-filter-panel select { width: 100%; height: 34px; border: 1px solid #dce2e9; border-radius: 7px; padding: 0 9px; outline: 0; background: #fff; color: #283448; font: inherit; font-size: 12px; }
.local-album-search { display: flex; width: min(390px,32vw); height: 40px; align-items: center; gap: 9px; border: 1px solid rgba(225,229,235,.82); border-radius: 999px; padding: 0 16px; background: rgba(255,255,255,.9); color: #a2abb6; box-shadow: 0 14px 32px rgba(31,44,61,.07); }
.local-album-search input { width: 100%; min-width: 0; border: 0; outline: 0; background: transparent; color: #243044; font: inherit; font-size: 12px; }
.local-album-search input::placeholder { color: #aab2bd; }
.local-album-detail-actions { display: flex; align-items: center; gap: 10px; }
.local-album-detail-actions button { display: inline-flex; height: 38px; align-items: center; gap: 7px; border: 1px solid #d8dee7; border-radius: 999px; padding: 0 16px; background: rgba(255,255,255,.88); color: #263247; cursor: pointer; font: inherit; font-size: 12px; font-weight: 750; }
.local-album-detail-actions button:hover:not(:disabled) { border-color: #b9c7dc; background: #fff; color: #176f67; }
.local-album-detail-actions button:disabled { cursor: default; opacity: .45; }
.local-album-track-table { overflow: hidden; border: 1px solid #e3e6eb; border-radius: 12px; background: var(--app-card-background); box-shadow: var(--app-card-shadow); }
.local-album-track-head,.local-album-track-row { display: grid; grid-template-columns: 48px minmax(260px,1fr) minmax(190px,280px) 110px; align-items: center; gap: 14px; }
.local-album-track-head { min-height: 42px; padding: 0 16px; border-bottom: 1px solid #e8e9ec; color: #7c8798; font-size: 11px; font-weight: 800; }
.local-album-track-head span:first-child { text-align: center; }
.local-album-track-head span:nth-child(3),.local-album-track-head span:nth-child(4) { color: #6b7280; font-size: 13px; font-weight: 500; }
.local-album-track-head span:nth-child(4) { text-align: right; }
.local-album-track-list { display: grid; }
.local-album-track-row { width: 100%; min-height: 64px; border: 0; border-bottom: 1px solid #eeeff1; padding: 8px 16px; background: var(--app-card-background); color: inherit; cursor: pointer; text-align: left; transition: background 150ms ease,box-shadow 150ms ease; }
.local-album-track-row:last-child { border-bottom: 0; }
.local-album-track-row:hover { background: rgba(248,249,251,.88); }
.local-album-track-row.active { background: var(--app-playing-background); box-shadow: inset 0 0 0 1px rgba(101,78,156,.12); }
.local-album-track-status { display: grid; place-items: center; color: #8a95a5; font-size: 11px; font-weight: 700; }
.local-album-track-status.current { color: #148f80; }
.local-album-track-main { display: flex; min-width: 0; align-items: center; gap: 13px; }
.local-album-track-cover { display: grid; width: 42px; height: 42px; flex: 0 0 auto; place-items: center; overflow: hidden; border-radius: 7px; color: #fff; font-size: 13px; font-weight: 800; box-shadow: 0 7px 16px rgba(28,38,52,.12); }
.local-album-track-cover img { width: 100%; height: 100%; object-fit: cover; }
.local-album-track-copy { display: grid; min-width: 0; gap: 4px; }
.local-album-track-copy strong,.local-album-track-copy small,.local-album-track-album { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.local-album-track-copy strong { color: #121a2a; font-size: 13px; font-weight: 850; }
.local-album-track-copy small { color: #7c889b; font-size: 11px; font-weight: 600; }
.local-album-track-album,.local-album-track-duration strong { color: #5f5d59; font-size: 13px; font-weight: 500; }
.local-album-track-duration { display: grid; justify-items: end; gap: 4px; }
.local-album-track-duration small { color: #9aa3b0; font-size: 10px; white-space: nowrap; }
.local-album-track-empty { padding: 70px 20px; color: #8792a2; font-size: 12px; text-align: center; }

@media (max-width: 980px) {
  .local-album-detail-page { width: min(1288px, calc(100vw - 72px - 36px)); margin-left: calc((100% - min(1288px, calc(100vw - 72px - 36px))) / 2); }
  .app-shell.is-sidebar-collapsed .local-album-detail-page { width: min(1288px, calc(100vw - 36px)); margin-left: calc((100% - min(1288px, calc(100vw - 36px))) / 2); }
  .local-album-detail-header { align-items: stretch; flex-direction: column; gap: 20px; }
  .local-album-detail-tools { width: 100%; min-width: 0; justify-content: flex-start; }
  .local-album-search { width: min(430px,100%); flex: 1; }
}

@media (max-width: 620px) {
  .local-album-detail-title-row { align-items: flex-start; flex-wrap: wrap; }
  .local-album-detail-title-row h1 { width: calc(100% - 110px); white-space: normal; }
  .local-album-detail-title-row > span { width: 100%; padding-left: 2px; }
  .local-album-detail-tools { flex-wrap: wrap; }
  .local-album-search { flex-basis: 100%; }
  .local-album-detail-actions button { flex: 1; justify-content: center; }
  .local-album-track-head,.local-album-track-row { grid-template-columns: 44px minmax(0,1fr) 84px; gap: 9px; padding-inline: 10px; }
  .local-album-track-head span:nth-child(3),.local-album-track-album { display: none; }
}

.local-folders-page { display: grid; gap: 28px; }
.local-folders-header { display: flex; min-height: 58px; align-items: center; justify-content: space-between; gap: 24px; }
.local-folders-title { display: flex; align-items: baseline; gap: 14px; }
.local-folders-title h1,.local-folder-detail-heading h1 { margin: 0; color: #10182b; font-size: 34px; font-weight: 850; line-height: 1.1; }
.local-folders-title span,.local-folder-detail-heading span { color: #8090a6; font-size: 12px; }
.local-folder-search { display: grid; width: min(390px,40vw); height: 42px; grid-template-columns: 18px minmax(0,1fr); align-items: center; gap: 9px; border-radius: 21px; padding: 0 16px; background: #fff; color: #9ba5af; box-shadow: 0 10px 28px rgba(31,45,61,.08); }
.local-folder-search input { width: 100%; min-width: 0; border: 0; outline: 0; background: transparent; color: #253044; font-size: 12px; }
.local-folder-search input::placeholder { color: #a7afb8; }
.local-folder-grid { display: grid; grid-template-columns: repeat(auto-fill,minmax(180px,220px)); gap: 22px; align-items: start; }
.local-folder-card { display: grid; min-width: 0; gap: 11px; border: 1px solid #e3e7eb; border-radius: 8px; padding: 12px; background: #fff; color: #10182b; cursor: pointer; text-align: left; box-shadow: 0 8px 22px rgba(30,42,56,.06); transition: transform 180ms ease,box-shadow 180ms ease,border-color 180ms ease; }
.local-folder-card:hover { border-color: #d5dde2; transform: translateY(-4px); box-shadow: 0 18px 34px rgba(30,42,56,.14); }
.local-folder-cover { display: grid; width: 100%; aspect-ratio: 1; place-items: center; overflow: hidden; border-radius: 6px; color: #fff; box-shadow: inset 0 0 0 1px rgba(255,255,255,.24); }
.local-folder-cover img { width: 100%; height: 100%; object-fit: cover; }
.local-folder-placeholder { display: grid; width: 58px; height: 48px; place-items: center; border: 1px solid rgba(255,255,255,.46); border-radius: 6px; background: rgba(255,255,255,.14); font-size: 24px; font-weight: 850; backdrop-filter: blur(8px); }
.local-folder-card-copy { display: grid; min-width: 0; gap: 5px; padding: 1px 2px 3px; }
.local-folder-card-copy strong,.local-folder-card-copy small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.local-folder-card-copy strong { font-size: 14px; font-weight: 800; }
.local-folder-card-copy small { color: #8290a2; font-size: 11px; }
.local-folder-empty { display: grid; min-height: 260px; place-items: center; align-content: center; gap: 8px; color: #8a97a5; text-align: center; }
.local-folder-empty strong { color: #344052; font-size: 16px; }
.local-folder-empty span { font-size: 12px; }
.local-folder-empty button { margin-top: 8px; border: 1px solid #d9e2e7; border-radius: 8px; padding: 8px 13px; background: #fff; color: #2c4651; cursor: pointer; }
.local-folder-empty button:hover { border-color: #20b982; color: #12865c; }
.local-folder-detail-heading { display: grid; min-width: 0; grid-template-columns: auto auto minmax(0,1fr); align-items: center; gap: 12px; }
.local-folder-detail-heading>div { display: flex; align-items: baseline; gap: 12px; }
.local-folder-detail-heading p { min-width: 0; margin: 0 0 0 8px; overflow: hidden; color: #98a2ae; font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }
.local-folder-back { border: 1px solid #dce3e7; border-radius: 8px; padding: 7px 10px; background: #fff; color: #50606c; cursor: pointer; font-size: 11px; }
.local-folder-back:hover { border-color: #b9dacc; color: #12865c; }
.local-folder-detail { display: grid; gap: 0; overflow: hidden; border: 1px solid #e6e7ea; border-radius: 14px; background: var(--app-card-background); box-shadow: var(--app-card-shadow); }
.local-folder-track-header,.local-folder-track-list>button { display: grid; grid-template-columns: 42px minmax(240px,1.6fr) minmax(160px,1fr) 64px; align-items: center; gap: 12px; }
.local-folder-track-header { height: 38px; border-bottom: 1px solid #e1e6e9; padding: 0 14px; color: #8591a0; font-size: 10px; }
.local-folder-track-list { display: grid; }
.local-folder-track-list>button { min-height: 64px; border: 0; border-bottom: 1px solid #edf0f2; border-radius: 6px; padding: 7px 14px; background: var(--app-card-background); color: #263244; cursor: pointer; text-align: left; transition: background-color 150ms ease,color 150ms ease; }
.local-folder-track-list>button:hover { background: #f3f6f6; }
.local-folder-track-list>button.active { background: var(--app-playing-background); color: #725f3c; }
.local-folder-track-index { color: #8d98a5; font-size: 11px; }
.local-folder-track-title { display: grid; min-width: 0; grid-template-columns: 42px minmax(0,1fr); align-items: center; gap: 11px; }
.local-folder-track-title>span:last-child { display: grid; min-width: 0; gap: 4px; }
.local-folder-track-title strong,.local-folder-track-title small,.local-folder-track-album { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.local-folder-track-title strong { font-size: 12px; }
.local-folder-track-title small,.local-folder-track-album,.local-folder-track-duration { color: #7f8b99; font-size: 10px; }
.local-folder-track-cover { display: grid; width: 42px; height: 42px; place-items: center; overflow: hidden; border-radius: 6px; color: #fff; font-size: 12px; font-weight: 800; }
.local-folder-track-cover img { width: 100%; height: 100%; object-fit: cover; }
.local-folder-track-duration { text-align: right; }

.local-album-card {
  display: grid;
  min-width: 0;
  gap: 10px;
  border: 0;
  padding: 0;
  background: transparent;
  color: #10182b;
  cursor: pointer;
  text-align: left;
}

.local-album-card:hover .local-album-cover {
  transform: translateY(-4px);
  box-shadow: 0 18px 34px rgba(25, 31, 45, .2);
}

.local-album-cover {
  position: relative;
  display: grid;
  width: 100%;
  aspect-ratio: 1;
  place-items: center;
  overflow: hidden;
  border: 4px solid #111;
  border-radius: 8px;
  color: #fff;
  font-size: 48px;
  font-weight: 900;
  box-shadow: 0 13px 26px rgba(25, 31, 45, .15);
  transition: transform 180ms ease, box-shadow 180ms ease;
}

.local-album-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.local-album-card strong,
.local-album-card small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.local-album-card strong {
  color: #10182b;
  font-size: 14px;
  font-weight: 900;
}

.local-album-card small {
  color: #64728c;
  font-size: 12px;
  font-weight: 700;
}

.local-listening-footprints {
  display: grid;
  width: 100%;
  gap: 20px;
  background: transparent;
}

.local-listening-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24px;
}

.local-listening-heading h3 {
  margin: 0 0 8px;
  color: #10182b;
  font-size: 22px;
  font-weight: 900;
  line-height: 1.12;
}

.local-listening-heading p {
  margin: 0;
  color: #6b7890;
  font-size: 12px;
  font-weight: 700;
}

.local-listening-heading button {
  display: inline-flex;
  min-height: 34px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: 1px solid #e3e8ef;
  border-radius: 999px;
  padding: 0 15px;
  background: rgba(255, 255, 255, .86);
  color: #10182b;
  box-shadow: 0 10px 24px rgba(31, 39, 56, .07);
  cursor: pointer;
  font-size: 12px;
  font-weight: 800;
}

.local-listening-heading button:hover {
  border-color: #cbd3df;
  color: #8f1d2e;
}

.local-listening-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.18fr) minmax(330px, .82fr);
  gap: 24px;
}

.local-top-tracks-card,
.local-calendar-card {
  min-height: 380px;
  border: 1px solid rgba(226, 232, 240, .9);
  border-radius: 20px;
  background: rgba(255, 255, 255, .82);
  box-shadow: 0 22px 48px rgba(43, 50, 67, .1);
}

.local-top-tracks-card {
  display: grid;
  align-content: start;
  gap: 24px;
  padding: 28px 26px 30px;
}

.local-top-tracks-card > header,
.local-calendar-card > header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
}

.local-top-tracks-card > header strong,
.local-calendar-card > header > strong {
  color: #64728c;
  font-size: 11px;
  font-weight: 900;
  letter-spacing: 5px;
}

.local-top-tracks-card > header span {
  color: #65738b;
  font-size: 12px;
  font-weight: 700;
}

.local-top-tracks-list {
  display: grid;
  gap: 18px;
}

.local-top-track-row {
  display: grid;
  grid-template-columns: 42px 54px minmax(0, 1fr) auto;
  align-items: center;
  gap: 14px;
  border: 0;
  padding: 0;
  background: transparent;
  color: #10182b;
  cursor: pointer;
  text-align: left;
}

.local-top-track-row:hover .local-top-track-copy strong {
  color: #8f1d2e;
}

.local-top-track-rank {
  color: #2362d2;
  font-size: 22px;
  font-weight: 900;
  line-height: 1;
}

.local-top-track-cover {
  display: grid;
  width: 54px;
  height: 54px;
  place-items: center;
  overflow: hidden;
  border-radius: 8px;
  color: #fff;
  font-size: 18px;
  font-weight: 900;
  box-shadow: 0 10px 20px rgba(31, 43, 67, .13);
}

.local-top-track-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.local-top-track-copy {
  display: grid;
  min-width: 0;
  gap: 5px;
}

.local-top-track-copy strong,
.local-top-track-copy small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.local-top-track-copy strong {
  color: #10182b;
  font-size: 13px;
  font-weight: 900;
}

.local-top-track-copy small {
  color: #64728c;
  font-size: 11px;
  font-weight: 700;
}

.local-top-track-copy i {
  display: block;
  width: min(100%, 300px);
  height: 4px;
  overflow: hidden;
  border-radius: 999px;
  background: #e4e9ee;
}

.local-top-track-copy b {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #2362d2, #1497ac);
}

.local-top-track-meta {
  color: #53637e;
  font-size: 12px;
  font-weight: 800;
  white-space: nowrap;
}

.local-listening-empty {
  display: grid;
  min-height: 210px;
  place-items: center;
  margin: 0;
  color: #77849b;
  font-size: 13px;
  font-weight: 700;
}

.local-calendar-card {
  display: grid;
  grid-template-rows: auto auto 1fr auto;
  gap: 18px;
  padding: 28px 26px 24px;
}

.local-calendar-controls {
  display: inline-flex;
  align-items: center;
  gap: 15px;
  color: #10182b;
  font-size: 13px;
  font-weight: 900;
}

.local-calendar-controls button {
  display: grid;
  width: 30px;
  height: 30px;
  place-items: center;
  border: 1px solid #e5e9ef;
  border-radius: 50%;
  background: rgba(255, 255, 255, .88);
  color: #6e7a90;
  cursor: pointer;
  font-size: 18px;
}

.local-calendar-controls button:hover {
  border-color: #cdd5e1;
  color: #8f1d2e;
}

.local-calendar-weekdays,
.local-calendar-days {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 7px;
}

.local-calendar-weekdays span {
  color: #586981;
  font-size: 11px;
  font-weight: 900;
  text-align: center;
}

.local-calendar-days button {
  display: grid;
  min-height: 48px;
  place-items: center;
  border: 1px solid transparent;
  border-radius: 9px;
  background: #f4f6f8;
  color: #65738b;
  cursor: pointer;
  font-size: 12px;
  font-weight: 800;
}

.local-calendar-days button:hover:not(:disabled) {
  border-color: #a8c4ff;
  color: #1e63e9;
}

.local-calendar-days button.is-blank {
  background: transparent;
  cursor: default;
}

.local-calendar-days button.is-selected {
  border-color: #2563eb;
  box-shadow: inset 0 0 0 1px #2563eb;
}

.local-calendar-days button.heat-1 { background: #eaf0ff; }
.local-calendar-days button.heat-2 { background: #d8e4ff; }
.local-calendar-days button.heat-3 { background: #abc4ff; color: #17335f; }
.local-calendar-days button.heat-4 { background: #6f99f6; color: #fff; }
.local-calendar-days button.heat-5 { background: #2563eb; color: #fff; }

.local-calendar-card footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  color: #61708a;
  font-size: 11px;
  font-weight: 800;
}

.local-calendar-card footer strong {
  color: #53637e;
  font-size: 12px;
}

.local-calendar-card footer > span {
  margin-left: auto;
  color: #7e8aa0;
}

.local-calendar-card footer i {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.local-calendar-card footer i b {
  width: 10px;
  height: 10px;
  border-radius: 3px;
}

.local-calendar-card footer i b:nth-child(1) { background: #eaf0ff; }
.local-calendar-card footer i b:nth-child(2) { background: #d8e4ff; }
.local-calendar-card footer i b:nth-child(3) { background: #abc4ff; }
.local-calendar-card footer i b:nth-child(4) { background: #6f99f6; }
.local-calendar-card footer i b:nth-child(5) { background: #2563eb; }

@media (max-width: 980px) {
  .local-home-page {
    width: min(1180px, calc(100vw - 72px - 36px));
    margin-left: calc((100% - min(1180px, calc(100vw - 72px - 36px))) / 2);
  }

  .app-shell.is-sidebar-collapsed .local-home-page {
    width: min(1180px, calc(100vw - 36px));
    margin-left: calc((100% - min(1180px, calc(100vw - 36px))) / 2);
  }

  .local-empty-room {
    width: min(1180px, calc(100vw - 72px - 36px));
    margin-left: calc((100% - min(1180px, calc(100vw - 72px - 36px))) / 2);
  }

  .app-shell.is-sidebar-collapsed .local-empty-room {
    width: min(1180px, calc(100vw - 36px));
    margin-left: calc((100% - min(1180px, calc(100vw - 36px))) / 2);
  }

  .local-home-last-played { min-height: 360px; grid-template-columns: minmax(0,1fr) 240px; padding: 34px; }
  .local-home-cover-wrap { width: 220px; min-width: 0; }
  .local-home-track-title { font-size: 32px; }
  .local-home-stat { padding: 0 24px; }
  .local-home-recent-grid { grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); }
  .local-album-row,
  .local-album-grid { grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); }
  .local-listening-grid { grid-template-columns: 1fr; }
  .recent-history-header { align-items: stretch; flex-direction: column; gap: 24px; }
  .recent-history-tools { justify-content: flex-start; padding-top: 0; }
  .recent-history-search { width: min(420px,100%); flex: 1 1 280px; }
  .recent-history-table-head,.recent-history-row { grid-template-columns: 42px minmax(250px,1.5fr) minmax(150px,.8fr) 120px; gap: 12px; }
}

@media (max-width: 760px) {
  .mode-badge { display: none; }
  .local-home-header { align-items: flex-start; flex-direction: column; }
  .local-home-page {
    width: 100%;
    max-width: 100%;
    margin-left: 0;
  }
  .local-empty-room {
    width: 100%;
    max-width: 100%;
    margin-left: 0;
  }
  .local-home-random { width: 100%; max-width: none; min-height: 68px; max-height: none; flex-basis: auto; }
  .local-home-last-played { grid-template-columns: 1fr; gap: 30px; padding: 28px 24px; }
  .local-home-cover-wrap { grid-row: 1; width: min(65vw, 260px); justify-self: center; }
  .local-home-track-title { white-space: normal; }
  .local-home-stats-panel { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .local-home-stat { min-height: 96px; padding: 0 22px; }
  .local-home-stat:nth-child(3) { border-left: 0; border-top: 1px solid #edf0f4; }
  .local-home-stat:nth-child(4) { border-top: 1px solid #edf0f4; }
  .local-home-section-heading { align-items: flex-start; flex-direction: column; gap: 14px; }
  .local-home-recent-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; }
  .local-album-row,
  .local-album-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; }
  .local-folders-header { align-items: stretch; flex-direction: column; gap: 16px; }
  .local-folder-search { width: 100%; }
  .local-folder-grid { grid-template-columns: repeat(2,minmax(0,1fr)); gap: 16px; }
  .local-folder-detail-heading { grid-template-columns: auto minmax(0,1fr); }
  .local-folder-detail-heading>div { min-width: 0; }
  .local-folder-detail-heading h1 { overflow: hidden; font-size: 26px; text-overflow: ellipsis; white-space: nowrap; }
  .local-folder-detail-heading p { grid-column: 1 / -1; margin-left: 0; }
  .local-folder-track-header,.local-folder-track-list>button { grid-template-columns: 34px minmax(0,1fr) 52px; gap: 8px; }
  .local-folder-track-header span:nth-child(3),.local-folder-track-album { display: none; }
  .recent-history-page { padding-inline: 0; }
  .recent-history-title-row { align-items: flex-start; flex-direction: column; gap: 7px; }
  .recent-history-actions { width: 100%; }
  .recent-history-actions button { flex: 1; justify-content: center; }
  .recent-history-source,.recent-history-filter { flex: 1; }
  .recent-history-source,.recent-history-filter summary { justify-content: center; }
  .recent-history-search { flex-basis: 100%; }
  .recent-history-table-head,.recent-history-row { grid-template-columns: 34px minmax(0,1fr) 72px; gap: 8px; }
  .recent-history-table-head span:nth-child(3),.recent-history-album { display: none; }
  .recent-history-table-head,.recent-history-row { padding-inline: 8px; }
  .local-listening-heading { align-items: flex-start; flex-direction: column; gap: 14px; }
  .local-top-tracks-card,
  .local-calendar-card { padding: 24px 18px; }
  .local-top-track-row { grid-template-columns: 34px 48px minmax(0, 1fr); }
  .local-top-track-meta { grid-column: 3; }
  .local-calendar-days button { min-height: 42px; }
  .local-calendar-card footer { align-items: flex-start; flex-direction: column; }
  .local-calendar-card footer > span { margin-left: 0; }
}

.song-detail-content {
  align-items: center;
  grid-template-rows: minmax(0, 1fr);
}

.song-detail-lyrics {
  align-content: start;
  align-self: stretch;
  height: 100%;
  overflow-x: hidden;
  overflow-y: auto;
  padding-right: 10px;
  padding-top: clamp(24px, 5vh, 58px);
  padding-bottom: 28px;
  text-align: left;
  scrollbar-width: none;
}

.song-detail-lyrics::-webkit-scrollbar {
  width: 0;
  height: 0;
}

.song-detail-lyrics h2 {
  font-size: 22px;
  font-weight: 800;
  line-height: 1.35;
}

.song-detail-lyrics > span {
  font-size: 15px;
  line-height: 1.45;
}

.song-detail-track-meta {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 8px 12px;
  min-width: 0;
  margin-top: 2px;
}

.song-detail-artist {
  color: #77959b;
  font-size: 15px;
  line-height: 1.45;
}

.song-detail-credits {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 5px;
  margin-top: 20px;
}

.song-detail-credit {
  display: block;
  min-width: 0;
  margin: 0;
  color: #78969c;
  font-size: 14px;
  line-height: 1.4;
  text-align: left;
}

.song-detail-credit strong {
  color: #496a72;
  font-weight: 400;
}

.song-detail-credit span {
  min-width: 0;
  overflow-wrap: anywhere;
}

.song-detail-lyrics-list {
  height: min(44vh, 390px);
  margin-top: 25px;
  padding: 34px 0;
  text-align: left;
}

.song-detail-lyrics-loading {
  display: flex;
  min-height: min(44vh, 390px);
  align-items: center;
  color: #78969c;
  font-size: 15px;
}

.song-detail-lyrics-list p {
  font-size: 22px;
  text-align: left;
  transform-origin: left center;
}

.song-detail-lyrics-list p.is-active {
  font-size: 22px;
  transform: none;
}

.song-detail-lyrics-list .song-detail-translation {
  font-size: 22px;
}

.song-detail-lyrics-list .is-active .song-detail-translation {
  font-size: 22px;
  font-weight: 400;
}

.song-detail-progress .progress-slider-wrap {
  --preview-progress-limit: 100%;
  --progress: 0%;
  position: relative;
  display: block;
  min-width: 0;
}

.song-detail-progress .progress-slider-wrap.is-preview::after {
  position: absolute;
  top: 50%;
  left: var(--preview-progress-limit);
  width: 6px;
  height: 6px;
  border: 2px solid #eafcfd;
  border-radius: 50%;
  background: #111;
  box-shadow: 0 0 0 1px rgba(17,17,17,.18);
  content: "";
  pointer-events: none;
  transform: translate(-50%,-50%);
}

.song-detail-progress input {
  display: block;
  width: 100%;
  height: 12px;
  margin: 0;
  appearance: none;
  background: transparent;
}

.song-detail-progress input::-webkit-slider-runnable-track {
  height: 2px;
  border-radius: 999px;
  background: linear-gradient(to right, #111 0 var(--progress), #d7e5e7 var(--progress) 100%);
}

.song-detail-progress input::-webkit-slider-thumb {
  width: 10px;
  height: 10px;
  margin-top: -4px;
  appearance: none;
  border: 0;
  border-radius: 50%;
  background: #111;
  box-shadow: 0 1px 4px rgba(17,17,17,.24);
}

.song-detail-progress input::-moz-range-track {
  height: 2px;
  border-radius: 999px;
  background: linear-gradient(to right, #111 0 var(--progress), #d7e5e7 var(--progress) 100%);
}

.song-detail-progress input::-moz-range-thumb {
  width: 10px;
  height: 10px;
  border: 0;
  border-radius: 50%;
  background: #111;
  box-shadow: 0 1px 4px rgba(17,17,17,.24);
}

.song-detail-progress input.is-preview::-webkit-slider-runnable-track {
  background: linear-gradient(
    to right,
    #111 0 var(--progress),
    #dfe7e5 var(--progress) var(--preview-progress-limit),
    #d7e5e7 var(--preview-progress-limit) 100%
  );
}

.song-detail-progress input.is-preview::-moz-range-track {
  background: linear-gradient(
    to right,
    #24c985 0 var(--progress),
    #dfe7e5 var(--progress) var(--preview-progress-limit),
    #d7e5e7 var(--preview-progress-limit) 100%
  );
}

.song-detail-preview-note {
  margin: 6px 0 0;
  color: #6f9296;
  font-size: 11px;
  text-align: center;
}

@media (max-width: 700px) {
  .song-detail-content {
    grid-template-rows: auto minmax(0, 1fr);
  }

  .song-detail-lyrics {
    width: min(100%, 430px);
    align-self: auto;
    height: auto;
    max-height: 100%;
    padding-right: 0;
    padding-top: 0;
    overflow: hidden;
    text-align: left;
  }

  .song-detail-lyrics h2 {
    font-size: 19px;
  }

  .song-detail-track-meta {
    gap: 6px 9px;
  }

  .song-detail-artist {
    font-size: 13px;
  }

  .song-detail-lyrics-list {
    height: min(33vh, 260px);
    padding-block: 22px;
  }

  .song-detail-lyrics-list p {
    font-size: 19px;
  }

  .song-detail-lyrics-list p.is-active {
    font-size: 19px;
  }

  .song-detail-credit {
    font-size: 13px;
  }
}

.song-detail-lyrics {
  --lyric-anchor-offset: calc(38% - 42px);
  --lyric-gutter: 72px;
  --lyric-overflow-room: clamp(96px, 10vw, 180px);
  position: relative;
  align-content: start;
  align-self: stretch;
  height: 100%;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
  width: calc(100% + var(--lyric-gutter) + var(--lyric-overflow-room));
  margin-left: calc(var(--lyric-gutter) * -1);
  padding: 0 10px 38px var(--lyric-gutter);
  scrollbar-width: none;
  touch-action: pan-y;
  cursor: grab;
  -webkit-mask-image: -webkit-linear-gradient(top, transparent 0%, #000 8%, #000 90%, transparent 100%);
  mask-image: linear-gradient(to bottom, transparent 0%, #000 8%, #000 90%, transparent 100%);
}

.song-detail-lyrics.is-dragging {
  cursor: grabbing;
  user-select: none;
}

.song-detail-lyrics::-webkit-scrollbar {
  width: 0;
  height: 0;
}

.song-detail-lyrics-pane {
  display: grid;
  min-width: 0;
  min-height: 0;
  align-self: stretch;
  height: 100%;
  grid-template-rows: auto minmax(0, 1fr);
}

.song-detail-song-header {
  min-width: 0;
  padding: clamp(24px, 5vh, 58px) 0 18px;
}

.song-detail-title {
  margin: 0 0 7px;
  color: #233f45;
  font-size: 22px;
  font-weight: 800;
  line-height: 1.35;
}

.song-detail-title-row {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.local-lyrics-match-button {
  display: inline-flex;
  flex: 0 0 auto;
  min-height: 32px;
  align-items: center;
  gap: 7px;
  border: 1px solid rgba(82, 114, 120, .24);
  border-radius: 7px;
  padding: 0 11px;
  background: rgba(255, 255, 255, .56);
  color: #527278;
  cursor: pointer;
  font-size: 12px;
  font-weight: 750;
}

.local-lyrics-match-button:hover:not(:disabled) {
  border-color: rgba(22, 142, 198, .45);
  color: #168ec6;
}

.local-lyrics-match-button:disabled {
  cursor: wait;
  opacity: .58;
}

.local-lyrics-match-notice {
  margin: 8px 0 0;
  color: #6f9296;
  font-size: 12px;
  line-height: 1.45;
}

.song-detail-track-meta {
  display: grid;
  min-width: 0;
  gap: 3px;
  margin: 0;
}

.song-detail-artist {
  display: block;
  overflow-wrap: anywhere;
  color: #77959b;
  font-size: 22px;
  line-height: 1.45;
}

.song-detail-album {
  display: block;
  min-width: 0;
  overflow-wrap: anywhere;
  color: #8aa1a6;
  font-size: 14px;
  line-height: 1.45;
}

.song-detail-meta-label {
  color: #6f8b91;
}

.song-detail-song-info {
  min-width: 0;
  margin-top: 0;
}

.song-detail-preface-track {
  margin: 0 0 8px;
  color: #78969c;
  font-size: 22px;
  line-height: 1.5;
  text-align: left;
}

.song-detail-credits {
  display: grid;
  grid-template-columns: 1fr;
  gap: 8px;
  margin-top: 0;
}

.song-detail-credit {
  display: block;
  min-width: 0;
  margin: 0;
  color: #78969c;
  font-size: 22px;
  line-height: 1.45;
  text-align: left;
}

.song-detail-credit strong {
  color: #496a72;
  font-weight: 400;
}

.song-detail-credit span {
  min-width: 0;
  overflow-wrap: anywhere;
}

.song-detail-lyrics-list {
  height: auto;
  margin-top: 30px;
  padding: 20px 0 80px;
  overflow: visible;
  text-align: left;
}

.song-detail-lyrics-list::-webkit-scrollbar {
  width: 0;
  height: 0;
}

.song-detail-lyrics-list p.lyric-line {
  position: relative;
  display: block;
  width: 100%;
  margin: 0;
  padding: 6px 0;
  color: #405d63;
  font-size: 22px;
  line-height: 1.45;
  text-align: left;
  transform-origin: left center;
}

.song-detail-lyrics-list p.lyric-line.is-active {
  font-size: 22px;
  transform: none;
}

.lyric-end-spacer {
  width: 100%;
  pointer-events: none;
}

.lyric-start-spacer {
  width: 100%;
  flex: 0 0 auto;
  pointer-events: none;
}

.lyric-seek-button {
  position: absolute;
  top: 50%;
  left: -72px;
  display: grid;
  width: 24px;
  height: 28px;
  place-items: center;
  margin: 2px 0 0;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: #168ec6;
  cursor: pointer;
  opacity: 0;
  transform: translateY(-50%);
  transition: background 150ms ease, color 150ms ease, opacity 150ms ease;
}

.lyric-anchor-controls {
  position: sticky;
  top: var(--lyric-anchor-offset, calc(38% - 42px));
  left: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  gap: 4px;
  height: 0;
  overflow: visible;
  transform: translateX(calc(var(--lyric-gutter) * -0.9));
}

.lyric-anchor-controls .lyric-seek-button {
  position: static;
  width: 24px;
  height: 28px;
  margin: 0;
  opacity: 1;
  transform: none;
}

.lyric-anchor-controls .lyric-timestamp {
  position: static;
  padding-top: 0;
  transform: none;
}

.lyric-line:hover .lyric-seek-button,
.lyric-line.is-active .lyric-seek-button,
.lyric-seek-button:focus-visible {
  opacity: 1;
}

.lyric-seek-button:hover {
  background: rgba(22, 142, 198, .12);
  color: #0d6e9e;
}

.lyric-seek-play-icon {
  width: 0;
  height: 0;
  margin-left: 2px;
  border-top: 6px solid transparent;
  border-bottom: 6px solid transparent;
  border-left: 8px solid currentColor;
}

.lyric-timestamp {
  position: absolute;
  top: 50%;
  left: -44px;
  padding-top: 5px;
  color: #9aaeb2;
  font-size: 12px;
  font-weight: 500;
  line-height: 1.4;
  white-space: nowrap;
  transform: translateY(-50%);
}

.lyric-line-content {
  display: block;
  min-width: 0;
  max-width: 100%;
  overflow: visible;
  width: 100%;
}

.song-detail-lyrics-list .lyric-original {
  display: block;
  color: #405d63;
  white-space: nowrap;
}

.song-detail-lyrics-list {
  --lyric-highlight-color: #2f9fc8;
}

.song-detail-lyrics-list .lyric-character {
  position: relative;
  display: inline-block;
  color: #405d63;
  transition: none;
}

.song-detail-lyrics-list .lyric-character.is-sung {
  color: var(--lyric-highlight-color);
}

.song-detail-lyrics-list .lyric-line.is-word-timed .lyric-character {
  --lyric-character-progress: 0%;
  background: linear-gradient(
    90deg,
    var(--lyric-highlight-color) 0,
    var(--lyric-highlight-color) var(--lyric-character-progress),
    #405d63 var(--lyric-character-progress),
    #405d63 100%
  );
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.song-detail-lyrics-list .lyric-line.is-word-timed .lyric-character.is-sung {
  --lyric-character-progress: 100%;
}

.song-detail-lyrics-list .lyric-line.is-active:not(.is-word-timed) .lyric-character {
  color: var(--lyric-highlight-color);
}

.song-detail-lyrics-list .song-detail-translation {
  display: block;
  margin-top: 7px;
  color: #6f9296;
  font-size: 22px;
  font-weight: 400;
  line-height: 1.5;
  transition: color 180ms ease, font-size 180ms ease;
  white-space: nowrap;
}

.song-detail-lyrics-list .is-active .song-detail-translation {
  font-size: 22px;
  font-weight: 400;
}

@media (max-width: 700px) {
  .song-detail-lyrics-pane { padding-left: 48px; }
  .song-detail-title-row { flex-wrap: wrap; gap: 8px; }
  .song-detail-lyrics {
    --lyric-gutter: 72px;
    align-self: stretch;
    height: 100%;
    max-height: 100%;
    width: calc(min(100%, 430px) + var(--lyric-gutter));
    margin-left: calc(var(--lyric-gutter) * -1);
    padding: 0 0 28px var(--lyric-gutter);
    overflow-x: hidden;
    overflow-y: auto;
    overscroll-behavior: contain;
    text-align: left;
  }

  .song-detail-title,
  .song-detail-artist,
  .song-detail-credit,
  .song-detail-lyrics-list p.lyric-line {
    font-size: 19px;
  }

  .song-detail-lyrics-list {
    margin-top: 23px;
    padding-block: 18px 56px;
  }

  .song-detail-lyrics-list p.lyric-line.is-active {
    font-size: 19px;
  }

  .song-detail-lyrics-list .song-detail-translation {
    font-size: 19px;
  }

  .song-detail-lyrics-list .is-active .song-detail-translation {
    font-size: 19px;
    font-weight: 400;
  }

  .lyric-seek-button {
    width: 22px;
    left: -45px;
  }

  .lyric-timestamp {
    left: -17px;
  }
}

.song-detail-progress input {
  accent-color: #111;
}

.song-detail-progress input.is-preview::-moz-range-track {
  background: linear-gradient(
    to right,
    #111 0 var(--progress),
    #dfe7e5 var(--progress) var(--preview-progress-limit),
    #d7e5e7 var(--preview-progress-limit) 100%
  );
}

.song-detail-progress .progress-slider-wrap.is-preview::after {
  z-index: 0;
  width: 4px;
  height: 4px;
  border-width: 1px;
}

.song-detail-progress .progress-slider-wrap input {
  position: relative;
  z-index: 1;
}

/* 喜欢入口与底部播放器保持同一套状态语义。 */
.song-detail-player { position: relative; }
.song-detail-like-button { position: absolute; top: 50%; left: max(40px,10vw); display: grid; width: 36px; height: 36px; place-items: center; border: 0; background: transparent; color: #7d8788; cursor: pointer; font-size: 24px; line-height: 1; transform: translateY(-50%); transition: color 150ms ease, transform 150ms ease; }
.song-detail-like-button:hover, .song-detail-like-button:focus-visible { color: #ff6570; }
.song-detail-like-button.active { color: #ff6570; }
.song-detail-like-button:active { transform: translateY(-50%) scale(.92); }
@media (max-width: 700px) { .song-detail-like-button { left: 14px; } }
.homepage-feature-controls { display: flex; align-items: center; gap: 8px; margin-top: 15px; color: rgba(38,51,53,.58); font-size: 10px; }
.homepage-feature-controls button { display: grid; width: 23px; height: 23px; place-items: center; border: 1px solid rgba(38,51,53,.2); border-radius: 50%; background: rgba(255,255,255,.38); color: #415456; cursor: pointer; font-size: 16px; line-height: 1; }
.homepage-feature-controls button:hover { border-color: #168ec6; color: #168ec6; }
.daily-recommendation-card { display: flex; height: 253px; min-height: 253px; max-height: 253px; flex-direction: column; overflow: hidden; border: 1px solid #e1eded; border-radius: 16px; padding: 22px 20px; background: #fff; }
.daily-recommendation-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.daily-recommendation-header h2 { margin: 8px 0 0; color: #263335; font-size: 24px; }
.daily-recommendation-header button { display: grid; width: 28px; height: 28px; place-items: center; border: 1px solid #dce9e7; border-radius: 50%; background: #f8fbfa; color: #648084; cursor: pointer; font-size: 20px; line-height: 1; }
.daily-recommendation-header button:hover { border-color: #168ec6; color: #168ec6; }
.daily-recommendation-state { display: grid; flex: 1; align-content: center; gap: 8px; color: #78969c; font-size: 11px; line-height: 1.65; }
.daily-recommendation-state strong { color: #526e73; font-size: 13px; }
.daily-recommendation-login button { width: fit-content; border: 1px solid #d7e6e2; border-radius: 7px; padding: 7px 10px; background: #fff; color: #527278; cursor: pointer; font-size: 11px; }
.daily-recommendation-login button:hover { border-color: #168ec6; color: #168ec6; }
.daily-recommendation-list { display: grid; gap: 6px; margin-top: 16px; }
.daily-recommendation-list button { display: grid; grid-template-columns: 34px minmax(0,1fr) 20px; align-items: center; gap: 10px; border: 0; border-top: 1px solid #edf2f2; padding: 8px 0; background: transparent; color: #527278; cursor: pointer; text-align: left; }
.daily-recommendation-list button:hover { color: #168ec6; }
.daily-track-cover { display: grid; width: 34px; height: 34px; place-items: center; overflow: hidden; border-radius: 6px; color: #fff; font-size: 13px; }
.daily-track-cover img { width: 100%; height: 100%; object-fit: cover; }
.daily-recommendation-list button > span:nth-child(2) { display: grid; min-width: 0; gap: 3px; }
.daily-recommendation-list strong,.daily-recommendation-list small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.daily-recommendation-list strong { font-size: 12px; font-weight: 600; }
.daily-recommendation-list small { color: #9aa9aa; font-size: 10px; }
.daily-recommendation-list button > span:last-child { color: #9eb0b0; font-size: 10px; text-align: right; }
.section-heading-actions { display: flex; align-items: center; gap: 17px; }
.refresh-notice { color: #8da09d; font-size: 10px; }
.search-toast { position: fixed; right: 26px; top: 24px; z-index: 180; max-width: min(380px,calc(100vw - 40px)); margin: 0; border: 1px solid rgba(255,255,255,.12); border-radius: 8px; padding: 11px 14px; background: rgba(25,31,42,.94); color: #fff; box-shadow: 0 16px 38px rgba(20,27,38,.2); font-size: 12px; font-weight: 700; }
.search-toast-enter-active,.search-toast-leave-active { transition: opacity 200ms ease,transform 200ms ease; }
.search-toast-enter-from,.search-toast-leave-to { opacity: 0; transform: translateY(-8px); }
.section-heading-actions .text-button:disabled { color: #c0c9c7; cursor: default; }
.streaming-home-tools {
  display: flex;
  width: min(430px, 48vw);
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
}

.streaming-home-search {
  display: flex;
  min-width: 0;
  height: 42px;
  flex: 1 1 330px;
  align-items: center;
  gap: 10px;
  border: 1px solid #e1e6eb;
  border-radius: 21px;
  padding: 0 15px;
  background: rgba(255, 255, 255, .9);
  color: #95a0ad;
  box-shadow: 0 10px 28px rgba(28, 39, 55, .05);
  transition: border-color 180ms ease, box-shadow 180ms ease, background 180ms ease;
}

.streaming-home-search.is-focused {
  border-color: #e86b3f;
  background: #fff;
  color: #e86b3f;
  box-shadow: 0 0 0 2px rgba(232, 107, 63, .09), 0 12px 30px rgba(28, 39, 55, .07);
}

.streaming-search-icon { flex: 0 0 auto; transition: color 180ms ease; }

.streaming-home-search input {
  width: 100%;
  min-width: 0;
  border: 0;
  outline: 0;
  background: transparent;
  color: #162033;
  font: inherit;
  font-size: 13px;
}

.streaming-home-search input::placeholder { color: #a8b0ba; }
.streaming-search-clear {
  display: grid;
  width: 24px;
  height: 24px;
  flex: 0 0 24px;
  place-items: center;
  border: 0;
  border-radius: 50%;
  padding: 0;
  background: #f0f1f2;
  color: #8b929b;
  cursor: pointer;
  line-height: 1;
  transition: background 160ms ease, color 160ms ease, transform 160ms ease;
}
.streaming-search-clear:hover { background: #e7e9eb; color: #515963; }
.streaming-search-clear:active { transform: scale(.94); }
.streaming-search-clear:focus-visible { outline: 2px solid rgba(232, 107, 63, .32); outline-offset: 2px; }
.streaming-source-switch {
  position: relative;
  z-index: 12;
  flex: 0 0 auto;
  align-self: center;
}

.streaming-source-trigger {
  position: relative;
  display: inline-flex;
  width: 42px;
  height: 42px;
  align-items: center;
  justify-content: center;
  gap: 3px;
  border: 1px solid #dfe5ea;
  border-radius: 50%;
  background: rgba(255, 255, 255, .92);
  color: #e85d67;
  box-shadow: 0 12px 28px rgba(28, 39, 55, .08);
  cursor: pointer;
  transition: border-color 180ms ease, background 180ms ease, color 180ms ease, box-shadow 180ms ease, transform 180ms ease;
}

.streaming-source-trigger:hover,
.streaming-source-trigger.active {
  border-color: #cfd8e2;
  background: #fff;
  color: #d94351;
  box-shadow: 0 14px 32px rgba(28, 39, 55, .12);
  transform: translateY(-1px);
}

.streaming-source-trigger.is-qq { color: #1d87bb; }
.streaming-source-trigger.is-qq:hover,
.streaming-source-trigger.is-qq.active { color: #086f9f; }
.streaming-source-trigger-avatar { display: block; width: 34px; height: 34px; border-radius: 50%; object-fit: cover; }
.streaming-source-trigger.has-avatar { gap: 0; padding: 3px; }
.streaming-source-trigger.has-avatar > svg:last-child {
  position: absolute;
  right: -2px;
  bottom: -1px;
  width: 16px;
  height: 16px;
  border: 1px solid #dfe5ea;
  border-radius: 50%;
  padding: 2px;
  background: #fff;
  color: #64717b;
}
.streaming-source-trigger svg:last-child { transition: transform 180ms ease; }
.streaming-source-trigger.active svg:last-child { transform: rotate(180deg); }

.streaming-source-layer { position: absolute; top: calc(100% + 10px); right: 0; }
.streaming-source-backdrop { position: fixed; z-index: -1; inset: 0; border: 0; background: transparent; cursor: default; }
.streaming-source-menu {
  display: grid;
  width: 232px;
  gap: 4px;
  border: 1px solid rgba(214, 221, 229, .95);
  border-radius: 14px;
  padding: 7px;
  background: rgba(255, 255, 255, .98);
  box-shadow: 0 22px 54px rgba(27, 38, 53, .16);
  backdrop-filter: blur(18px);
}

.streaming-source-menu > button {
  display: grid;
  min-height: 58px;
  grid-template-columns: 34px minmax(0, 1fr) 18px;
  align-items: center;
  gap: 11px;
  border: 0;
  border-radius: 10px;
  padding: 8px 10px;
  background: transparent;
  color: #172033;
  cursor: pointer;
  text-align: left;
  transition: background 160ms ease, color 160ms ease;
}

.streaming-source-menu > button:hover,
.streaming-source-menu > button[aria-checked="true"] { background: #f3f6f8; }
.streaming-source-menu > button > span:nth-child(2) { display: grid; min-width: 0; gap: 4px; }
.streaming-source-menu strong { font-size: 12px; font-weight: 800; }
.streaming-source-menu small { color: #8b96a6; font-size: 10px; }
.streaming-source-menu > button > svg { justify-self: end; color: #167c63; }
.streaming-source-mark { display: grid; width: 34px; height: 34px; place-items: center; border-radius: 9px; color: #fff; font-size: 12px; font-weight: 900; }
.streaming-source-mark.is-avatar { display: block; border-radius: 50%; object-fit: cover; }
.streaming-source-mark.is-netease { background: #e95661; }
.streaming-source-mark.is-qq { background: #1397c8; color: #fff; }
.source-menu-enter-active,
.source-menu-leave-active { transition: opacity 180ms ease, transform 180ms ease; transform-origin: top right; }
.source-menu-enter-from,
.source-menu-leave-to { opacity: 0; transform: translateY(-7px) scale(.98); }

.streaming-home-login-card {
  display: flex;
  min-height: 390px;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid rgba(213, 223, 235, .76);
  border-radius: 18px;
  padding: 54px 28px;
  background: linear-gradient(120deg, #edf3ff 0%, #fff 47%, #eaf8f7 100%);
  box-shadow: 0 22px 58px rgba(41, 55, 75, .09);
  color: #10182b;
  text-align: center;
}

.streaming-login-icon {
  display: grid;
  width: 72px;
  height: 72px;
  place-items: center;
  margin-bottom: 25px;
  border: 1px solid #a9c8f5;
  border-radius: 20px;
  background: rgba(231, 242, 253, .86);
  color: #246ae8;
}

.streaming-login-kicker { margin-bottom: 14px; color: #687892; font-size: 11px; font-weight: 800; letter-spacing: 2px; }
.streaming-home-login-card h2 { margin: 0 0 14px; font-size: 34px; font-weight: 900; letter-spacing: 0; }
.streaming-home-login-card p { max-width: 510px; margin: 0; color: #738097; font-size: 13px; line-height: 1.85; }
.streaming-home-login-card > button {
  display: inline-flex;
  height: 48px;
  align-items: center;
  gap: 9px;
  margin-top: 31px;
  border: 0;
  border-radius: 999px;
  padding: 0 25px;
  background: #111a2d;
  color: #fff;
  box-shadow: 0 14px 30px rgba(17, 26, 45, .18);
  cursor: pointer;
  font-size: 12px;
  font-weight: 800;
  transition: background 180ms ease, box-shadow 180ms ease, transform 180ms ease;
}

.streaming-home-login-card > button:hover { background: #202c43; box-shadow: 0 18px 36px rgba(17, 26, 45, .24); transform: translateY(-2px); }
.streaming-home-content { display: grid; gap: 40px; }
.streaming-daily-mix {
  display: grid;
  min-height: 374px;
  grid-template-columns: minmax(0, 1.15fr) minmax(300px, .85fr);
  align-items: center;
  gap: 28px;
  overflow: hidden;
  border: 1px solid rgba(224, 225, 232, .9);
  border-radius: 18px;
  padding: 44px 48px;
  background: linear-gradient(112deg, #f6f7ff 0%, #fff 38%, #ffe7e8 72%, #eadfe5 100%);
  box-shadow: 0 20px 46px rgba(31, 40, 55, .07);
}

.streaming-daily-mix.is-qq {
  min-height: 332px;
  grid-template-columns: minmax(0, 1.08fr) minmax(360px, .92fr);
  border-color: rgba(71, 104, 103, .7);
  padding: 34px 38px;
  background: linear-gradient(115deg, #283247 0%, #324d56 54%, #397b6b 100%);
  box-shadow: 0 22px 54px rgba(26, 40, 52, .16);
}
.streaming-daily-copy { min-width: 0; }
.streaming-daily-qq-meta { display: flex; max-width: 650px; align-items: center; justify-content: space-between; color: #8fe0c5; font-size: 10px; font-weight: 800; letter-spacing: 2px; }
.streaming-daily-qq-meta span:last-child { color: rgba(221, 238, 235, .55); }
.streaming-daily-date { display: flex; align-items: center; gap: 12px; }
.streaming-daily-date > strong {
  display: grid;
  width: 46px;
  height: 46px;
  place-items: center;
  border-radius: 12px;
  background: #172033;
  color: #fff;
  font-size: 21px;
  font-weight: 900;
}
.streaming-daily-date > span { display: grid; gap: 5px; }
.streaming-daily-date b { color: #172033; font-size: 12px; }
.streaming-daily-date small { color: #7e8a9d; font-size: 10px; }
.streaming-daily-copy h2 { margin: 20px 0 4px; color: #10182b; font-size: clamp(40px, 5vw, 58px); line-height: 1.05; letter-spacing: 0; }
.streaming-daily-mix.is-qq .streaming-daily-copy h2 { margin: 34px 0 22px; color: #fff; font-size: 52px; }
.streaming-daily-kicker { color: #245fc4; font-size: 13px; font-weight: 900; letter-spacing: 0; }
.streaming-daily-copy > p { max-width: 560px; margin: 24px 0 0; color: #697890; font-size: 13px; line-height: 1.75; }
.streaming-daily-mix.is-qq .streaming-daily-copy > p { margin-top: 0; color: rgba(240, 246, 246, .88); }
.streaming-daily-actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 25px; }
.streaming-daily-actions button {
  display: inline-flex;
  min-width: 116px;
  height: 44px;
  align-items: center;
  justify-content: center;
  gap: 7px;
  border: 1px solid #ccd4df;
  border-radius: 22px;
  padding: 0 18px;
  background: rgba(255, 255, 255, .72);
  color: #172033;
  cursor: pointer;
  font-size: 12px;
  font-weight: 800;
  transition: border-color 170ms ease, background 170ms ease, color 170ms ease, box-shadow 170ms ease, transform 170ms ease;
}
.streaming-daily-actions button.primary { border-color: #172033; background: #172033; color: #fff; box-shadow: 0 12px 25px rgba(23, 32, 51, .17); }
.streaming-daily-actions button:not(:disabled):hover { border-color: #aeb9c7; background: #fff; transform: translateY(-1px); }
.streaming-daily-actions button.primary:not(:disabled):hover { border-color: #27344b; background: #27344b; box-shadow: 0 15px 30px rgba(23, 32, 51, .22); }
.streaming-daily-actions button:disabled { opacity: .45; cursor: default; }
.streaming-daily-mix.is-qq .streaming-daily-actions { margin-top: 30px; }
.streaming-daily-mix.is-qq .streaming-daily-actions button { min-width: 0; border-color: transparent; background: transparent; color: rgba(239, 246, 245, .78); }
.streaming-daily-mix.is-qq .streaming-daily-actions button.primary { min-width: 122px; border-color: #fff; background: #fff; color: #172033; box-shadow: none; }
.streaming-daily-mix.is-qq .streaming-daily-actions button:not(:disabled):hover { border-color: rgba(255, 255, 255, .2); background: rgba(255, 255, 255, .08); color: #fff; }
.streaming-daily-mix.is-qq .streaming-daily-actions button.primary:not(:disabled):hover { border-color: #fff; background: #fff; color: #172033; box-shadow: 0 13px 28px rgba(12, 24, 35, .24); }
.streaming-daily-qq-count { display: block; margin-top: 24px; color: rgba(225, 236, 236, .68); font-size: 10px; }

.streaming-daily-cover-stack { position: relative; width: min(360px, 100%); height: 270px; justify-self: end; }
.streaming-daily-mix.is-qq .streaming-daily-cover-stack { z-index: 0; width: min(430px, 100%); height: 270px; }
.streaming-daily-mix.is-qq .streaming-daily-cover-stack::before,
.streaming-daily-mix.is-qq .streaming-daily-cover-stack::after { content: ""; position: absolute; z-index: -1; top: 50%; left: 50%; border: 1px solid rgba(218, 242, 234, .16); border-radius: 50%; transform: translate(-50%, -50%); }
.streaming-daily-mix.is-qq .streaming-daily-cover-stack::before { width: 440px; height: 440px; }
.streaming-daily-mix.is-qq .streaming-daily-cover-stack::after { width: 330px; height: 330px; }
.streaming-daily-stack-cover {
  position: absolute;
  display: grid;
  width: 176px;
  aspect-ratio: 1;
  place-items: center;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, .65);
  border-radius: 16px;
  background: linear-gradient(135deg, #b8c5d7, #6b7891);
  color: rgba(255, 255, 255, .9);
  box-shadow: 0 23px 42px rgba(42, 43, 55, .18);
  font-size: 30px;
  font-weight: 900;
}
.streaming-daily-stack-cover:nth-child(1) { z-index: 3; left: 34px; top: 42px; transform: rotate(-2deg); }
.streaming-daily-stack-cover:nth-child(2) { z-index: 2; right: 19px; top: 4px; width: 150px; transform: rotate(5deg); }
.streaming-daily-stack-cover:nth-child(3) { z-index: 1; right: 0; bottom: 5px; width: 128px; transform: rotate(-7deg); }
.streaming-daily-stack-cover img { width: 100%; height: 100%; object-fit: cover; }
.streaming-daily-mix.is-qq .streaming-daily-stack-cover { border-color: rgba(255, 255, 255, .34); border-radius: 7px; box-shadow: 0 18px 34px rgba(14, 24, 35, .25); }
.streaming-daily-mix.is-qq .streaming-daily-stack-cover:nth-child(1) { left: 115px; top: 34px; width: 190px; transform: rotate(-6deg); }
.streaming-daily-mix.is-qq .streaming-daily-stack-cover:nth-child(2) { right: 45px; top: 7px; width: 198px; transform: rotate(-8deg); }
.streaming-daily-mix.is-qq .streaming-daily-stack-cover:nth-child(3) { right: 15px; bottom: 1px; width: 152px; transform: rotate(9deg); }

.streaming-daily-preview { display: grid; gap: 16px; padding: 7px 20px 3px; }
.streaming-daily-preview-header { display: flex; align-items: center; justify-content: space-between; gap: 24px; }
.streaming-daily-preview-header h3 { margin: 0 0 7px; color: #172033; font-size: 21px; font-weight: 900; letter-spacing: 0; }
.streaming-daily-preview-header p { margin: 0; color: #738097; font-size: 11px; line-height: 1.5; }
.streaming-daily-preview-all {
  display: inline-flex;
  height: 34px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border: 1px solid #dfe3e8;
  border-radius: 17px;
  padding: 0 14px;
  background: rgba(255, 255, 255, .8);
  color: #506078;
  cursor: pointer;
  font-size: 11px;
  font-weight: 800;
  transition: border-color 170ms ease, background 170ms ease, color 170ms ease, transform 170ms ease;
}
.streaming-daily-preview-all:hover { border-color: #cbd2db; background: #fff; color: #172033; transform: translateX(2px); }
.streaming-daily-preview-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px 28px; }
.streaming-daily-preview-track {
  display: grid;
  min-width: 0;
  min-height: 64px;
  grid-template-columns: 38px 48px minmax(0, 1fr) 46px;
  align-items: center;
  gap: 12px;
  border: 1px solid transparent;
  border-radius: 12px;
  padding: 7px 12px;
  background: transparent;
  color: #172033;
  cursor: pointer;
  text-align: left;
  transition: border-color 170ms ease, background 170ms ease, box-shadow 170ms ease, transform 170ms ease;
}
.streaming-daily-preview-track:hover { border-color: #e6e8eb; background: rgba(255, 255, 255, .78); box-shadow: 0 9px 22px rgba(31, 40, 55, .05); transform: translateY(-1px); }
.streaming-daily-preview-track.active { border-color: rgba(153, 126, 76, .14); background: var(--app-playing-background); box-shadow: 0 10px 24px rgba(96, 79, 48, .06); }
.streaming-daily-preview-index { color: #b5bbc5; font-size: 18px; font-weight: 800; text-align: center; }
.streaming-daily-preview-track.active .streaming-daily-preview-index { color: #8c7650; }
.streaming-daily-preview-cover { position: relative; display: grid; width: 48px; height: 48px; place-items: center; overflow: hidden; border-radius: 9px; color: rgba(255, 255, 255, .92); font-size: 14px; font-weight: 900; }
.streaming-daily-preview-cover img { width: 100%; height: 100%; object-fit: cover; }
.streaming-daily-preview-copy { display: grid; min-width: 0; gap: 5px; }
.streaming-daily-preview-copy strong,
.streaming-daily-preview-copy small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.streaming-daily-preview-copy strong { color: #172033; font-size: 13px; font-weight: 850; }
.streaming-daily-preview-copy small { color: #75839a; font-size: 10px; }
.streaming-daily-preview-duration { color: #8995a8; font-size: 11px; font-variant-numeric: tabular-nums; text-align: right; }
.streaming-daily-preview-bars { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; gap: 3px; background: rgba(13, 93, 84, .78); }
.streaming-daily-preview-bars i { display: block; width: 2px; height: 17px; border-radius: 999px; background: #fff; transform-origin: center; animation: streaming-daily-preview-bar 720ms ease-in-out infinite alternate; }
.streaming-daily-preview-bars i:nth-child(2) { animation-delay: -480ms; }
.streaming-daily-preview-bars i:nth-child(3) { animation-delay: -240ms; }
@keyframes streaming-daily-preview-bar { 0% { transform: scaleY(.28); } 45% { transform: scaleY(1); } 100% { transform: scaleY(.48); } }

.streaming-featured-playlists { display: grid; gap: 18px; padding: 7px 20px 3px; }
.streaming-featured-playlists-header { display: grid; gap: 7px; }
.streaming-featured-playlists-header h3 { margin: 0; color: #172033; font-size: 21px; font-weight: 900; letter-spacing: 0; }
.streaming-featured-playlists-header p { margin: 0; color: #738097; font-size: 11px; line-height: 1.5; }
.streaming-featured-playlists-grid { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 28px 20px; }
.streaming-featured-playlist-card { display: grid; min-width: 0; gap: 10px; border: 0; padding: 0; background: transparent; color: #172033; cursor: pointer; text-align: left; }
.streaming-featured-playlist-cover { position: relative; display: grid; width: 100%; aspect-ratio: 1; place-items: center; overflow: hidden; border: 1px solid rgba(255,255,255,.72); border-radius: 8px; background: #dfe5e9; box-shadow: 0 13px 28px rgba(31,40,55,.09); transition: box-shadow 180ms ease, transform 180ms ease; }
.streaming-featured-playlist-cover img { width: 100%; height: 100%; object-fit: cover; transition: transform 220ms ease; }
.streaming-featured-playlist-mark { color: rgba(255,255,255,.9); font-size: 28px; font-weight: 900; }
.streaming-featured-playlist-count { position: absolute; left: 9px; bottom: 9px; border-radius: 999px; padding: 4px 7px; background: rgba(19,27,40,.68); color: #fff; font-size: 9px; font-weight: 800; backdrop-filter: blur(8px); }
.streaming-featured-playlist-play { position: absolute; right: 9px; bottom: 9px; display: grid; width: 34px; height: 34px; place-items: center; border: 1px solid rgba(255,255,255,.78); border-radius: 50%; background: rgba(255,255,255,.9); color: #172033; box-shadow: 0 7px 18px rgba(24,31,43,.16); opacity: 0; transform: translateY(5px); transition: opacity 180ms ease, transform 180ms ease; }
.streaming-featured-playlist-card strong { display: -webkit-box; overflow: hidden; color: #172033; font-size: 12px; font-weight: 850; line-height: 1.5; -webkit-box-orient: vertical; -webkit-line-clamp: 2; line-clamp: 2; }
.streaming-featured-playlist-card:hover .streaming-featured-playlist-cover { box-shadow: 0 18px 34px rgba(31,40,55,.15); transform: translateY(-4px); }
.streaming-featured-playlist-card:hover .streaming-featured-playlist-cover img { transform: scale(1.025); }
.streaming-featured-playlist-card:hover .streaming-featured-playlist-play { opacity: 1; transform: translateY(0); }
.streaming-featured-playlist-card:focus-visible { outline: 2px solid #4a7fd8; outline-offset: 4px; border-radius: 8px; }

.streaming-personal-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 22px; }
.streaming-personal-card {
  display: grid;
  min-height: 112px;
  grid-template-columns: 86px minmax(0, 1fr) 42px;
  align-items: center;
  gap: 17px;
  border: 1px solid #e1e6eb;
  border-radius: 16px;
  padding: 16px 20px;
  background: #fff;
  color: #172033;
  cursor: pointer;
  text-align: left;
  box-shadow: 0 15px 34px rgba(31, 40, 55, .05);
  transition: border-color 190ms ease, box-shadow 190ms ease, transform 190ms ease;
}
.streaming-personal-card.is-roaming { background: linear-gradient(105deg, #edf4ff, #fff 62%); }
.streaming-personal-card.is-radar { background: linear-gradient(105deg, #eff9fa, #fff 62%); }
.streaming-personal-card:not(:disabled):hover { border-color: #ccd5df; box-shadow: 0 20px 40px rgba(31, 40, 55, .1); transform: translateY(-3px); }
.streaming-personal-card:disabled { opacity: .56; cursor: default; }
.streaming-personal-copy { display: grid; min-width: 0; gap: 7px; }
.streaming-personal-copy strong { font-size: 18px; font-weight: 900; }
.streaming-personal-copy small { overflow: hidden; color: #728097; font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }
.streaming-personal-arrow { display: grid; width: 38px; height: 38px; place-items: center; justify-self: end; border: 1px solid #d7dfe7; border-radius: 50%; background: rgba(255, 255, 255, .78); }
.streaming-radar-covers { position: relative; width: 78px; height: 64px; justify-self: center; }
.streaming-radar-covers > span { position: absolute; display: grid; width: 52px; height: 52px; place-items: center; overflow: hidden; border: 2px solid #fff; border-radius: 10px; background: #dbe8ea; color: #627782; box-shadow: 0 8px 18px rgba(35, 50, 60, .13); }
.streaming-radar-covers > span:nth-child(1) { z-index: 3; left: 0; bottom: 0; }
.streaming-radar-covers > span:nth-child(2) { z-index: 2; left: 18px; top: 2px; transform: rotate(4deg); }
.streaming-radar-covers > span:nth-child(3) { z-index: 1; right: 0; top: 7px; transform: rotate(8deg); }
.streaming-radar-covers img { width: 100%; height: 100%; object-fit: cover; }

/* Appearance preferences are applied at the shell so every route shares one live theme. */
.app-shell {
  --appearance-accent: #68369a;
  --appearance-background-image: none;
  --appearance-font-family: Inter, "Segoe UI", sans-serif;
  --app-accent: var(--appearance-accent);
  --lyric-active-color: #2f9fc8;
  --lyric-font-family: Inter, "Segoe UI", sans-serif;
  --lyric-font-size: 20px;
  --lyric-font-weight: 700;
  --lyric-inactive-color: #405d63;
  --lyric-inactive-opacity: .58;
  --lyric-line-height: 1.55;
  --lyric-sweep-color: #2f9fc8;
  accent-color: var(--appearance-accent);
  font-family: var(--appearance-font-family, Inter, "Segoe UI", sans-serif);
}
.app-shell.has-custom-background-image {
  background-color: var(--app-page-background);
  background-image: var(--appearance-background-image);
  background-position: center;
  background-size: cover;
  background-attachment: fixed;
}
.app-shell.has-custom-background-image .song-detail {
  background: var(--appearance-background-image) center / cover;
  background-color: var(--app-page-background);
}
.app-shell .main-scroll.has-local-controls-inset {
  padding-top: 106px;
  overflow-anchor: none;
}
.has-local-controls-inset .local-library-header,
.has-local-controls-inset .local-artists-page,
.has-local-controls-inset .recent-history-page { padding-top: 0; }
.has-local-controls-inset .playlist-overview-page,
.has-local-controls-inset .aggregate-page,
.has-local-controls-inset .page-transition-frame > .page-heading { margin-top: 0; }
.has-local-controls-inset .page-transition-frame > .page-heading .eyebrow { display: none; }
.has-local-controls-inset .page-transition-frame > .page-heading,
.has-local-controls-inset .local-folders-header { align-items: flex-start; }
@media (max-width: 980px) {
  .app-shell .main-scroll.has-local-controls-inset { padding-top: 132px; }
}
.app-shell.has-custom-background-image .workspace,
.app-shell.has-custom-background-image .main-scroll { background: transparent; }
.app-shell.has-custom-background-image .sidebar-slot > :is(.sidebar, .settings-sidebar) {
  border-right-color: rgba(255, 255, 255, .18);
  background: linear-gradient(180deg, rgba(18, 24, 33, .58), rgba(25, 31, 40, .46));
  box-shadow: inset -1px 0 rgba(255, 255, 255, .08), 12px 0 34px rgba(10, 16, 24, .12);
  color: rgba(247, 249, 252, .92);
  -webkit-backdrop-filter: blur(28px) saturate(135%);
  backdrop-filter: blur(28px) saturate(135%);
}
.app-shell.has-custom-background-image .sidebar-slot .nav-item,
.app-shell.has-custom-background-image .sidebar-slot .settings-sidebar-nav button,
.app-shell.has-custom-background-image .sidebar-slot .streaming-nav-title { color: rgba(239, 244, 250, .7); }
.app-shell.has-custom-background-image .sidebar-slot .nav-item:hover,
.app-shell.has-custom-background-image .sidebar-slot .settings-sidebar-nav button:hover {
  background: rgba(255, 255, 255, .12);
  color: #fff;
}
.app-shell.has-custom-background-image .sidebar-slot .nav-item.active,
.app-shell.has-custom-background-image .sidebar-slot .settings-sidebar-nav button.active {
  background: rgba(255, 255, 255, .9);
  color: color-mix(in srgb, var(--appearance-accent) 72%, #101827);
  box-shadow: 0 10px 28px rgba(8, 14, 22, .16);
}
.app-shell.has-custom-background-image .sidebar-slot .settings-sidebar-search {
  border-color: rgba(255, 255, 255, .18);
  background: rgba(255, 255, 255, .12);
  color: rgba(255, 255, 255, .76);
}
.app-shell.has-custom-background-image .sidebar-slot .settings-sidebar-search input { color: #fff; }
.app-shell.has-custom-background-image .sidebar-slot .settings-sidebar-search input::placeholder { color: rgba(255, 255, 255, .58); }
.app-shell.has-custom-background-image .sidebar-slot .mode-option {
  border-color: rgba(255, 255, 255, .14);
  background: rgba(255, 255, 255, .1);
  color: rgba(255, 255, 255, .62);
}
.app-shell.has-custom-background-image .sidebar-slot .mode-option.active {
  border-color: rgba(255, 255, 255, .7);
  background: rgba(255, 255, 255, .9);
  color: #17202b;
}
.app-shell.has-custom-background-image .shell-control-button { color: rgba(255, 255, 255, .82); }
.app-shell.has-custom-background-image .shell-control-button:hover,
.app-shell.has-custom-background-image .shell-control-button.active { background: rgba(255, 255, 255, .14); color: #fff; }
.app-shell.has-custom-background-image .shell-control-button.is-settings-back { background: rgba(255, 255, 255, .88); color: #143c72; }
.app-shell button:focus-visible,
.app-shell input:focus-visible,
.app-shell select:focus-visible { outline-color: color-mix(in srgb, var(--appearance-accent) 72%, transparent); }
.app-shell .settings-sidebar-nav button.active::before,
.app-shell .settings-switch input:checked + i { background: var(--appearance-accent); }
.app-shell .settings-icon { background: color-mix(in srgb, var(--appearance-accent) 10%, #fff); color: var(--appearance-accent); }

.app-shell.density-compact .settings-page { gap: 16px; padding-block: 70px; }
.app-shell.density-compact .settings-toggle-field { padding-top: 14px; }
.app-shell.density-compact .track-row { min-height: 48px; }
.app-shell.density-comfortable .settings-page { gap: 28px; }
.app-shell.density-comfortable .settings-toggle-field { padding-top: 25px; }
.app-shell.density-comfortable .track-row { min-height: 66px; }
.app-shell.density-compact :is(.local-library-row, .recent-history-row, .aggregate-track-row, .artist-song-row, .cloud-track-row, .daily-detail-row, .streaming-search-track, .local-folder-track-list > button, .local-artist-track-list > button) {
  min-height: 56px;
  padding-block: 4px;
}
.app-shell.density-comfortable :is(.local-library-row, .recent-history-row, .aggregate-track-row, .artist-song-row, .cloud-track-row, .daily-detail-row, .streaming-search-track, .local-folder-track-list > button, .local-artist-track-list > button) {
  min-height: 82px;
  padding-block: 14px;
}

.app-shell.animations-reduced *,
.app-shell.animations-reduced *::before,
.app-shell.animations-reduced *::after {
  scroll-behavior: auto !important;
  animation-duration: .01ms !important;
  animation-iteration-count: 1 !important;
  transition-duration: .01ms !important;
}

.app-shell.theme-dark {
  --app-card-background: #20242b;
  --app-card-shadow: 0 16px 38px rgba(0,0,0,.2);
  --app-playing-background: #292a27;
  color: #e8edf3;
  color-scheme: dark;
}
.app-shell.theme-dark .settings-sidebar { background: #15181e; }
.app-shell.theme-dark .settings-sidebar-search { border-color: #323844; background: #20242c; color: #909bad; }
.app-shell.theme-dark .settings-sidebar-search input,
.app-shell.theme-dark .settings-page-header h1,
.app-shell.theme-dark .settings-card-heading h2,
.app-shell.theme-dark .settings-toggle-field strong,
.app-shell.theme-dark .settings-library-path > strong { color: #edf1f7; }
.app-shell.theme-dark .settings-sidebar-nav button { color: #a8b1c0; }
.app-shell.theme-dark .settings-sidebar-nav button:hover { background: rgba(255,255,255,.06); color: #fff; }
.app-shell.theme-dark .settings-sidebar-nav button.active { background: #292e37; color: #fff; box-shadow: 0 12px 24px rgba(0,0,0,.16); }
.app-shell.theme-dark .settings-page-header p:last-child,
.app-shell.theme-dark .settings-card-heading p,
.app-shell.theme-dark .settings-toggle-field > div > span { color: #9ba6b7; }
.app-shell.theme-dark .settings-card { border-color: #343a45; background: rgba(31,35,42,.9); box-shadow: 0 18px 45px rgba(0,0,0,.22); }
.app-shell.theme-dark .settings-onboarding-button { background: #292e37; color: #d8e0eb; }
.app-shell.theme-dark .settings-onboarding-button:hover { background: rgba(45,212,167,.14); color: #54ddba; }
.app-shell.theme-dark .appearance-card { border-color: #343a45; background: rgba(29,33,40,.96); color: #edf1f7; box-shadow: 0 18px 46px rgba(0,0,0,.24); }
.app-shell.theme-dark .appearance-row,
.app-shell.theme-dark .lyric-setting { border-color: #343a45; }
.app-shell.theme-dark .appearance-copy span,
.app-shell.theme-dark .appearance-heading p,
.app-shell.theme-dark .lyric-setting small { color: #98a4b5; }
.app-shell.theme-dark .appearance-segments,
.app-shell.theme-dark .background-editor,
.app-shell.theme-dark .lyric-editor { border-color: #343b46; background: #20242b; }
.app-shell.theme-dark .appearance-segments button.active,
.app-shell.theme-dark .background-panel,
.app-shell.theme-dark .page-background-heading,
.app-shell.theme-dark .page-background-body,
.app-shell.theme-dark .background-mode button.active,
.app-shell.theme-dark .background-actions button,
.app-shell.theme-dark .inherit-button,
.app-shell.theme-dark .range-control { border-color: #3a414d; background: #292e37; color: #edf1f7; }
.app-shell.theme-dark .appearance-select,
.app-shell.theme-dark .appearance-static-value,
.app-shell.theme-dark .lyric-setting select,
.app-shell.theme-dark .lyric-custom-colors label,
.app-shell.theme-dark .background-colors label { border-color: #3a414d; background: #252a32; color: #c5ceda; }
.app-shell.theme-dark .page-background-item { border-color: #39404b; }

.app-shell .song-detail-title,
.app-shell .song-detail-artist,
.app-shell .song-detail-song-info,
.app-shell .song-detail-translation { font-size: var(--lyric-font-size); }
.app-shell .song-detail-lyrics { grid-template-columns: minmax(0, 1fr); }
.app-shell .song-detail-lyrics-list { text-align: left; padding-bottom: 0; --lyric-highlight-color: var(--lyric-sweep-color); }
.app-shell .song-detail-lyrics-list p.lyric-line {
  color: var(--lyric-inactive-color);
  font-family: var(--lyric-font-family, Inter, "Segoe UI", sans-serif);
  font-size: var(--lyric-font-size);
  font-weight: var(--lyric-font-weight);
  line-height: var(--lyric-line-height);
  text-align: left;
  transform-origin: left center;
  opacity: var(--lyric-inactive-opacity);
  transition: opacity 180ms ease, color 180ms ease;
  padding-block: 2px;
}
.app-shell .song-detail-lyrics-list p.lyric-line.is-active { font-size: var(--lyric-font-size); opacity: 1; }
.app-shell .song-detail-lyrics-list p.lyric-line.has-translation { padding-bottom: .35em; }
.app-shell .song-detail-lyrics-list .lyric-line-content { display: flex; flex-direction: column; align-items: flex-start; }
.app-shell .song-detail-lyrics-list .lyric-original {
  position: relative;
  width: max-content;
  max-width: 80%;
  margin-block: var(--lyric-scale-room, 0px);
  white-space: normal;
  overflow-wrap: anywhere;
  font-size: var(--lyric-font-size);
  line-height: max(1.3em, calc(var(--lyric-line-height) * .78em));
  transform: scale(1);
  transform-origin: left center;
  transition: color 180ms ease, transform 260ms cubic-bezier(.2,.75,.2,1);
  will-change: transform;
}
.app-shell .song-detail-lyrics-list p.lyric-line.is-active .lyric-original { transform: scale(1.25); }
.app-shell .song-detail-lyrics-list .song-detail-translation {
  position: relative;
  margin-top: 2px;
  line-height: 1.25;
  width: 100%;
  white-space: normal;
  overflow-wrap: anywhere;
}
.app-shell .song-detail-lyrics-list .is-leading-quote { position: absolute; left: 0; top: 0; transform: translateX(-100%); }
.app-shell .song-detail-lyrics-list .lyric-character,
.app-shell .song-info-character { white-space: pre-wrap; }
.app-shell .song-detail-lyrics-list .lyric-character { white-space: pre; }
.app-shell .song-detail-lyrics-list p.lyric-line.is-outside-focus { opacity: .12; }
.app-shell .song-detail-lyrics-list .lyric-original,
.app-shell .song-detail-lyrics-list .lyric-character { color: var(--lyric-inactive-color); }
.app-shell .song-detail-lyrics-list .lyric-line.is-word-timed .lyric-character {
  color: var(--lyric-inactive-color);
  background: none;
  -webkit-text-fill-color: currentColor;
}
.app-shell .song-detail-lyrics-list .lyric-line.is-active .lyric-original,
.app-shell .song-detail-lyrics-list .lyric-line.is-active .lyric-character { color: var(--lyric-active-color); }
.app-shell .song-detail-lyrics-list .lyric-line.is-word-timed.is-active .lyric-character {
  background-image: linear-gradient(90deg,var(--lyric-highlight-color) 0,var(--lyric-highlight-color) var(--lyric-character-progress),var(--lyric-inactive-color) var(--lyric-character-progress),var(--lyric-inactive-color) 100%);
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}
.app-shell.lyrics-no-word-highlight .song-detail-lyrics-list .lyric-line.is-word-timed .lyric-character { background: none; color: var(--lyric-inactive-color); -webkit-text-fill-color: currentColor; }
.app-shell.lyrics-no-word-highlight .song-detail-lyrics-list .lyric-line.is-word-timed.is-active .lyric-character { color: var(--lyric-active-color); }
.app-shell .song-detail-lyrics-list .lyric-line.is-active:not(.is-word-timed) .lyric-character { color: var(--lyric-active-color); }

.qq-listening-range {
  display: flex;
  max-width: 320px;
  box-sizing: border-box;
  align-items: flex-end;
  flex-direction: column;
  gap: 8px;
}
.qq-listening-range-options {
  display: inline-flex;
  min-width: 0;
  padding: 4px;
  border: 1px solid #dfe3e9;
  border-radius: 8px;
  background: rgba(255,255,255,.84);
}
.qq-listening-range-options button,
.qq-listening-custom-range > button {
  height: 32px;
  border: 0;
  border-radius: 6px;
  padding: 0 12px;
  background: transparent;
  color: #657084;
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}
.qq-listening-range-options button.active {
  background: #20242d;
  color: #fff;
}
.qq-listening-range-options button:disabled { opacity: .6; cursor: wait; }
.qq-listening-range-error { margin: 0; color: #bd4e55; font-size: 12px; }

@media (prefers-reduced-motion: reduce) {
  .app-page-enter-active,
  .app-page-leave-active,
  .app-page-slide-forward-enter-active,
  .app-page-slide-forward-leave-active,
  .app-page-slide-backward-enter-active,
  .app-page-slide-backward-leave-active { transition-duration: .01ms; }
  .app-page-enter-from,
  .app-page-leave-to,
  .app-page-slide-forward-enter-from,
  .app-page-slide-forward-leave-to,
  .app-page-slide-backward-enter-from,
  .app-page-slide-backward-leave-to { transform: none; }
  .streaming-source-trigger,
  .streaming-home-search,
  .source-menu-enter-active,
  .source-menu-leave-active,
  .streaming-home-login-card > button,
  .streaming-daily-actions button,
  .streaming-daily-preview-all,
  .streaming-daily-preview-track,
  .streaming-featured-playlist-cover,
  .streaming-featured-playlist-cover img,
  .streaming-featured-playlist-play,
  .streaming-personal-card { transition-duration: .01ms; }
  .streaming-daily-preview-bars i { animation: none; }
}

@media (max-width: 1080px) {
  .streaming-daily-mix { grid-template-columns: minmax(0, 1fr) 250px; padding: 38px; }
  .streaming-daily-cover-stack { width: 250px; transform: scale(.86); transform-origin: center right; }
  .streaming-featured-playlists-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
}

@media (max-width: 980px) {
  .shell-controls {
    left: 4px;
    display: grid;
    grid-template-columns: repeat(2, 32px);
    gap: 4px;
  }
  .settings-page { width: calc(100% - 44px); }
}

@media (max-width: 700px) {
  body { overflow: hidden; }
  .app-shell { display: grid; grid-template-columns: 72px minmax(0, 1fr); }
  .app-shell.is-sidebar-collapsed { grid-template-columns: 0 minmax(0, 1fr); }
  .workspace { height: 100vh; min-height: 0; }
  .homepage-hero-layout { grid-template-columns: 1fr; }
  .section-heading-actions { gap: 10px; }
  .daily-recommendation-card { min-height: 218px; }
  .streaming-home-tools { width: 100%; align-self: stretch; }
  .page-heading.is-search-heading { align-items: stretch; }
  .page-heading.is-search-heading .streaming-home-tools { width: 100%; align-self: stretch; }
  .streaming-home-search { flex-basis: auto; }
  .streaming-source-menu { width: min(232px, calc(100vw - 32px)); }
  .streaming-home-login-card { min-height: 350px; padding: 44px 22px; }
  .streaming-home-login-card h2 { font-size: 27px; }
  .settings-page { width: calc(100% - 28px); padding-top: 72px; }
  .streaming-login-kicker { letter-spacing: 1.2px; }
  .streaming-daily-mix { min-height: 0; grid-template-columns: 1fr; gap: 24px; padding: 28px 24px; }
  .streaming-daily-copy h2 { font-size: 39px; }
  .streaming-daily-copy > p { margin-top: 18px; }
  .streaming-daily-cover-stack { width: 250px; height: 190px; justify-self: center; transform: scale(.78); transform-origin: top center; margin-bottom: -40px; }
  .streaming-daily-preview { padding-inline: 0; }
  .streaming-daily-preview-grid { grid-template-columns: 1fr; gap: 6px; }
  .streaming-daily-preview-track { grid-template-columns: 34px 46px minmax(0, 1fr) 42px; gap: 10px; padding-inline: 9px; }
  .streaming-daily-preview-cover { width: 46px; height: 46px; }
  .streaming-featured-playlists { padding-inline: 0; }
  .streaming-featured-playlists-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 22px 14px; }
  .streaming-personal-grid { grid-template-columns: 1fr; gap: 14px; }
  .streaming-personal-card { grid-template-columns: 68px minmax(0, 1fr) 38px; min-height: 96px; padding: 14px; }
  .streaming-radar-covers { transform: scale(.84); transform-origin: center left; }
  .qq-listening-range { align-items: stretch; max-width: none; }
  .qq-listening-range-options { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); width: 100%; }
  .qq-listening-range-options button { padding-inline: 5px; }
}
</style>
