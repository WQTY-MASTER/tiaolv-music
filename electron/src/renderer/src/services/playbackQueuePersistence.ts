import type { PersistedTrack } from "./api";

export function createPlaybackQueuePersistence(
  saveQueue: (tracks: PersistedTrack[]) => Promise<unknown>,
  onError: () => void
) {
  let saveChain: Promise<void> = Promise.resolve();

  return {
    enqueue(tracks: readonly PersistedTrack[]): Promise<void> {
      const snapshot = tracks.map(track => ({ ...track }));
      saveChain = saveChain
        .catch(() => undefined)
        .then(() => saveQueue(snapshot))
        .then(() => undefined)
        .catch(() => {
          onError();
        });
      return saveChain;
    }
  };
}
