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
  ping(): Promise<{ ok: boolean }>;
  getLibrary(): Promise<unknown[]>;
  getPlaylists(): Promise<unknown[]>;
  search(query: string): Promise<unknown[]>;
  play(trackId: string): Promise<unknown>;
  pause(): Promise<unknown>;
  setVolume(value: number): Promise<unknown>;
  selectDirectory(): Promise<string | null>;
  selectCoverImage(): Promise<string | null>;
  uploadCloudAudio(): Promise<unknown[]>;
  downloadCloudTrack(audioUrl: string, fileName: string): Promise<boolean>;
  enterMiniMode(): Promise<boolean>;
  exitMiniMode(): Promise<boolean>;
  setMiniQueueExpanded(expanded: boolean): Promise<boolean>;
  setTaskbarThumbnailButtons(enabled: boolean, isPlaying: boolean): Promise<boolean>;
  updateTaskbarPlaybackState(isPlaying: boolean): Promise<boolean>;
  onTaskbarMediaAction(listener: (action: TaskbarMediaAction) => void): () => void;
  setSystemTrayEnabled(enabled: boolean, state: SystemTrayState): Promise<boolean>;
  updateSystemTrayState(state: SystemTrayState): Promise<boolean>;
  onTrayMediaAction(listener: (action: TrayMediaAction) => void): () => void;
  copyText(value: string): Promise<boolean>;
}

declare global {
  interface Window {
    listenMusic?: ListenMusicBridge;
  }
}

export {};
