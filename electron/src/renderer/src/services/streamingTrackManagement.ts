export type TrackBatchAction = "like" | "unlike" | "remove" | "clear-recent" | "queue" | "add-to-playlist" | "add-to-aggregate";
export interface TrackBatchResult {
  succeeded: string[];
  failed: string[];
  errors?: Record<string, string>;
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
  let failureReason = "";
  for (const id of new Set(ids)) {
    if (!isCurrent()) { result.failed.push(id); continue; }
    try {
      await operation(id);
      result.succeeded.push(id);
    } catch (error) {
      result.failed.push(id);
      if (!failureReason) failureReason = error instanceof Error ? error.message : "操作失败，请重试。";
    }
  }
  if (failureReason) result.message = `成功 ${result.succeeded.length} 首，失败 ${result.failed.length} 首：${failureReason}`;
  return result;
}

export function canActivateTrackHold(elapsedMs: number, deltaX: number, deltaY: number): boolean {
  return elapsedMs >= 450 && Math.hypot(deltaX, deltaY) <= 8;
}
