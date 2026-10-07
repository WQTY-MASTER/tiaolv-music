import type { ShortcutAction, ShortcutPatch, ShortcutSnapshot } from "../../shared/shortcuts";
import type { AboutSnapshot, BackendHealth, UpdateCheckResult } from "../../shared/about";
import type { CloseBehavior } from "../../shared/desktopIntegration";
import type {
  DesktopLyricsAction,
  DesktopLyricsBounds,
  DesktopLyricsPlaybackState,
  DesktopLyricsPreferences,
  DesktopLyricsSnapshot
} from "../../shared/desktopLyrics";

type TaskbarMediaAction = "previous" | "toggle" | "next";
type TrayMediaAction = TaskbarMediaAction
  | "favorite"
  | "desktop-lyrics"
  | "mini-player"
  | "settings"
  | `play-mode:${"shuffle" | "sequence" | "single" | "loop"}`;

interface SystemTrayState {
  title: string;
  artist: string;
  isPlaying: boolean;
  liked: boolean;
  playMode: "shuffle" | "sequence" | "single" | "loop";
  desktopLyricsVisible: boolean;
  miniPlayerVisible: boolean;
}

interface ListenMusicBridge {
  isWindows: boolean;
  getShortcuts(): Promise<ShortcutSnapshot>;
  updateShortcuts(patch: ShortcutPatch, reset?: boolean): Promise<ShortcutSnapshot>;
  setShortcutRecording(recording: boolean): Promise<ShortcutSnapshot>;
  onShortcutsChanged(listener: (snapshot: ShortcutSnapshot) => void): () => void;
  onShortcutAction(listener: (action: ShortcutAction) => void): () => void;
  ping(): Promise<BackendHealth>;
  getAboutSnapshot(): Promise<AboutSnapshot>;
  checkForUpdates(): Promise<UpdateCheckResult>;
  setAutoUpdateCheck(enabled: boolean): Promise<AboutSnapshot>;
  openExternalLink(url: string): Promise<boolean>;
  onUpdateCheckResult(listener: (result: UpdateCheckResult) => void): () => void;
  getLibrary(): Promise<unknown[]>;
  getPlaylists(): Promise<unknown[]>;
  search(query: string): Promise<unknown[]>;
  play(trackId: string): Promise<unknown>;
  pause(): Promise<unknown>;
  setVolume(value: number): Promise<unknown>;
  selectDirectory(): Promise<string | null>;
  selectCoverImage(): Promise<string | null>;
  readAppearanceBackground(imagePath: string): Promise<string>;
  getBackgroundCacheStatistics(): Promise<{ directory: string; bytes: number; entries: number }>;
  clearBackgroundCache(): Promise<{ directory: string; bytes: number; entries: number }>;
  getLegacyAggregatePlaylists(): Promise<unknown[]>;
  uploadCloudAudio(): Promise<unknown[]>;
  downloadCloudTrack(audioUrl: string, fileName: string): Promise<boolean>;
  enterMiniMode(options: { showInTaskbar: boolean; alwaysOnTop: boolean }): Promise<boolean>;
  exitMiniMode(): Promise<boolean>;
  setMiniQueueExpanded(expanded: boolean): Promise<boolean>;
  setTaskbarThumbnailButtons(enabled: boolean, isPlaying: boolean): Promise<boolean>;
  updateTaskbarPlaybackState(isPlaying: boolean): Promise<boolean>;
  onTaskbarMediaAction(listener: (action: TaskbarMediaAction) => void): () => void;
  setSystemTrayEnabled(enabled: boolean, state: SystemTrayState): Promise<boolean>;
  updateSystemTrayState(state: SystemTrayState): Promise<boolean>;
  onTrayMediaAction(listener: (action: TrayMediaAction) => void): () => void;
  setCloseBehavior(behavior: CloseBehavior): Promise<CloseBehavior>;
  onWindowCloseBehavior(listener: (behavior: CloseBehavior) => void): () => void;
  getLaunchAtStartup(): Promise<boolean>;
  setLaunchAtStartup(enabled: boolean): Promise<boolean>;
  toggleDesktopLyricsWindow(): Promise<boolean>;
  closeDesktopLyricsWindow(): Promise<boolean>;
  getDesktopLyricsSnapshot(): Promise<DesktopLyricsSnapshot | null>;
  updateDesktopLyricsPlaybackState(state: DesktopLyricsPlaybackState): void;
  updateDesktopLyricsTime(currentTime: number, allowRewind?: boolean): void;
  updateDesktopLyricsPreferences(patch: Partial<DesktopLyricsPreferences>): Promise<DesktopLyricsPreferences>;
  updateDesktopLyricsBounds(bounds: Pick<DesktopLyricsBounds, "width" | "height">): Promise<DesktopLyricsBounds>;
  sendDesktopLyricsAction(action: DesktopLyricsAction): void;
  onDesktopLyricsPlaybackState(listener: (state: DesktopLyricsPlaybackState) => void): () => void;
  onDesktopLyricsTime(listener: (currentTime: number, allowRewind: boolean) => void): () => void;
  onDesktopLyricsPreferences(listener: (preferences: DesktopLyricsPreferences) => void): () => void;
  onDesktopLyricsBoundsChanged(listener: (bounds: DesktopLyricsBounds) => void): () => void;
  onDesktopLyricsHoverState(listener: (pointerInside: boolean) => void): () => void;
  onDesktopLyricsUnlockHotspot(listener: (active: boolean) => void): () => void;
  onDesktopLyricsVisibilityChanged(listener: (visible: boolean) => void): () => void;
  onDesktopLyricsAction(listener: (action: DesktopLyricsAction) => void): () => void;
  copyText(value: string): Promise<boolean>;
}

declare global {
  interface Window {
    listenMusic?: ListenMusicBridge;
  }
}

export {};
