export type TrackBatchAction = "like" | "unlike" | "remove" | "clear-recent" | "queue" | "add-to-playlist";
export interface TrackBatchResult {
  succeeded: string[];
  failed: string[];
  message?: string;
}

export function selectedVisibleIds(selected: readonly string[], visible: readonly { id: string }[]): string[] {
  const ids = new Set(selected);
  return [...new Set(visible.filter(track => ids.has(track.id)).map(track => track.id))];
}

export async function runTrackBatch(
  ids: readonly string[],
  operation: (id: string) => Promise<unknown>,
  isCurrent: () => boolean = () => true
): Promise<TrackBatchResult> {
  const result: TrackBatchResult = { succeeded: [], failed: [] };
  for (const id of new Set(ids)) {
    if (!isCurrent()) { result.failed.push(id); continue; }
    try {
      await operation(id);
      result.succeeded.push(id);
    } catch {
      result.failed.push(id);
    }
  }
  return result;
}

export function canActivateTrackHold(elapsedMs: number, deltaX: number, deltaY: number): boolean {
  return elapsedMs >= 450 && Math.hypot(deltaX, deltaY) <= 8;
}
