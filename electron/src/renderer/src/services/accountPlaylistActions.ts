export type PlaylistProvider = "qq" | "netease";

export interface PlaylistAccountContext {
  provider: PlaylistProvider;
  userId: string;
  revision: number;
}

export function trackPlaylistProvider(track: { id: string; source?: string }): PlaylistProvider | null {
  const source = track.source || track.id.split(":", 1)[0];
  if (source === "qq" || source === "qqmusic") return "qq";
  if (source === "netease" || source === "ncm") return "netease";
  return null;
}

export function canEditAccountPlaylist(
  playlist: { source?: string; createdByAccount?: boolean; deletable?: boolean; favorite?: boolean },
  provider: PlaylistProvider
) {
  return playlist.source === provider && playlist.createdByAccount === true
    && playlist.deletable === true && playlist.favorite !== true;
}

export function isPlaylistAccountCurrent(
  context: PlaylistAccountContext,
  accounts: readonly { provider: string; userId: string }[],
  revision: number
) {
  return context.revision === revision
    && accounts.some(account => account.provider === context.provider && account.userId === context.userId);
}

export interface AccountPlaylistBatchResult {
  succeeded: string[];
  failed: string[];
  errors?: Record<string, string>;
  message?: string;
}

export interface PlaylistBatchProgress { processed: number; total: number }

export async function runAccountPlaylistChunks(
  ids: readonly string[],
  operation: (ids: string[]) => Promise<void | AccountPlaylistBatchResult>,
  options: {
    chunkSize?: number;
    isCurrent?: () => boolean;
    onProgress?: (progress: PlaylistBatchProgress) => void;
    onChunk?: (result: AccountPlaylistBatchResult) => void;
  } = {}
): Promise<AccountPlaylistBatchResult> {
  const unique = [...new Set(ids)];
  const size = Math.max(1, Math.min(100, Math.floor(options.chunkSize || 100)));
  const isCurrent = options.isCurrent || (() => true);
  const result: AccountPlaylistBatchResult = { succeeded: [], failed: [], errors: {} };
  let processed = 0;
  if (isCurrent()) options.onProgress?.({ processed, total: unique.length });
  for (let offset = 0; offset < unique.length; offset += size) {
    if (!isCurrent()) {
      result.failed.push(...unique.slice(offset));
      break;
    }
    const chunk = unique.slice(offset, offset + size);
    let settled: AccountPlaylistBatchResult;
    try {
      const response = await operation(chunk);
      const verified = new Set(response ? response.succeeded.filter(id => !response.failed.includes(id)) : chunk);
      settled = { succeeded: chunk.filter(id => verified.has(id)), failed: chunk.filter(id => !verified.has(id)), errors: {} };
      for (const id of settled.failed) settled.errors![id] = response?.errors?.[id] || response?.message || "平台未确认操作结果，请刷新歌单后检查。";
    } catch (error) {
      const reason = error instanceof Error ? error.message : "操作失败，请重试。";
      settled = { succeeded: [], failed: chunk, errors: Object.fromEntries(chunk.map(id => [id, reason])) };
    }
    result.succeeded.push(...settled.succeeded);
    result.failed.push(...settled.failed);
    Object.assign(result.errors!, settled.errors);
    processed += chunk.length;
    if (isCurrent()) {
      options.onChunk?.(settled);
      options.onProgress?.({ processed, total: unique.length });
    }
  }
  if (result.failed.length) {
    const reason = Object.values(result.errors!)[0] || "账号或页面已变化，请重新选择歌曲。";
    result.message = `成功 ${result.succeeded.length} 首，失败 ${result.failed.length} 首：${reason}`;
  }
  return result;
}
