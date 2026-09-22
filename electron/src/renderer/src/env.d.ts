interface ListenMusicBridge {
  ping(): Promise<{ ok: boolean }>;
  getLibrary(): Promise<unknown[]>;
  getPlaylists(): Promise<unknown[]>;
  search(query: string): Promise<unknown[]>;
  play(trackId: string): Promise<unknown>;
  pause(): Promise<unknown>;
  setVolume(value: number): Promise<unknown>;
  selectDirectory(): Promise<string | null>;
  selectCoverImage(): Promise<string | null>;
  enterMiniMode(): Promise<boolean>;
  exitMiniMode(): Promise<boolean>;
  setMiniQueueExpanded(expanded: boolean): Promise<boolean>;
  copyText(value: string): Promise<boolean>;
}

declare global {
  interface Window {
    listenMusic?: ListenMusicBridge;
  }
}

export {};
